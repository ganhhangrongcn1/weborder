-- Loyalty V2 - Phase 2 postcheck (READ ONLY)
-- Chạy sau migration foundation, trước khi chuyển bất kỳ traffic nào sang V2.

begin transaction read only;

select
  'P01_active_rule' as check_name,
  count(*)::bigint as active_count,
  count(*) = 1 as ok
from public.loyalty_rule_versions
where status = 'ACTIVE';

select
  'P02_order_snapshot' as check_name,
  count(*) filter (
    where loyalty_rule_version_id is null
       or points_base_amount is null
       or expected_earn_points is null
       or points_spent is null
       or points_discount_amount is null
  )::bigint as missing_count,
  count(*) filter (
    where loyalty_rule_version_id is null
       or points_base_amount is null
       or expected_earn_points is null
       or points_spent is null
       or points_discount_amount is null
  ) = 0 as ok
from public.orders;

select
  'P03_partner_snapshot' as check_name,
  count(*) filter (
    where loyalty_rule_version_id is null
       or expected_earn_points is null
       or points_spent is null
       or points_discount_amount is null
  )::bigint as missing_count,
  count(*) filter (
    where loyalty_rule_version_id is null
       or expected_earn_points is null
       or points_spent is null
       or points_discount_amount is null
  ) = 0 as ok
from public.partner_orders;

select
  'P04_balance_totals' as check_name,
  coalesce((select sum(total_points) from public.loyalty_accounts), 0)::bigint as account_total,
  coalesce((select sum(points) from public.loyalty_ledger), 0)::bigint as ledger_total,
  coalesce((select sum(total_points) from public.loyalty_accounts), 0)::bigint
    = coalesce((select sum(points) from public.loyalty_ledger), 0)::bigint as ok;

select
  'P05_v2_duplicate_business_events' as check_name,
  count(*)::bigint as duplicate_count,
  count(*) = 0 as ok
from (
  select source_type, source_order_id, action, action_version
  from public.loyalty_ledger
  where source_type is not null and action is not null
  group by source_type, source_order_id, action, action_version
  having count(*) > 1
) duplicates;

select
  'P06_v2_duplicate_idempotency' as check_name,
  count(*)::bigint as duplicate_count,
  count(*) = 0 as ok
from (
  select idempotency_key
  from public.loyalty_ledger
  where idempotency_key is not null
  group by idempotency_key
  having count(*) > 1
) duplicates;

select
  'P07_invalid_v2_sign' as check_name,
  count(*)::bigint as invalid_count,
  count(*) = 0 as ok
from public.loyalty_ledger
where action is not null
  and not (
    (action in ('SETTLE_EARN', 'REVERSE_SPEND', 'CLAIM_PARTNER_EARN', 'CHECKIN', 'MILESTONE') and points > 0)
    or (action in ('SPEND', 'REVERSE_EARN') and points < 0)
    or (action = 'ADMIN_ADJUST' and points <> 0)
  );

select
  'P08_required_functions' as check_name,
  f.function_name,
  to_regprocedure(f.signature) is not null as ok
from (
  values
    ('process_order_loyalty', 'public.process_order_loyalty(text,text,text,text)'),
    ('process_loyalty_checkin', 'public.process_loyalty_checkin(text)'),
    ('admin_adjust_loyalty_points', 'public.admin_adjust_loyalty_points(text,integer,text,text)'),
    ('activate_loyalty_rule_version', 'public.activate_loyalty_rule_version(bigint,bigint,bigint,bigint,integer,jsonb,text)')
) as f(function_name, signature);

select
  'P09_anon_v2_execute' as check_name,
  routine_name,
  count(*)::bigint as unexpected_grant_count,
  count(*) = 0 as ok
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in (
    'process_order_loyalty',
    'process_loyalty_checkin',
    'admin_adjust_loyalty_points',
    'activate_loyalty_rule_version'
  )
  and grantee in ('PUBLIC', 'anon')
group by routine_name
order by routine_name;

select
  'P10_snapshot_trigger' as check_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  t.tgenabled <> 'D' as ok
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and t.tgname in ('orders_snapshot_loyalty_v2', 'partner_orders_snapshot_loyalty_v2')
  and not t.tgisinternal
order by c.relname;

-- Phase 2 additive: các quyền legacy vẫn còn cho đến security cutover.
select
  'P11_legacy_cutover_pending' as check_name,
  exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name in ('apply_loyalty_event', 'claim_partner_order_points')
      and grantee in ('anon', 'authenticated', 'PUBLIC')
  ) as legacy_runtime_still_available,
  true as expected_before_cutover;

rollback;
