-- Phase 6 - Customer order counting RPC / aggregate hardening
-- Goal:
-- 1. Move hot-path counting logic from app-side JS to Supabase RPC.
-- 2. Keep one backend contract for tracking summary and kitchen monthly gift stats.
-- 3. Keep the current app safe: if these RPCs are not deployed yet, app falls back to service-layer counting.
--
-- Safe to run multiple times.

create or replace function public.normalize_order_counting_status(p_value text)
returns text
language sql
stable
as $$
  select regexp_replace(
    replace(
      lower(
        coalesce(
          public.unaccent(trim(coalesce(p_value, ''))),
          ''
        )
      ),
      'đ',
      'd'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

create or replace function public.get_customer_phone_variants(p_phone text)
returns text[]
language plpgsql
stable
as $$
declare
  normalized_phone text;
  local_digits text;
begin
  normalized_phone := public.normalize_vietnam_phone(p_phone);

  if normalized_phone is null or normalized_phone = '' then
    return array[]::text[];
  end if;

  local_digits := case
    when left(normalized_phone, 1) = '0' then substr(normalized_phone, 2)
    else normalized_phone
  end;

  return (
    select array_agg(distinct value order by value)
    from unnest(
      array[
        normalized_phone,
        local_digits,
        case when local_digits <> '' then '84' || local_digits else '' end,
        case when local_digits <> '' then '+84' || local_digits else '' end,
        case when local_digits <> '' then '0084' || local_digits else '' end
      ]
    ) as value
    where coalesce(trim(value), '') <> ''
  );
end;
$$;

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
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(nullif(po.points_base_amount, 0), po.total_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) as raw_status_key,
    floor((coalesce(nullif(po.points_base_amount, 0), po.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from public.partner_orders po
  cross join identity i
  cross join rule r
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preorder', 'preordered', 'scheduled', 'dattruoc')
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

create or replace function public.get_monthly_customer_gift_stats_by_phones(
  p_reward_month text,
  p_customer_phones text[]
)
returns table(
  customer_key text,
  customer_phone text,
  monthly_order_count integer,
  total_orders integer,
  total_spent numeric,
  claim_id uuid,
  claimed boolean,
  claimed_at timestamptz,
  claimed_order_code text,
  claimed_by_name text,
  order_count_at_claim integer
)
language sql
stable
as $$
with normalized_phones as (
  select distinct public.normalize_vietnam_phone(phone) as customer_phone
  from unnest(coalesce(p_customer_phones, array[]::text[])) as phone
  where coalesce(trim(phone), '') <> ''
),
phone_variants as (
  select
    np.customer_phone,
    public.get_customer_phone_variants(np.customer_phone) as phone_variants
  from normalized_phones np
  where coalesce(np.customer_phone, '') <> ''
),
monthly_web_orders as (
  select
    pv.customer_phone,
    count(*)::integer as total_orders
  from phone_variants pv
  join public.orders o
    on o.customer_phone = any(pv.phone_variants)
  where to_char(o.created_at at time zone 'UTC', 'YYYY-MM') = p_reward_month
    and public.normalize_order_counting_status(o.status) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
  group by pv.customer_phone
),
monthly_partner_orders as (
  select
    pv.customer_phone,
    count(*)::integer as total_orders
  from phone_variants pv
  join public.partner_orders po
    on po.customer_phone_key = any(pv.phone_variants)
    or po.customer_phone = any(pv.phone_variants)
  where to_char(coalesce(po.order_time, po.created_at) at time zone 'UTC', 'YYYY-MM') = p_reward_month
    and public.normalize_order_counting_status(po.order_status) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and public.normalize_order_counting_status(po.nexpos_status) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
  group by pv.customer_phone
),
all_time_web_orders as (
  select
    pv.customer_phone,
    count(*)::integer as total_orders,
    coalesce(sum(o.total_amount), 0)::numeric as total_spent
  from phone_variants pv
  join public.orders o
    on o.customer_phone = any(pv.phone_variants)
  where public.normalize_order_counting_status(o.status) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
  group by pv.customer_phone
),
all_time_partner_orders as (
  select
    pv.customer_phone,
    count(*)::integer as total_orders,
    coalesce(sum(po.total_amount), 0)::numeric as total_spent
  from phone_variants pv
  join public.partner_orders po
    on po.customer_phone_key = any(pv.phone_variants)
    or po.customer_phone = any(pv.phone_variants)
  where public.normalize_order_counting_status(po.order_status) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and public.normalize_order_counting_status(po.nexpos_status) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
  group by pv.customer_phone
)
select
  pv.customer_phone as customer_key,
  pv.customer_phone,
  coalesce(mwo.total_orders, 0) + coalesce(mpo.total_orders, 0) as monthly_order_count,
  coalesce(awo.total_orders, 0) + coalesce(apo.total_orders, 0) as total_orders,
  coalesce(awo.total_spent, 0) + coalesce(apo.total_spent, 0) as total_spent,
  mg.id as claim_id,
  (mg.id is not null) as claimed,
  mg.claimed_at,
  coalesce(mg.claimed_order_code, '') as claimed_order_code,
  coalesce(mg.claimed_by_name, '') as claimed_by_name,
  coalesce(mg.order_count_at_claim, 0) as order_count_at_claim
from phone_variants pv
left join monthly_web_orders mwo
  on mwo.customer_phone = pv.customer_phone
left join monthly_partner_orders mpo
  on mpo.customer_phone = pv.customer_phone
left join all_time_web_orders awo
  on awo.customer_phone = pv.customer_phone
left join all_time_partner_orders apo
  on apo.customer_phone = pv.customer_phone
left join public.monthly_customer_gifts mg
  on mg.customer_key = pv.customer_phone
 and mg.reward_month = p_reward_month
 and mg.gift_code = 'MONTHLY_3_ORDERS'
order by pv.customer_phone;
$$;

grant execute on function public.normalize_order_counting_status(text) to anon, authenticated;
grant execute on function public.get_customer_phone_variants(text) to anon, authenticated;
grant execute on function public.get_customer_order_count_summary(text) to anon, authenticated;
grant execute on function public.get_monthly_customer_gift_stats_by_phones(text, text[]) to anon, authenticated;

-- Verification queries.
select *
from public.get_customer_order_count_summary('0900000000');

select *
from public.get_monthly_customer_gift_stats_by_phones(
  to_char(now() at time zone 'UTC', 'YYYY-MM'),
  array['0900000000', '0911111111']
);
