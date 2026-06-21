-- Phase 4: audit + reconcile các bút toán loyalty bị thiếu cho order/web và reverse backlog an toàn.
-- Mục tiêu:
-- 1) Chỉ dùng lại core engine loyalty_v2 hiện có.
-- 2) Không tạo nhánh business logic riêng.
-- 3) Có dry-run để soi backlog trước khi ghi dữ liệu.

-- Bổ sung nhận diện actor vận hành trực tiếp từ SQL editor / CLI.
create or replace function loyalty_private.current_actor(
  out actor_type text,
  out actor_id uuid,
  out actor_phone text,
  out actor_role text
)
returns record
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
  v_session_user text := coalesce(session_user, '');
begin
  if v_jwt_role = 'service_role' or v_session_user in ('postgres', 'supabase_admin') then
    actor_type := 'SERVICE';
    actor_id := null;
    actor_phone := '';
    actor_role := 'service_role';
    return;
  end if;

  if v_uid is null then
    actor_type := 'ANONYMOUS';
    actor_id := null;
    actor_phone := '';
    actor_role := '';
    return;
  end if;

  select
    'PROFILE',
    p.id,
    public.normalize_vietnam_phone(p.phone),
    lower(coalesce(p.role, ''))
  into actor_type, actor_id, actor_phone, actor_role
  from public.profiles p
  where p.auth_user_id = v_uid
    and lower(coalesce(p.status, '')) = 'active'
  limit 1;

  if not found then
    actor_type := 'AUTHENTICATED';
    actor_id := null;
    actor_phone := '';
    actor_role := '';
  end if;
end;
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

create or replace function public.audit_loyalty_reconcile_backlog(
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
security invoker
set search_path = pg_catalog, public, loyalty_private
as $$
  select *
  from loyalty_private.audit_loyalty_reconcile_backlog_internal(
    p_customer_phone,
    p_source_type,
    p_limit
  );
$$;

create or replace function loyalty_private.reconcile_loyalty_backlog_internal(
  p_customer_phone text default null,
  p_source_type text default null,
  p_limit integer default 200,
  p_dry_run boolean default true
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
  ok boolean,
  applied boolean,
  event_id text,
  points_delta integer,
  balance_before integer,
  balance_after integer,
  message text
)
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private, auth
as $$
declare
  v_actor_type text;
  v_actor_id uuid;
  v_actor_phone text;
  v_actor_role text;
  v_result record;
  v_rpc record;
  v_idempotency_key text;
  v_error_message text;
begin
  select *
  into v_actor_type, v_actor_id, v_actor_phone, v_actor_role
  from loyalty_private.current_actor();

  if v_actor_role not in ('admin', 'service_role') then
    raise exception 'Chỉ admin hoặc service_role mới được reconcile backlog loyalty.';
  end if;

  for v_result in
    select *
    from loyalty_private.audit_loyalty_reconcile_backlog_internal(
      p_customer_phone,
      p_source_type,
      p_limit
    )
    order by sort_time asc, source_type asc, source_order_id asc, action_priority asc
  loop
    if coalesce(p_dry_run, true) then
      return query
      select
        v_result.source_type,
        v_result.source_order_id,
        v_result.customer_phone,
        v_result.order_code,
        v_result.order_status,
        v_result.action,
        v_result.expected_points,
        v_result.points_spent,
        true as ok,
        false as applied,
        null::text as event_id,
        case
          when v_result.action = 'SPEND'
            then -coalesce(v_result.points_spent, 0)
          when v_result.action = 'SETTLE_EARN'
            then coalesce(v_result.expected_points, 0)
          when v_result.action = 'REVERSE_SPEND'
            then coalesce(v_result.points_spent, 0)
          when v_result.action = 'REVERSE_EARN'
            then -coalesce(v_result.expected_points, 0)
          else coalesce(v_result.expected_points, 0)
        end as points_delta,
        null::integer as balance_before,
        null::integer as balance_after,
        'DRY_RUN'::text as message;
    else
      v_idempotency_key :=
        left(
          'loyalty-v2:' || v_result.source_type || ':' || v_result.source_order_id || ':' || v_result.action || ':v1',
          200
        );

      begin
        select *
        into v_rpc
        from loyalty_private.process_order_loyalty_internal(
          v_result.source_type,
          v_result.source_order_id,
          v_result.action,
          v_idempotency_key
        );
      exception when others then
        v_error_message := coalesce(sqlerrm, 'UNKNOWN_RECONCILE_ERROR');
        return query
        select
          v_result.source_type,
          v_result.source_order_id,
          v_result.customer_phone,
          v_result.order_code,
          v_result.order_status,
          v_result.action,
          v_result.expected_points,
          v_result.points_spent,
          false as ok,
          false as applied,
          null::text as event_id,
          0 as points_delta,
          null::integer as balance_before,
          null::integer as balance_after,
          v_error_message;
        continue;
      end;

      return query
      select
        v_result.source_type,
        v_result.source_order_id,
        v_result.customer_phone,
        v_result.order_code,
        v_result.order_status,
        v_result.action,
        v_result.expected_points,
        v_result.points_spent,
        coalesce(v_rpc.ok, false),
        coalesce(v_rpc.applied, false),
        v_rpc.event_id,
        coalesce(v_rpc.points_delta, 0),
        v_rpc.balance_before,
        v_rpc.balance_after,
        coalesce(v_rpc.message, '');
    end if;
  end loop;
end;
$$;

create or replace function public.reconcile_loyalty_backlog(
  p_customer_phone text default null,
  p_source_type text default null,
  p_limit integer default 200,
  p_dry_run boolean default true
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
  ok boolean,
  applied boolean,
  event_id text,
  points_delta integer,
  balance_before integer,
  balance_after integer,
  message text
)
language sql
security invoker
set search_path = pg_catalog, public, loyalty_private
as $$
  select *
  from loyalty_private.reconcile_loyalty_backlog_internal(
    p_customer_phone,
    p_source_type,
    p_limit,
    p_dry_run
  );
$$;

revoke all on function loyalty_private.audit_loyalty_reconcile_backlog_internal(text, text, integer)
from public, anon;
grant execute on function loyalty_private.audit_loyalty_reconcile_backlog_internal(text, text, integer)
to authenticated, service_role;

revoke all on function loyalty_private.reconcile_loyalty_backlog_internal(text, text, integer, boolean)
from public, anon;
grant execute on function loyalty_private.reconcile_loyalty_backlog_internal(text, text, integer, boolean)
to authenticated, service_role;

revoke execute on function public.audit_loyalty_reconcile_backlog(text, text, integer)
from public, anon;
grant execute on function public.audit_loyalty_reconcile_backlog(text, text, integer)
to authenticated, service_role;

revoke execute on function public.reconcile_loyalty_backlog(text, text, integer, boolean)
from public, anon;
grant execute on function public.reconcile_loyalty_backlog(text, text, integer, boolean)
to authenticated, service_role;

comment on function public.audit_loyalty_reconcile_backlog(text, text, integer) is
  'Audit backlog loyalty còn thiếu bút toán cho web orders và reverse backlog an toàn.';

comment on function public.reconcile_loyalty_backlog(text, text, integer, boolean) is
  'Dry-run hoặc reconcile backlog loyalty bằng chính engine process_order_loyalty hiện hành.';

notify pgrst, 'reload schema';
