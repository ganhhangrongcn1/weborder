-- Loyalty check-in: 1,000 points/day, milestone rewards at days 7/15/30,
-- then start a new 30-day cycle on the following consecutive check-in.

begin;

create or replace function loyalty_private.prepare_checkin_30_day_cycle()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private, auth
as $$
declare
  v_actor_type text;
  v_actor_id uuid;
  v_phone text;
  v_actor_role text;
  v_business_date date := timezone('Asia/Ho_Chi_Minh', now())::date;
begin
  select *
  into v_actor_type, v_actor_id, v_phone, v_actor_role
  from loyalty_private.current_actor();

  if v_actor_role <> 'customer' or coalesce(v_phone, '') = '' then
    raise exception 'Chỉ khách hàng đã xác thực mới được điểm danh.';
  end if;

  update public.loyalty_accounts
  set
    checkin_streak = 0,
    updated_at = now()
  where customer_phone = v_phone
    and checkin_streak >= 30
    and last_checkin_date = (v_business_date - 1)::text;
end;
$$;

revoke all on function loyalty_private.prepare_checkin_30_day_cycle()
from public, anon;
grant execute on function loyalty_private.prepare_checkin_30_day_cycle()
to authenticated, service_role;

create or replace function public.process_loyalty_checkin(
  p_idempotency_key text
)
returns table (
  ok boolean,
  applied boolean,
  event_id text,
  action text,
  points_delta integer,
  balance_before integer,
  balance_after integer,
  checkin_streak integer,
  message text
)
language plpgsql
security invoker
set search_path = pg_catalog, public, loyalty_private, auth
as $$
begin
  perform loyalty_private.prepare_checkin_30_day_cycle();

  return query
  select *
  from loyalty_private.checkin_internal(
    case
      when trim(coalesce(p_idempotency_key, '')) = ''
        or length(trim(coalesce(p_idempotency_key, ''))) > 200
      then trim(coalesce(p_idempotency_key, ''))
      else concat(
        'loyalty-v2:checkin:',
        coalesce(auth.uid()::text, 'missing-auth'),
        ':',
        timezone('Asia/Ho_Chi_Minh', now())::date::text
      )
    end
  );
end;
$$;

revoke execute on function public.process_loyalty_checkin(text)
from public, anon;
grant execute on function public.process_loyalty_checkin(text)
to authenticated;

do $$
declare
  v_current_rule public.loyalty_rule_versions%rowtype;
begin
  select *
  into v_current_rule
  from public.loyalty_rule_versions
  where status = 'ACTIVE'
  order by effective_from desc, version_number desc
  limit 1
  for update;

  if not found then
    raise exception 'Chưa có phiên bản loyalty đang hoạt động để cập nhật điểm danh.';
  end if;

  update public.loyalty_rule_versions
  set status = 'RETIRED', retired_at = now()
  where id = v_current_rule.id;

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
    v_current_rule.earn_numerator,
    v_current_rule.earn_denominator,
    v_current_rule.redeem_point_unit,
    v_current_rule.redeem_value,
    1000,
    jsonb_build_object('7', 5000, '15', 10000, '30', 15000),
    coalesce(v_current_rule.source_config, '{}'::jsonb)
      || jsonb_build_object(
        'checkinEnabled', true,
        'checkinDailyPoints', 1000,
        'streakRewards', jsonb_build_object('7', 5000, '15', 10000, '30', 15000),
        'checkinCycleDays', 30,
        'source', 'loyalty_checkin_30_day_cycle'
      ),
    v_current_rule.created_by
  );
end;
$$;

update public.app_configs
set
  value = coalesce(value, '{}'::jsonb)
    || jsonb_build_object(
      'checkinEnabled', true,
      'checkinDailyPoints', 1000,
      'streakRewards', jsonb_build_object('7', 5000, '15', 10000, '30', 15000),
      'checkinCycleDays', 30
    ),
  updated_at = now()
where id = 'ghr_loyalty';

insert into public.app_configs (id, value, updated_at)
select
  'ghr_loyalty',
  jsonb_build_object(
    'enabled', true,
    'checkinEnabled', true,
    'checkinDailyPoints', 1000,
    'streakRewards', jsonb_build_object('7', 5000, '15', 10000, '30', 15000),
    'checkinCycleDays', 30
  ),
  now()
where not exists (
  select 1 from public.app_configs where id = 'ghr_loyalty'
);

insert into public.app_configs (id, value, updated_at)
values (
  'ghr_loyalty_bonus_display',
  jsonb_build_array(
    jsonb_build_object('days', 7, 'points', 5000),
    jsonb_build_object('days', 15, 'points', 10000),
    jsonb_build_object('days', 30, 'points', 15000)
  ),
  now()
)
on conflict (id) do update
set value = excluded.value, updated_at = excluded.updated_at;

notify pgrst, 'reload schema';

commit;
