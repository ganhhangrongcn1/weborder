-- Audit trước và sau khi triển khai giới hạn nhận điểm đơn đối tác 7 ngày.

with function_rows as (
  select
    p.oid::regprocedure::text as signature,
    p.prosecdef as security_definer,
    p.proconfig as settings,
    md5(pg_get_functiondef(p.oid)) as definition_hash
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_customer_order_count_summary',
      'get_customer_order_point_statuses',
      'process_order_loyalty'
    )
),
column_rows as (
  select table_name, column_name, data_type, ordinal_position
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('partner_orders', 'loyalty_ledger')
    and column_name in (
      'id', 'order_time', 'created_at', 'point_status', 'entry_type',
      'partner_order_id', 'source_order_id', 'net_received_amount',
      'loyalty_hold_reason'
    )
),
order_counts as (
  select
    count(*) filter (
      where lower(trim(coalesce(point_status, 'pending'))) not in ('claimed', 'rejected', 'expired')
        and coalesce(order_time, created_at) <= now() - interval '7 days'
    ) as expired_unclaimed,
    count(*) filter (
      where lower(trim(coalesce(point_status, 'pending'))) = 'claimed'
        and coalesce(order_time, created_at) <= now() - interval '7 days'
    ) as old_claimed
  from public.partner_orders
),
trigger_rows as (
  select t.tgname as name, t.tgenabled as enabled
  from pg_trigger t
  where t.tgrelid = 'public.loyalty_ledger'::regclass
    and not t.tgisinternal
),
grant_rows as (
  select routine_name, grantee, privilege_type
  from information_schema.routine_privileges
  where specific_schema = 'public'
    and routine_name in (
      'get_customer_order_count_summary',
      'get_customer_order_point_statuses',
      'process_order_loyalty'
    )
)
select jsonb_pretty(jsonb_build_object(
  'functions', (
    select coalesce(jsonb_agg(to_jsonb(f) order by f.signature), '[]'::jsonb)
    from function_rows f
  ),
  'columns', (
    select coalesce(jsonb_agg(to_jsonb(c) - 'ordinal_position' order by c.table_name, c.ordinal_position), '[]'::jsonb)
    from column_rows c
  ),
  'counts', (
    select to_jsonb(oc)
    from order_counts oc
  ),
  'triggers', (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.name), '[]'::jsonb)
    from trigger_rows t
  ),
  'grants', (
    select coalesce(jsonb_agg(to_jsonb(g) order by g.routine_name, g.grantee), '[]'::jsonb)
    from grant_rows g
  )
)) as audit;
