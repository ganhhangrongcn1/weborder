-- Giới hạn nhận điểm đơn đối tác trong 7 ngày kể từ thời gian tạo đơn.
-- An toàn để chạy lại nhiều lần trong Supabase SQL Editor.

begin;

create schema if not exists loyalty_private;

create or replace function loyalty_private.enforce_partner_order_claim_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_at timestamptz;
begin
  if coalesce(new.entry_type, '') <> 'PARTNER_ORDER_EARN' then
    return new;
  end if;

  select coalesce(po.order_time, po.created_at)
  into v_order_at
  from public.partner_orders po
  where po.id = new.partner_order_id
     or po.id::text = nullif(trim(coalesce(new.source_order_id, '')), '')
  limit 1;

  if v_order_at is not null and now() >= v_order_at + interval '7 days' then
    raise exception 'Đơn đối tác đã quá 7 ngày và hết hạn tích điểm.';
  end if;

  return new;
end;
$$;

drop trigger if exists loyalty_ledger_partner_claim_window on public.loyalty_ledger;
create trigger loyalty_ledger_partner_claim_window
before insert on public.loyalty_ledger
for each row
execute function loyalty_private.enforce_partner_order_claim_window();

revoke all on function loyalty_private.enforce_partner_order_claim_window()
from public, anon, authenticated;

create or replace function public.get_customer_order_count_summary(p_phone text)
returns table(
  customer_phone text,
  total_orders integer,
  total_spent numeric,
  claimed_points integer,
  pending_points integer
)
language sql
stable
set search_path = ''
as $$
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
$$;

create or replace function public.get_customer_order_point_statuses(
  p_customer_phone text,
  p_limit integer default 200
)
returns table (
  source_type text,
  source_order_id text,
  order_code text,
  display_order_code text,
  point_status text,
  net_points integer,
  expected_points integer,
  order_created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with params as (
    select
      public.normalize_vietnam_phone(p_customer_phone) as phone_key,
      greatest(1, least(coalesce(p_limit, 200), 500)) as limit_rows
  ),
  web_orders as (
    select
      'ORDER'::text as source_type,
      o.id::text as source_order_id,
      coalesce(o.order_code, o.id::text) as order_code,
      coalesce(o.order_code, o.id::text) as display_order_code,
      case
        when lower(trim(coalesce(o.status, ''))) in ('cancelled', 'canceled', 'cancel', 'refunded') then 'blocked'
        when coalesce(ledger.net_points, 0) > 0 then 'claimed'
        else 'pending'
      end as point_status,
      coalesce(ledger.net_points, 0)::integer as net_points,
      coalesce(o.expected_earn_points, 0)::integer as expected_points,
      coalesce(o.created_at, now()) as order_created_at
    from public.orders o
    cross join params p
    left join lateral (
      select coalesce(sum(ll.points), 0) as net_points
      from public.loyalty_ledger ll
      where ll.source_type = 'ORDER'
        and ll.source_order_id = o.id::text
        and ll.action in ('SETTLE_EARN', 'REVERSE_EARN')
        and ll.action_version = 1
    ) ledger on true
    where public.normalize_vietnam_phone(o.customer_phone) = p.phone_key
  ),
  partner_orders as (
    select
      'PARTNER_ORDER'::text as source_type,
      po.id::text as source_order_id,
      coalesce(po.order_code, po.id::text) as order_code,
      coalesce(nullif(po.display_order_code, ''), po.order_code, po.id::text) as display_order_code,
      case
        when lower(trim(coalesce(po.order_status, ''))) in ('cancelled', 'canceled', 'cancel', 'refunded') then 'blocked'
        when lower(trim(coalesce(po.point_status, ''))) in ('rejected', 'cancelled', 'canceled') then 'blocked'
        when coalesce(ledger.net_points, 0) > 0
          or lower(trim(coalesce(po.point_status, ''))) = 'claimed' then 'claimed'
        when lower(trim(coalesce(po.point_status, ''))) = 'expired'
          or now() >= coalesce(po.order_time, po.created_at, now()) + interval '7 days' then 'expired'
        when po.net_received_amount is null
          or po.loyalty_hold_reason = 'missing_partner_net_received' then 'waiting_data'
        else 'pending'
      end as point_status,
      coalesce(ledger.net_points, 0)::integer as net_points,
      coalesce(po.expected_earn_points, 0)::integer as expected_points,
      coalesce(po.order_time, po.created_at, now()) as order_created_at
    from public.partner_orders po
    cross join params p
    left join lateral (
      select coalesce(sum(ll.points), 0) as net_points
      from public.loyalty_ledger ll
      where ll.source_type = 'PARTNER_ORDER'
        and ll.source_order_id = po.id::text
        and ll.action in ('CLAIM_PARTNER_EARN', 'REVERSE_EARN')
        and ll.action_version = 1
    ) ledger on true
    where public.normalize_vietnam_phone(
      coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)
    ) = p.phone_key
  )
  select
    x.source_type,
    x.source_order_id,
    x.order_code,
    x.display_order_code,
    x.point_status,
    x.net_points,
    x.expected_points,
    x.order_created_at
  from (
    select * from web_orders
    union all
    select * from partner_orders
  ) x
  order by x.order_created_at desc, x.source_type asc, x.source_order_id asc
  limit (select limit_rows from params);
$$;

grant execute on function public.get_customer_order_count_summary(text)
to anon, authenticated, service_role;

revoke execute on function public.get_customer_order_point_statuses(text, integer)
from public;
grant execute on function public.get_customer_order_point_statuses(text, integer)
to anon, authenticated, service_role;

comment on trigger loyalty_ledger_partner_claim_window on public.loyalty_ledger is
'Chặn phát sinh điểm cho đơn đối tác đã quá 7 ngày kể từ order_time/created_at.';

notify pgrst, 'reload schema';

commit;

-- Kiểm tra nhanh sau khi chạy: cả hai cột phải là true.
select
  exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgname = 'loyalty_ledger_partner_claim_window'
      and t.tgrelid = 'public.loyalty_ledger'::regclass
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) as claim_window_trigger_ready,
  to_regprocedure('public.get_customer_order_point_statuses(text,integer)') is not null
    as point_status_rpc_ready;
