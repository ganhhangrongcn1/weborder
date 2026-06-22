-- Loyalty program - Phase 1 configuration foundation.
-- Additive and safe to deploy before the runtime engine is switched to tier rules.

begin;

create or replace function loyalty_private.activate_program_rule_internal(
  p_program_config jsonb,
  p_idempotency_key text
)
returns table (
  ok boolean,
  rule_version_id uuid,
  version_number bigint,
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
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_config jsonb := coalesce(p_program_config, '{}'::jsonb);
  v_tiers jsonb;
  v_tier record;
  v_previous_spend numeric := -1;
  v_previous_rate numeric := -1;
  v_rate numeric;
  v_min_spend numeric;
  v_earn_numerator bigint;
  v_earn_denominator bigint;
  v_existing public.loyalty_rule_versions%rowtype;
  v_new public.loyalty_rule_versions%rowtype;
begin
  select *
  into v_actor_type, v_actor_id, v_actor_phone, v_actor_role
  from loyalty_private.current_actor();

  if v_actor_role <> 'admin' then
    raise exception 'Chỉ admin được thay đổi chương trình loyalty.';
  end if;
  if v_key = '' or length(v_key) > 200 then
    raise exception 'Idempotency key không hợp lệ.';
  end if;
  if jsonb_typeof(v_config) <> 'object' then
    raise exception 'Cấu hình loyalty phải là một object JSON.';
  end if;

  v_tiers := v_config -> 'tiers';
  if jsonb_typeof(v_tiers) <> 'array' or jsonb_array_length(v_tiers) <> 5 then
    raise exception 'Chương trình loyalty phải có đúng 5 hạng thành viên.';
  end if;
  if (
    select count(distinct trim(value ->> 'id'))
    from jsonb_array_elements(v_tiers)
  ) <> 5 then
    raise exception 'Mỗi hạng thành viên phải có mã riêng.';
  end if;

  for v_tier in
    select value, ordinality
    from jsonb_array_elements(v_tiers) with ordinality
    order by ordinality
  loop
    if trim(coalesce(v_tier.value ->> 'id', '')) = ''
      or trim(coalesce(v_tier.value ->> 'name', '')) = '' then
      raise exception 'Hạng thành viên thiếu mã hoặc tên.';
    end if;
    if coalesce(v_tier.value ->> 'minAnnualSpend', '') !~ '^\d+$'
      or coalesce(v_tier.value ->> 'currencyPerPoint', '') !~ '^\d+$'
      or coalesce(v_tier.value ->> 'pointPerUnit', '') !~ '^\d+$' then
      raise exception 'Mốc chi tiêu và tỷ lệ tích điểm phải là số nguyên không âm.';
    end if;

    v_min_spend := (v_tier.value ->> 'minAnnualSpend')::numeric;
    v_earn_denominator := (v_tier.value ->> 'currencyPerPoint')::bigint;
    v_earn_numerator := (v_tier.value ->> 'pointPerUnit')::bigint;
    if v_earn_denominator <= 0 or v_earn_numerator <= 0 then
      raise exception 'Tỷ lệ tích điểm phải lớn hơn 0.';
    end if;

    v_rate := v_earn_numerator::numeric * 100 / v_earn_denominator::numeric;
    if v_tier.ordinality = 1 and (v_min_spend <> 0 or v_rate <> 10) then
      raise exception 'Hạng đầu tiên phải bắt đầu từ 0đ và tích điểm 10%%.';
    end if;
    if v_tier.ordinality = 5 and v_rate <> 15 then
      raise exception 'Hạng cao nhất phải tích điểm đúng 15%%.';
    end if;
    if v_rate < 10 or v_rate > 15 then
      raise exception 'Tỷ lệ tích điểm mỗi hạng phải nằm trong khoảng 10%% đến 15%%.';
    end if;
    if v_min_spend <= v_previous_spend or v_rate < v_previous_rate then
      raise exception 'Mốc chi tiêu và tỷ lệ tích điểm phải tăng dần theo hạng.';
    end if;
    v_previous_spend := v_min_spend;
    v_previous_rate := v_rate;
  end loop;

  if coalesce(v_config ->> 'redeemPointUnit', '') <> '1'
    or coalesce(v_config ->> 'redeemValue', '') <> '1' then
    raise exception 'Quy đổi điểm phải giữ đúng 1 điểm = 1đ.';
  end if;
  if coalesce(v_config ->> 'maxRedemptionPercent', '') <> '50' then
    raise exception 'Giới hạn sử dụng điểm phải là 50%% giá trị đơn hợp lệ.';
  end if;
  if coalesce(v_config ->> 'pointsExpiryMode', '') <> 'LAST_PURCHASE'
    or coalesce(v_config ->> 'pointsExpiryMonths', '') <> '12' then
    raise exception 'Điểm phải hết hạn sau 12 tháng kể từ lần mua gần nhất.';
  end if;
  if coalesce(v_config ->> 'tierCycleMode', '') <> 'CALENDAR_YEAR'
    or coalesce(v_config ->> 'tierCycleMonths', '') <> '12' then
    raise exception 'Chu kỳ hạng phải được xét theo năm.';
  end if;

  select * into v_existing
  from public.loyalty_rule_versions
  where source_config ->> 'idempotencyKey' = v_key
  order by created_at
  limit 1;

  if found then
    return query select true, v_existing.id, v_existing.version_number,
      'Phiên bản cấu hình đã được tạo trước đó.';
    return;
  end if;

  v_config := v_config || jsonb_build_object(
    'schemaVersion', 3,
    'enabled', true,
    'currencyPerPoint', (v_tiers -> 0 ->> 'currencyPerPoint')::bigint,
    'pointPerUnit', (v_tiers -> 0 ->> 'pointPerUnit')::bigint,
    'idempotencyKey', v_key,
    'source', 'loyalty_program_v3'
  );

  update public.loyalty_rule_versions
  set status = 'RETIRED', retired_at = now()
  where status = 'ACTIVE';

  insert into public.loyalty_rule_versions (
    status,
    effective_from,
    earn_numerator,
    earn_denominator,
    redeem_point_unit,
    redeem_value,
    checkin_daily_points,
    streak_rewards,
    source_config,
    created_by
  ) values (
    'ACTIVE',
    now(),
    (v_tiers -> 0 ->> 'pointPerUnit')::bigint,
    (v_tiers -> 0 ->> 'currencyPerPoint')::bigint,
    1,
    1,
    greatest(coalesce((v_config ->> 'checkinDailyPoints')::integer, 0), 0),
    coalesce(v_config -> 'streakRewards', '{}'::jsonb),
    v_config,
    auth.uid()
  )
  returning * into v_new;

  insert into public.app_configs (id, value, updated_at)
  values ('ghr_loyalty', v_config, now())
  on conflict (id) do update
  set value = excluded.value, updated_at = excluded.updated_at;

  return query select true, v_new.id, v_new.version_number,
    'Đã kích hoạt cấu hình loyalty mới; đơn cũ giữ nguyên phiên bản đã chụp.';
end;
$$;

create or replace function public.activate_loyalty_program_version(
  p_program_config jsonb,
  p_idempotency_key text
)
returns table (
  ok boolean,
  rule_version_id uuid,
  version_number bigint,
  message text
)
language sql
security invoker
set search_path = pg_catalog, public, loyalty_private
as $$
  select * from loyalty_private.activate_program_rule_internal(
    p_program_config,
    p_idempotency_key
  );
$$;

revoke all on function loyalty_private.activate_program_rule_internal(jsonb, text)
from public, anon;
grant execute on function loyalty_private.activate_program_rule_internal(jsonb, text)
to authenticated, service_role;

revoke execute on function public.activate_loyalty_program_version(jsonb, text)
from public, anon;
grant execute on function public.activate_loyalty_program_version(jsonb, text)
to authenticated, service_role;

comment on function public.activate_loyalty_program_version(jsonb, text) is
  'Atomically activates the validated five-tier loyalty program and updates ghr_loyalty.';

notify pgrst, 'reload schema';

commit;
