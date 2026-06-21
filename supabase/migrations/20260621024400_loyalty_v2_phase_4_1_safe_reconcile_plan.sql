-- Phase 4.1: tách backlog loyalty thành nhóm safe / suspicious
-- và chỉ reconcile tự động nhóm safe.

create or replace function loyalty_private.audit_loyalty_reconcile_plan_internal(
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
  sort_time timestamptz,
  event_delta integer,
  current_balance integer,
  batch_balance_before integer,
  batch_balance_after integer,
  can_auto_apply boolean,
  classification text,
  suspicious_reason text
)
language sql
stable
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
  with recursive ordered as (
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
      c.sort_time,
      case
        when c.action = 'SPEND' then -coalesce(c.points_spent, 0)
        when c.action = 'SETTLE_EARN' then coalesce(c.expected_points, 0)
        when c.action = 'REVERSE_SPEND' then coalesce(c.points_spent, 0)
        when c.action = 'REVERSE_EARN' then -coalesce(c.expected_points, 0)
        else 0
      end::integer as event_delta,
      coalesce(la.total_points, 0)::integer as current_balance,
      case
        when c.action in ('SPEND', 'REVERSE_SPEND') and coalesce(c.points_spent, 0) <= 0
          then 'invalid_points_spent_snapshot'
        when c.action in ('SETTLE_EARN', 'REVERSE_EARN') and coalesce(c.expected_points, 0) <= 0
          then 'invalid_expected_earn_snapshot'
        else null
      end::text as snapshot_issue,
      row_number() over (
        partition by c.customer_phone
        order by c.sort_time asc, c.source_type asc, c.source_order_id asc, c.action_priority asc, c.action asc
      ) as rn
    from loyalty_private.audit_loyalty_reconcile_backlog_internal(
      p_customer_phone,
      p_source_type,
      p_limit
    ) c
    left join public.loyalty_accounts la
      on la.customer_phone = c.customer_phone
  ),
  recursive_plan as (
    select
      o.source_type,
      o.source_order_id,
      o.customer_phone,
      o.order_code,
      o.order_status,
      o.action,
      o.expected_points,
      o.points_spent,
      o.detected_reason,
      o.action_priority,
      o.sort_time,
      o.event_delta,
      o.current_balance,
      o.current_balance as batch_balance_before,
      case
        when o.snapshot_issue is not null then o.current_balance
        when o.event_delta < 0 and o.current_balance + o.event_delta < 0 then o.current_balance
        else o.current_balance + o.event_delta
      end::integer as batch_balance_after,
      case
        when o.snapshot_issue is not null then false
        when o.event_delta < 0 and o.current_balance + o.event_delta < 0 then false
        else true
      end as can_auto_apply,
      case
        when o.snapshot_issue is not null then o.snapshot_issue
        when o.event_delta < 0 and o.current_balance + o.event_delta < 0
          then 'insufficient_current_balance_for_negative_backfill'
        else null
      end::text as suspicious_reason,
      o.rn
    from ordered o
    where o.rn = 1

    union all

    select
      o.source_type,
      o.source_order_id,
      o.customer_phone,
      o.order_code,
      o.order_status,
      o.action,
      o.expected_points,
      o.points_spent,
      o.detected_reason,
      o.action_priority,
      o.sort_time,
      o.event_delta,
      o.current_balance,
      p.batch_balance_after as batch_balance_before,
      case
        when o.snapshot_issue is not null then p.batch_balance_after
        when o.event_delta < 0 and p.batch_balance_after + o.event_delta < 0 then p.batch_balance_after
        else p.batch_balance_after + o.event_delta
      end::integer as batch_balance_after,
      case
        when o.snapshot_issue is not null then false
        when o.event_delta < 0 and p.batch_balance_after + o.event_delta < 0 then false
        else true
      end as can_auto_apply,
      case
        when o.snapshot_issue is not null then o.snapshot_issue
        when o.event_delta < 0 and p.batch_balance_after + o.event_delta < 0
          then 'insufficient_current_balance_for_negative_backfill'
        else null
      end::text as suspicious_reason,
      o.rn
    from ordered o
    join recursive_plan p
      on p.customer_phone = o.customer_phone
     and o.rn = p.rn + 1
  )
  select
    p.source_type,
    p.source_order_id,
    p.customer_phone,
    p.order_code,
    p.order_status,
    p.action,
    p.expected_points,
    p.points_spent,
    p.detected_reason,
    p.action_priority,
    p.sort_time,
    p.event_delta,
    p.current_balance,
    p.batch_balance_before,
    p.batch_balance_after,
    p.can_auto_apply,
    case when p.can_auto_apply then 'safe' else 'suspicious' end as classification,
    p.suspicious_reason
  from recursive_plan p
  order by p.sort_time asc, p.source_type asc, p.source_order_id asc, p.action_priority asc, p.action asc;
