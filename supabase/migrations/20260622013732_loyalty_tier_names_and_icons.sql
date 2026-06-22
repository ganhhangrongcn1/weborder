-- Publish editable loyalty tier display names and stable icon keys.

begin;

do $$
declare
  v_active_rule public.loyalty_rule_versions%rowtype;
  v_config jsonb;
  v_tiers jsonb;
begin
  select * into v_active_rule
  from public.loyalty_rule_versions
  where status = 'ACTIVE' and effective_from <= now()
  order by effective_from desc, version_number desc
  limit 1;

  if not found then
    raise exception 'Không tìm thấy phiên bản loyalty đang hoạt động.';
  end if;

  select coalesce(value, v_active_rule.source_config, '{}'::jsonb)
  into v_config
  from public.app_configs
  where id = 'ghr_loyalty';

  v_config := coalesce(v_config, v_active_rule.source_config, '{}'::jsonb);
  if v_config ->> 'source' = 'loyalty_tier_identity_2026' then
    return;
  end if;

  if jsonb_typeof(v_config -> 'tiers') <> 'array'
    or jsonb_array_length(v_config -> 'tiers') <> 5
  then
    raise exception 'Cấu hình loyalty hiện tại không có đủ 5 hạng.';
  end if;

  select jsonb_agg(
    tier.value || jsonb_build_object(
      'name', case tier.value ->> 'id'
        when 'new_customer' then 'Chớm Ghiền'
        when 'returning_customer' then 'Ghiền Nhẹ'
        when 'super_fan' then 'Ghiền Thiệt'
        when 'inner_circle_fan' then 'Ghiền Chính Hiệu'
        when 'ganh_legend' then 'Huyền Thoại Gánh'
        else coalesce(tier.value ->> 'name', '')
      end,
      'iconKey', case tier.value ->> 'id'
        when 'new_customer' then 'sprout'
        when 'returning_customer' then 'smile'
        when 'super_fan' then 'flame'
        when 'inner_circle_fan' then 'crown'
        when 'ganh_legend' then 'star'
        else 'star'
      end
    )
    order by tier.ordinality
  )
  into v_tiers
  from jsonb_array_elements(v_config -> 'tiers') with ordinality as tier(value, ordinality);

  v_config := v_config || jsonb_build_object(
    'schemaVersion', 4,
    'tiers', v_tiers,
    'source', 'loyalty_tier_identity_2026',
    'idempotencyKey', 'migration:20260622013732'
  );

  update public.loyalty_rule_versions
  set status = 'RETIRED', retired_at = now()
  where status = 'ACTIVE';

  insert into public.loyalty_rule_versions (
    status, effective_from, earn_numerator, earn_denominator,
    redeem_point_unit, redeem_value, checkin_daily_points,
    streak_rewards, source_config
  ) values (
    'ACTIVE', now(),
    greatest(coalesce((v_tiers -> 0 ->> 'pointPerUnit')::bigint, 10), 1),
    greatest(coalesce((v_tiers -> 0 ->> 'currencyPerPoint')::bigint, 100), 1),
    greatest(coalesce(v_active_rule.redeem_point_unit, 1), 1),
    greatest(coalesce(v_active_rule.redeem_value, 1), 1),
    greatest(coalesce((v_config ->> 'checkinDailyPoints')::integer, 0), 0),
    coalesce(v_config -> 'streakRewards', '{}'::jsonb),
    v_config
  );

  insert into public.app_configs (id, value, updated_at)
  values ('ghr_loyalty', v_config, now())
  on conflict (id) do update
  set value = excluded.value, updated_at = excluded.updated_at;
end;
$$;

notify pgrst, 'reload schema';

commit;
