begin;
set local lock_timeout='2s';
set local statement_timeout='5s';
do $rollback$
declare v_definition text;
begin
select pg_get_functiondef('public.get_customer_order_count_summary(text)'::regprocedure) into v_definition;
if md5(v_definition)='7f840bad1c7f216804ce721068765725' then return; end if;
if md5(v_definition)<>'b8bb52efff9f2ae1275f67e2230874be' then raise exception 'Unexpected definition; aborting rollback'; end if;
execute replace($definition$CREATE OR REPLACE FUNCTION public.get_customer_order_count_summary(p_phone text)
 RETURNS TABLE(customer_phone text, total_orders integer, total_spent numeric, claimed_points integer, pending_points integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from public.get_loyalty_order_rule()
),
identity as (
  select
    public.normalize_vietnam_phone(p_phone) as customer_phone,
    public.get_customer_phone_variants(p_phone) as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from public.loyalty_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from public.orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from public.partner_orders po
  cross join identity i
  cross join rule r
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true;
$function$
$definition$, chr(13), '');
end;
$rollback$;
commit;
