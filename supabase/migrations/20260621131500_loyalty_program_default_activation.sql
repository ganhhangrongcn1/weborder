-- Loyalty program - Phase 3.1 default activation.
-- Activates the agreed five tiers only when production still has a legacy rule.

begin;

do $$
declare
  v_existing_config jsonb := '{}'::jsonb;
  v_program_config jsonb;
  v_active_rule public.loyalty_rule_versions%rowtype;
  v_account record;
  v_spend numeric;
  v_last_purchase timestamptz;
  v_tier jsonb;
begin
  select coalesce(value, '{}'::jsonb)
  into v_existing_config
  from public.app_configs
  where id = 'ghr_loyalty';

  v_program_config := coalesce(v_existing_config, '{}'::jsonb) || jsonb_build_object(
    'schemaVersion', 3,
    'enabled', true,
    'currencyPerPoint', 100,
    'pointPerUnit', 10,
    'redeemPointUnit', 1,
    'redeemValue', 1,
    'maxRedemptionPercent', 50,
    'pointsExpiryMonths', 12,
    'pointsExpiryMode', 'LAST_PURCHASE',
    'tierCycleMonths', 12,
    'tierCycleMode', 'CALENDAR_YEAR',
    'checkinEnabled', coalesce((v_existing_config ->> 'checkinEnabled')::boolean, true),
    'checkinDailyPoints', greatest(coalesce((v_existing_config ->> 'checkinDailyPoints')::integer, 100), 0),
    'streakRewards', coalesce(v_existing_config -> 'streakRewards', jsonb_build_object(
      '7', 700,
      '14', 1500,
      '30', 3000
    )),
    'tiers', jsonb_build_array(
      jsonb_build_object(
        'id', 'new_customer', 'name', 'Khách Mới', 'minAnnualSpend', 0,
        'currencyPerPoint', 100, 'pointPerUnit', 10,
        'milestoneVoucherId', '', 'enabled', true
      ),
      jsonb_build_object(
        'id', 'returning_customer', 'name', 'Khách Quen', 'minAnnualSpend', 1000000,
        'currencyPerPoint', 100, 'pointPerUnit', 11,
        'milestoneVoucherId', '', 'enabled', true
      ),
      jsonb_build_object(
        'id', 'super_fan', 'name', 'Fan Cứng', 'minAnnualSpend', 2500000,
        'currencyPerPoint', 100, 'pointPerUnit', 12,
        'milestoneVoucherId', '', 'enabled', true
      ),
      jsonb_build_object(
        'id', 'inner_circle_fan', 'name', 'Fan Ruột', 'minAnnualSpend', 5000000,
        'currencyPerPoint', 100, 'pointPerUnit', 13,
        'milestoneVoucherId', '', 'enabled', true
      ),
      jsonb_build_object(
        'id', 'ganh_legend', 'name', 'Huyền Thoại Gánh', 'minAnnualSpend', 10000000,
        'currencyPerPoint', 100, 'pointPerUnit', 15,
        'milestoneVoucherId', '', 'enabled', true
      )
    ),
    'source', 'loyalty_program_v3_default_activation'
  );

  select * into v_active_rule
  from public.loyalty_rule_versions
  where status = 'ACTIVE'
  order by effective_from desc, version_number desc
  limit 1;

  if jsonb_typeof(v_active_rule.source_config -> 'tiers') <> 'array'
    or jsonb_array_length(coalesce(v_active_rule.source_config -> 'tiers', '[]'::jsonb)) <> 5
  then
    update public.loyalty_rule_versions
    set status = 'RETIRED', retired_at = now()
    where status = 'ACTIVE';

    insert into public.loyalty_rule_versions (
      status, effective_from, earn_numerator, earn_denominator,
      redeem_point_unit, redeem_value, checkin_daily_points,
      streak_rewards, source_config
    ) values (
      'ACTIVE', now(), 10, 100, 1, 1,
      greatest(coalesce((v_program_config ->> 'checkinDailyPoints')::integer, 0), 0),
      coalesce(v_program_config -> 'streakRewards', '{}'::jsonb),
      v_program_config
    )
    returning * into v_active_rule;
  end if;

  insert into public.app_configs (id, value, updated_at)
  values ('ghr_loyalty', v_program_config, now())
  on conflict (id) do update
  set value = excluded.value, updated_at = excluded.updated_at;

  for v_account in
    select customer_phone, last_purchase_at, points_expires_at
    from public.loyalty_accounts
    for update
  loop
    select greatest(coalesce(sum(
      case
        when ll.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN') then greatest(coalesce(ll.amount, 0), 0)
        when ll.action = 'REVERSE_EARN' then -greatest(coalesce(ll.amount, 0), 0)
        else 0
      end
    ), 0), 0)
    into v_spend
    from public.loyalty_ledger ll
    where public.normalize_vietnam_phone(ll.customer_phone) = v_account.customer_phone
      and ll.created_at >= date_trunc('year', now())
      and ll.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN', 'REVERSE_EARN');

    select max(ll.created_at)
    into v_last_purchase
    from public.loyalty_ledger ll
    where public.normalize_vietnam_phone(ll.customer_phone) = v_account.customer_phone
      and ll.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN');

    v_tier := loyalty_private.resolve_program_tier(v_active_rule, v_spend);
    update public.loyalty_accounts
    set
      tier_id = v_tier ->> 'id',
      tier_cycle_year = extract(year from now())::integer,
      tier_qualifying_spend = v_spend,
      tier_qualified_at = coalesce(tier_qualified_at, now()),
      last_purchase_at = coalesce(last_purchase_at, v_last_purchase),
      points_expires_at = case
        when coalesce(last_purchase_at, v_last_purchase) is not null
          then coalesce(last_purchase_at, v_last_purchase) + interval '12 months'
        else points_expires_at
      end,
      updated_at = now()
    where customer_phone = v_account.customer_phone;
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;