$$;

create or replace function public.audit_loyalty_reconcile_plan(
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
  sort_time timestamptz,
  event_delta integer,
  current_balance integer,
  batch_balance_before integer,
  batch_balance_after integer,
  can_auto_apply boolean,
  classification text,
  suspicious_reason text
)
language sql
security invoker
set search_path = pg_catalog, public, loyalty_private
as $$
  select *
  from loyalty_private.audit_loyalty_reconcile_plan_internal(
    p_customer_phone,
    p_source_type,
    p_limit
  );
$$;

create or replace function loyalty_private.reconcile_loyalty_backlog_safe_internal(
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
  classification text,
  suspicious_reason text,
  expected_points integer,
  points_spent integer,
  points_delta integer,
  ok boolean,
  applied boolean,
  event_id text,
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
    raise exception 'Chỉ admin hoặc service_role mới được reconcile safe backlog loyalty.';
  end if;

  for v_result in
    select *
    from loyalty_private.audit_loyalty_reconcile_plan_internal(
      p_customer_phone,
      p_source_type,
      p_limit
    )
    where can_auto_apply
    order by sort_time asc, source_type asc, source_order_id asc, action_priority asc, action asc
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
        v_result.classification,
        v_result.suspicious_reason,
        v_result.expected_points,
        v_result.points_spent,
        v_result.event_delta,
        true as ok,
        false as applied,
        null::text as event_id,
        v_result.batch_balance_before,
        v_result.batch_balance_after,
        'DRY_RUN_SAFE'::text as message;
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
        v_error_message := coalesce(sqlerrm, 'UNKNOWN_SAFE_RECONCILE_ERROR');
        return query
        select
          v_result.source_type,
          v_result.source_order_id,
          v_result.customer_phone,
          v_result.order_code,
          v_result.order_status,
          v_result.action,
          v_result.classification,
          v_result.suspicious_reason,
          v_result.expected_points,
          v_result.points_spent,
          v_result.event_delta,
          false as ok,
          false as applied,
          null::text as event_id,
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
        v_result.classification,
        v_result.suspicious_reason,
        v_result.expected_points,
        v_result.points_spent,
        coalesce(v_rpc.points_delta, v_result.event_delta),
        coalesce(v_rpc.ok, false),
        coalesce(v_rpc.applied, false),
        v_rpc.event_id,
        v_rpc.balance_before,
        v_rpc.balance_after,
        coalesce(v_rpc.message, '');
    end if;
  end loop;
end;
$$;

create or replace function public.reconcile_loyalty_backlog_safe(
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
  classification text,
  suspicious_reason text,
  expected_points integer,
  points_spent integer,
  points_delta integer,
  ok boolean,
  applied boolean,
  event_id text,
  balance_before integer,
  balance_after integer,
  message text
)
language sql
security invoker
set search_path = pg_catalog, public, loyalty_private
as $$
  select *
  from loyalty_private.reconcile_loyalty_backlog_safe_internal(
    p_customer_phone,
    p_source_type,
    p_limit,
    p_dry_run
  );
$$;

revoke all on function loyalty_private.audit_loyalty_reconcile_plan_internal(text, text, integer)
from public, anon;
grant execute on function loyalty_private.audit_loyalty_reconcile_plan_internal(text, text, integer)
to authenticated, service_role;

revoke all on function loyalty_private.reconcile_loyalty_backlog_safe_internal(text, text, integer, boolean)
from public, anon;
grant execute on function loyalty_private.reconcile_loyalty_backlog_safe_internal(text, text, integer, boolean)
to authenticated, service_role;

revoke execute on function public.audit_loyalty_reconcile_plan(text, text, integer)
from public, anon;
grant execute on function public.audit_loyalty_reconcile_plan(text, text, integer)
to authenticated, service_role;

revoke execute on function public.reconcile_loyalty_backlog_safe(text, text, integer, boolean)
from public, anon;
grant execute on function public.reconcile_loyalty_backlog_safe(text, text, integer, boolean)
to authenticated, service_role;

comment on function public.audit_loyalty_reconcile_plan(text, text, integer) is
  'Phân loại backlog loyalty thành safe hoặc suspicious trước khi reconcile.';

comment on function public.reconcile_loyalty_backlog_safe(text, text, integer, boolean) is
  'Chỉ reconcile tự động các bút toán backlog loyalty được đánh dấu safe.';

notify pgrst, 'reload schema';
