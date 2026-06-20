begin transaction read only;

do $$
declare
  v_active_rule_count bigint;
  v_orders_missing bigint;
  v_partner_orders_missing bigint;
  v_account_total bigint;
  v_ledger_total bigint;
  v_duplicate_idempotency bigint;
  v_duplicate_business_events bigint;
begin
  select count(*)
  into v_active_rule_count
  from public.loyalty_rule_versions
  where status = 'ACTIVE';

  if v_active_rule_count <> 1 then
    raise exception 'Expected exactly 1 active loyalty rule version, got %', v_active_rule_count;
  end if;

  select count(*)
  into v_orders_missing
  from public.orders
  where loyalty_rule_version_id is null
     or points_base_amount is null
     or expected_earn_points is null
     or points_spent is null
     or points_discount_amount is null;

  if v_orders_missing <> 0 then
    raise exception 'Orders missing loyalty V2 snapshot fields: %', v_orders_missing;
  end if;

  select count(*)
  into v_partner_orders_missing
  from public.partner_orders
  where loyalty_rule_version_id is null
     or expected_earn_points is null
     or points_spent is null
     or points_discount_amount is null;

  if v_partner_orders_missing <> 0 then
    raise exception 'Partner orders missing loyalty V2 snapshot fields: %', v_partner_orders_missing;
  end if;

  select coalesce(sum(total_points), 0)
  into v_account_total
  from public.loyalty_accounts;

  select coalesce(sum(points), 0)
  into v_ledger_total
  from public.loyalty_ledger;

  if v_account_total <> v_ledger_total then
    raise exception 'Account total % does not match ledger total %', v_account_total, v_ledger_total;
  end if;

  select count(*)
  into v_duplicate_idempotency
  from (
    select idempotency_key
    from public.loyalty_ledger
    where idempotency_key is not null
    group by idempotency_key
    having count(*) > 1
  ) duplicates;

  if v_duplicate_idempotency <> 0 then
    raise exception 'Duplicate idempotency keys found: %', v_duplicate_idempotency;
  end if;

  select count(*)
  into v_duplicate_business_events
  from (
    select source_type, source_order_id, action, action_version
    from public.loyalty_ledger
    where source_type is not null
      and action is not null
    group by source_type, source_order_id, action, action_version
    having count(*) > 1
  ) duplicates;

  if v_duplicate_business_events <> 0 then
    raise exception 'Duplicate business event groups found: %', v_duplicate_business_events;
  end if;

  if to_regprocedure('public.process_order_loyalty(text,text,text,text)') is null then
    raise exception 'Missing function public.process_order_loyalty(text,text,text,text)';
  end if;

  if to_regprocedure('public.process_loyalty_checkin(text)') is null then
    raise exception 'Missing function public.process_loyalty_checkin(text)';
  end if;

  if to_regprocedure('public.admin_adjust_loyalty_points(text,integer,text,text)') is null then
    raise exception 'Missing function public.admin_adjust_loyalty_points(text,integer,text,text)';
  end if;

  if to_regprocedure('public.activate_loyalty_rule_version(bigint,bigint,bigint,bigint,integer,jsonb,text)') is null then
    raise exception 'Missing function public.activate_loyalty_rule_version(bigint,bigint,bigint,bigint,integer,jsonb,text)';
  end if;

  if has_function_privilege('anon', 'public.process_order_loyalty(text,text,text,text)', 'EXECUTE') then
    raise exception 'anon still has execute privilege on public.process_order_loyalty';
  end if;
end $$;

select
  count(*) filter (where status = 'ACTIVE')::bigint as active_rule_count,
  (
    select count(*)
    from public.orders
    where loyalty_rule_version_id is null
       or points_base_amount is null
       or expected_earn_points is null
       or points_spent is null
       or points_discount_amount is null
  )::bigint as orders_missing_snapshot,
  (
    select count(*)
    from public.partner_orders
    where loyalty_rule_version_id is null
       or expected_earn_points is null
       or points_spent is null
       or points_discount_amount is null
  )::bigint as partner_orders_missing_snapshot,
  (
    select coalesce(sum(total_points), 0)::bigint
    from public.loyalty_accounts
  ) as account_total,
  (
    select coalesce(sum(points), 0)::bigint
    from public.loyalty_ledger
  ) as ledger_total,
  exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name in ('apply_loyalty_event', 'claim_partner_order_points')
      and grantee in ('anon', 'authenticated', 'PUBLIC')
  ) as legacy_runtime_still_available
from public.loyalty_rule_versions;

rollback;
