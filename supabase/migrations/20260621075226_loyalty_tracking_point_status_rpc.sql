-- Tracking loyalty point status by phone.
-- Source of truth for guest lookup / customer tracking
-- without exposing direct loyalty_ledger reads to guest clients.

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
        when lower(trim(coalesce(o.status, ''))) in ('completed', 'done', 'hoan_tat', 'hoan tat')
          and coalesce(o.expected_earn_points, 0) > 0 then 'pending'
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
        when lower(trim(coalesce(po.point_status, ''))) in ('rejected', 'expired', 'cancelled', 'canceled') then 'blocked'
        when lower(trim(coalesce(po.order_status, ''))) in ('cancelled', 'canceled', 'cancel', 'refunded') then 'blocked'
        when coalesce(ledger.net_points, 0) > 0 then 'claimed'
        when lower(trim(coalesce(po.order_status, ''))) in ('completed', 'done', 'hoan_tat', 'hoan tat')
          and coalesce(po.expected_earn_points, 0) > 0 then 'pending'
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
    where public.normalize_vietnam_phone(coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)) = p.phone_key
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

revoke execute on function public.get_customer_order_point_statuses(text, integer)
from public;
grant execute on function public.get_customer_order_point_statuses(text, integer)
to anon, authenticated, service_role;

comment on function public.get_customer_order_point_statuses(text, integer) is
  'Returns source-of-truth order point statuses by phone for customer tracking.';

notify pgrst, 'reload schema';
