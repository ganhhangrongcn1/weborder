-- Audit chỉ đọc trước khi retire RPC loyalty cũ.
-- Chỉ được drop sau khi tất cả máy POS đã cài bản gọi process_order_loyalty.

select
  to_regprocedure(
    'public.apply_loyalty_event(text,text,integer,text,numeric,text,text,jsonb,timestamptz)'
  ) is not null as legacy_apply_rpc_exists,
  to_regprocedure('public.can_apply_loyalty_event(text,text)') is not null
    as legacy_guard_rpc_exists,
  to_regprocedure('public.process_order_loyalty(text,text,text,text)') is not null
    as loyalty_v2_rpc_exists,
  has_function_privilege(
    'authenticated',
    'public.process_order_loyalty(text,text,text,text)',
    'EXECUTE'
  ) as authenticated_can_call_loyalty_v2;

select
  n.nspname as schema_name,
  p.oid::regprocedure::text as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.oid not in (
    coalesce(
      to_regprocedure(
        'public.apply_loyalty_event(text,text,integer,text,numeric,text,text,jsonb,timestamptz)'
      )::oid,
      0
    ),
    coalesce(to_regprocedure('public.can_apply_loyalty_event(text,text)')::oid, 0)
  )
  and (
    p.prosrc ilike '%apply_loyalty_event%'
    or p.prosrc ilike '%can_apply_loyalty_event%'
  )
order by n.nspname, function_name;

select
  max(created_at) at time zone 'Asia/Bangkok' as last_legacy_event_local,
  count(*) filter (
    where created_at >= now() - interval '24 hours'
  ) as legacy_events_last_24_hours
from public.loyalty_ledger
where coalesce(metadata->>'source', '') = 'apply_loyalty_event';
