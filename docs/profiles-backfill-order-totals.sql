-- Backfill profile totals from full order history (website + partner).
-- Goal:
-- 1. Recompute customer total_orders and total_spent from historical orders.
-- 2. Recompute member_rank using current CRM thresholds.
-- 3. Keep customer profiles as the primary source for lifetime badges.
--
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create or replace function public.normalize_vietnam_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  if digits = '' then
    return '';
  end if;

  if left(digits, 4) = '0084' then
    digits := '84' || substring(digits from 5);
  end if;

  if left(digits, 2) = '84' then
    digits := '0' || substring(digits from 3);
  elsif left(digits, 1) <> '0' and length(digits) = 9 then
    digits := '0' || digits;
  end if;

  if digits ~ '^0[0-9]{9}$' then
    return digits;
  end if;

  return '';
end;
$$;

with unified_orders as (
  select
    public.normalize_vietnam_phone(
      coalesce(
        to_jsonb(o) ->> 'customer_phone_key',
        to_jsonb(o) ->> 'customer_phone',
        to_jsonb(o) ->> 'phone'
      )
    ) as customer_phone,
    greatest(coalesce(o.total_amount, 0), 0)::numeric as total_amount,
    coalesce(o.created_at, now()) as order_time
  from public.orders o
  where public.normalize_vietnam_phone(
    coalesce(
      to_jsonb(o) ->> 'customer_phone_key',
      to_jsonb(o) ->> 'customer_phone',
      to_jsonb(o) ->> 'phone'
    )
  ) <> ''
    and coalesce(lower(o.status), '') not in ('cancelled', 'canceled', 'cancel', 'refunded')

  union all

  select
    public.normalize_vietnam_phone(
      coalesce(
        to_jsonb(po) ->> 'customer_phone_key',
        to_jsonb(po) ->> 'customer_phone',
        to_jsonb(po) ->> 'phone'
      )
    ) as customer_phone,
    greatest(coalesce(po.total_amount, 0), 0)::numeric as total_amount,
    coalesce(po.order_time, po.created_at, now()) as order_time
  from public.partner_orders po
  where public.normalize_vietnam_phone(
    coalesce(
      to_jsonb(po) ->> 'customer_phone_key',
      to_jsonb(po) ->> 'customer_phone',
      to_jsonb(po) ->> 'phone'
    )
  ) <> ''
    and coalesce(lower(po.order_status), '') not in ('cancelled', 'canceled', 'cancel', 'refunded')
    and coalesce(lower(po.nexpos_status), '') not in ('cancelled', 'canceled', 'cancel', 'refunded')
),
aggregated as (
  select
    customer_phone,
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric(12, 0) as total_spent,
    max(order_time) as last_order_at
  from unified_orders
  group by customer_phone
),
upsert_profiles as (
  insert into public.profiles (
    phone,
    name,
    registered,
    role,
    status,
    total_orders,
    total_spent,
    member_rank,
    metadata,
    created_at,
    updated_at
  )
  select
    a.customer_phone as phone,
    '' as name,
    false as registered,
    'customer' as role,
    'active' as status,
    a.total_orders,
    a.total_spent,
    case
      when a.total_spent >= 5000000 then 'Kim cương'
      when a.total_spent >= 2500000 then 'Vàng'
      when a.total_spent >= 1000000 then 'Bạc'
      else 'Đồng'
    end as member_rank,
    jsonb_build_object('lastOrderAt', a.last_order_at) as metadata,
    now() as created_at,
    now() as updated_at
  from aggregated a
  on conflict (phone) do update
  set
    role = case
      when public.profiles.role in ('admin', 'staff', 'kitchen', 'shipper') then public.profiles.role
      else 'customer'
    end,
    status = case
      when public.profiles.status = 'blocked' then public.profiles.status
      else 'active'
    end,
    total_orders = excluded.total_orders,
    total_spent = excluded.total_spent,
    member_rank = excluded.member_rank,
    metadata = coalesce(public.profiles.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning phone, total_orders, total_spent, member_rank
)
select
  'profiles_backfill_updated' as check_name,
  count(*) as updated_profiles
from upsert_profiles;

select
  'profiles_backfill_top_customers' as check_name,
  phone,
  total_orders,
  total_spent,
  member_rank
from public.profiles
where role = 'customer'
order by total_spent desc, total_orders desc
limit 20;
