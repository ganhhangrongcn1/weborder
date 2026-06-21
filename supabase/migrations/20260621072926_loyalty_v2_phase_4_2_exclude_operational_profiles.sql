-- Phase 4.2: loại operational profiles khỏi backlog loyalty customer.
-- Các phone thuộc admin / staff / kitchen sẽ không bị audit hay reconcile như khách hàng.

create or replace function loyalty_private.is_operational_phone(
  p_customer_phone text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
  select exists (
    select 1
    from public.profiles p
    where public.normalize_vietnam_phone(p.phone) = public.normalize_vietnam_phone(p_customer_phone)
      and lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen')
      and lower(coalesce(p.status, 'active')) = 'active'
  );
$$;

create or replace function loyalty_private.audit_loyalty_reconcile_backlog_internal(
  p_customer_phone text default null,
  p_source_type text default null,
  p_limit integer default 200
)
returns table (
  source_type text,
  source_order_id text,
  customer_phone text,
  order_code text,
  order_status text,
  action text,
  expected_points integer,
  points_spent integer,
  detected_reason text,
  action_priority integer,
  sort_time timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
  with params as (
    select
      nullif(public.normalize_vietnam_phone(p_customer_phone), '') as phone_filter,
      case
        when upper(trim(coalesce(p_source_type, ''))) in ('ORDER', 'PARTNER_ORDER')
          then upper(trim(coalesce(p_source_type, '')))
        else null
      end as source_filter,
      greatest(1, least(coalesce(p_limit, 200), 1000)) as limit_rows
  ),
  order_spend_missing as (
    select
      'ORDER'::text as source_type,
      o.id::text as source_order_id,
      public.normalize_vietnam_phone(o.customer_phone) as customer_phone,
      coalesce(o.order_code, o.id::text) as order_code,
      lower(trim(coalesce(o.status, ''))) as order_status,
      'SPEND'::text as action,
      coalesce(o.expected_earn_points, 0)::integer as expected_points,
      coalesce(o.points_spent, 0)::integer as points_spent,
      'missing_spend_ledger'::text as detected_reason,
      10::integer as action_priority,
      coalesce(o.updated_at, o.created_at, now()) as sort_time
    from public.orders o
    cross join params p
    where (p.source_filter is null or p.source_filter = 'ORDER')
      and nullif(public.normalize_vietnam_phone(o.customer_phone), '') is not null
      and (p.phone_filter is null or public.normalize_vietnam_phone(o.customer_phone) = p.phone_filter)
      and not loyalty_private.is_operational_phone(o.customer_phone)
      and coalesce(o.points_spent, 0) > 0
      and lower(trim(coalesce(o.status, ''))) not in ('cancelled', 'canceled', 'cancel', 'refunded')
      and not exists (
        select 1
        from public.loyalty_ledger ll
        where ll.source_type = 'ORDER'
          and ll.source_order_id = o.id::text
          and ll.action = 'SPEND'
          and ll.action_version = 1
      )
  ),
  order_settle_missing as (
    select
      'ORDER'::text as source_type,
      o.id::text as source_order_id,
      public.normalize_vietnam_phone(o.customer_phone) as customer_phone,
      coalesce(o.order_code, o.id::text) as order_code,
      lower(trim(coalesce(o.status, ''))) as order_status,
      'SETTLE_EARN'::text as action,
      coalesce(o.expected_earn_points, 0)::integer as expected_points,
      coalesce(o.points_spent, 0)::integer as points_spent,
      'missing_settle_earn_ledger'::text as detected_reason,
      20::integer as action_priority,
      coalesce(o.updated_at, o.created_at, now()) as sort_time
    from public.orders o
    cross join params p
    where (p.source_filter is null or p.source_filter = 'ORDER')
      and nullif(public.normalize_vietnam_phone(o.customer_phone), '') is not null
      and (p.phone_filter is null or public.normalize_vietnam_phone(o.customer_phone) = p.phone_filter)
      and not loyalty_private.is_operational_phone(o.customer_phone)
      and coalesce(o.expected_earn_points, 0) > 0
      and lower(trim(coalesce(o.status, ''))) in ('completed', 'done', 'hoan_tat', 'hoan tat')
      and not exists (
        select 1
        from public.loyalty_ledger ll
        where ll.source_type = 'ORDER'
          and ll.source_order_id = o.id::text
          and ll.action = 'SETTLE_EARN'
          and ll.action_version = 1
      )
  ),
  order_reverse_spend_missing as (
    select
      'ORDER'::text as source_type,
      o.id::text as source_order_id,
      public.normalize_vietnam_phone(o.customer_phone) as customer_phone,
      coalesce(o.order_code, o.id::text) as order_code,
      lower(trim(coalesce(o.status, ''))) as order_status,
      'REVERSE_SPEND'::text as action,
      coalesce(o.expected_earn_points, 0)::integer as expected_points,
      coalesce(o.points_spent, 0)::integer as points_spent,
      'missing_reverse_spend_ledger'::text as detected_reason,
      30::integer as action_priority,
      coalesce(o.updated_at, o.created_at, now()) as sort_time
    from public.orders o
    cross join params p
    where (p.source_filter is null or p.source_filter = 'ORDER')
      and nullif(public.normalize_vietnam_phone(o.customer_phone), '') is not null
      and (p.phone_filter is null or public.normalize_vietnam_phone(o.customer_phone) = p.phone_filter)
      and not loyalty_private.is_operational_phone(o.customer_phone)
      and lower(trim(coalesce(o.status, ''))) in ('cancelled', 'canceled', 'cancel', 'refunded')
      and exists (
        select 1
        from public.loyalty_ledger ll
        where ll.source_type = 'ORDER'
          and ll.source_order_id = o.id::text
          and ll.action = 'SPEND'
          and ll.action_version = 1
      )
      and not exists (
        select 1
        from public.loyalty_ledger ll
        where ll.source_type = 'ORDER'
          and ll.source_order_id = o.id::text
          and ll.action = 'REVERSE_SPEND'
          and ll.action_version = 1
      )
  ),
  order_reverse_earn_missing as (
    select
      'ORDER'::text as source_type,
      o.id::text as source_order_id,
      public.normalize_vietnam_phone(o.customer_phone) as customer_phone,
      coalesce(o.order_code, o.id::text) as order_code,
      lower(trim(coalesce(o.status, ''))) as order_status,
      'REVERSE_EARN'::text as action,
      coalesce(o.expected_earn_points, 0)::integer as expected_points,
      coalesce(o.points_spent, 0)::integer as points_spent,
      'missing_reverse_earn_ledger'::text as detected_reason,
      40::integer as action_priority,
      coalesce(o.updated_at, o.created_at, now()) as sort_time
    from public.orders o
    cross join params p
    where (p.source_filter is null or p.source_filter = 'ORDER')
      and nullif(public.normalize_vietnam_phone(o.customer_phone), '') is not null
      and (p.phone_filter is null or public.normalize_vietnam_phone(o.customer_phone) = p.phone_filter)
      and not loyalty_private.is_operational_phone(o.customer_phone)
      and lower(trim(coalesce(o.status, ''))) in ('cancelled', 'canceled', 'cancel', 'refunded')
      and exists (
        select 1
        from public.loyalty_ledger ll
        where ll.source_type = 'ORDER'
          and ll.source_order_id = o.id::text
          and ll.action = 'SETTLE_EARN'
          and ll.action_version = 1
      )
      and not exists (
        select 1
        from public.loyalty_ledger ll
        where ll.source_type = 'ORDER'
          and ll.source_order_id = o.id::text
          and ll.action = 'REVERSE_EARN'
          and ll.action_version = 1
      )
  ),
  partner_reverse_earn_missing as (
    select
      'PARTNER_ORDER'::text as source_type,
      po.id::text as source_order_id,
      public.normalize_vietnam_phone(coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)) as customer_phone,
      coalesce(po.order_code, po.id::text) as order_code,
      lower(trim(coalesce(po.order_status, ''))) as order_status,
      'REVERSE_EARN'::text as action,
      coalesce(po.expected_earn_points, 0)::integer as expected_points,
      coalesce(po.points_spent, 0)::integer as points_spent,
      'missing_partner_reverse_earn_ledger'::text as detected_reason,
      40::integer as action_priority,
      coalesce(po.updated_at, po.order_time, po.created_at, now()) as sort_time
    from public.partner_orders po
    cross join params p
    where (p.source_filter is null or p.source_filter = 'PARTNER_ORDER')
      and nullif(public.normalize_vietnam_phone(coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)), '') is not null
      and (
        p.phone_filter is null
        or public.normalize_vietnam_phone(coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)) = p.phone_filter
      )
      and not loyalty_private.is_operational_phone(coalesce(nullif(po.customer_phone_key, ''), po.customer_phone))
      and lower(trim(coalesce(po.order_status, ''))) in ('cancelled', 'canceled', 'cancel', 'refunded')
      and exists (
        select 1
        from public.loyalty_ledger ll
        where ll.source_type = 'PARTNER_ORDER'
          and ll.source_order_id = po.id::text
          and ll.action = 'CLAIM_PARTNER_EARN'
          and ll.action_version = 1
      )
      and not exists (
        select 1
        from public.loyalty_ledger ll
        where ll.source_type = 'PARTNER_ORDER'
          and ll.source_order_id = po.id::text
          and ll.action = 'REVERSE_EARN'
          and ll.action_version = 1
      )
  ),
  combined as (
    select * from order_spend_missing
    union all
    select * from order_settle_missing
    union all
    select * from order_reverse_spend_missing
    union all
    select * from order_reverse_earn_missing
    union all
    select * from partner_reverse_earn_missing
  )
  select
    c.source_type,
    c.source_order_id,
    c.customer_phone,
    c.order_code,
    c.order_status,
    c.action,
    c.expected_points,
    c.points_spent,
    c.detected_reason,
    c.action_priority,
    c.sort_time
  from combined c
  order by c.sort_time asc, c.source_type asc, c.source_order_id asc, c.action_priority asc
  limit (select limit_rows from params);
$$;

revoke all on function loyalty_private.is_operational_phone(text)
from public, anon;
grant execute on function loyalty_private.is_operational_phone(text)
to authenticated, service_role;

comment on function loyalty_private.is_operational_phone(text) is
  'Trả về true nếu phone thuộc operational profile: admin, staff hoặc kitchen.';

notify pgrst, 'reload schema';
