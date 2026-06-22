-- Read-only audit before deploying loyalty Phase 3.

select jsonb_build_object(
  'loyalty_accounts_columns', (
    select jsonb_agg(column_name order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'loyalty_accounts'
  ),
  'orders_snapshot_columns', (
    select jsonb_object_agg(column_name, data_type)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name in (
        'loyalty_rule_version_id',
        'points_base_amount',
        'expected_earn_points',
        'points_spent',
        'points_discount_amount',
        'loyalty_tier_id',
        'loyalty_earn_numerator',
        'loyalty_earn_denominator'
      )
  ),
  'partner_snapshot_columns', (
    select jsonb_object_agg(column_name, data_type)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'partner_orders'
      and column_name in (
        'loyalty_rule_version_id',
        'points_base_amount',
        'expected_earn_points',
        'points_spent',
        'points_discount_amount',
        'net_received_amount',
        'loyalty_hold_reason',
        'loyalty_tier_id',
        'loyalty_earn_numerator',
        'loyalty_earn_denominator'
      )
  ),
  'functions', (
    select jsonb_object_agg(name, present)
    from (
      values
        ('process_order_loyalty', to_regprocedure('public.process_order_loyalty(text,text,text,text)') is not null),
        ('get_customer_order_point_status', to_regprocedure('public.get_customer_order_point_status(text,text,text)') is not null),
        ('reconcile_loyalty_order_events', to_regprocedure('public.reconcile_loyalty_order_events(boolean,integer)') is not null),
        ('activate_loyalty_program_version', to_regprocedure('public.activate_loyalty_program_version(jsonb,text)') is not null),
        ('prepare_customer_loyalty_account', to_regprocedure('public.prepare_customer_loyalty_account(text)') is not null),
        ('expire_due_loyalty_accounts', to_regprocedure('public.expire_due_loyalty_accounts(integer)') is not null)
    ) as checks(name, present)
  ),
  'coupon_columns', (
    select jsonb_agg(column_name order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'coupons'
  ),
  'loyalty_triggers', (
    select jsonb_agg(trigger_name order by trigger_name)
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table in ('loyalty_accounts', 'loyalty_ledger')
  )
) as audit;

select jsonb_build_object(
  'active_rule', (
    select jsonb_build_object(
      'id', id,
      'earn_numerator', earn_numerator,
      'earn_denominator', earn_denominator,
      'has_tiers', jsonb_typeof(source_config -> 'tiers') = 'array',
      'tier_count', coalesce(jsonb_array_length(
        case
          when jsonb_typeof(source_config -> 'tiers') = 'array' then source_config -> 'tiers'
          else '[]'::jsonb
        end
      ), 0)
    )
    from public.loyalty_rule_versions
    where status = 'ACTIVE'
    order by effective_from desc, version_number desc
    limit 1
  ),
  'app_config', (
    select jsonb_build_object(
      'schema_version', value ->> 'schemaVersion',
      'tier_count', coalesce(jsonb_array_length(
        case
          when jsonb_typeof(value -> 'tiers') = 'array' then value -> 'tiers'
          else '[]'::jsonb
        end
      ), 0),
      'max_redemption', value ->> 'maxRedemptionPercent'
    )
    from public.app_configs
    where id = 'ghr_loyalty'
  ),
  'accounts', (
    select jsonb_build_object(
      'total', count(*),
      'with_tier', count(*) filter (where tier_id is not null),
      'due', count(*) filter (where total_points > 0 and points_expires_at <= now())
    )
    from public.loyalty_accounts
  ),
  'grants_table', to_regclass('public.loyalty_milestone_grants') is not null
) as program_state;
