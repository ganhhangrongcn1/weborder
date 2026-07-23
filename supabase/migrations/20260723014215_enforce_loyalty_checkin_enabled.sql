-- Enforce the Admin check-in toggle at the database boundary.

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
  v_checkin_enabled boolean;
begin
  select *
  into v_actor_type, v_actor_id, v_phone, v_actor_role
  from loyalty_private.current_actor();

  if v_actor_role <> 'customer' or coalesce(v_phone, '') = '' then
    raise exception 'Chỉ khách hàng đã xác thực mới được điểm danh.';
  end if;

  select coalesce((source_config ->> 'checkinEnabled')::boolean, true)
  into v_checkin_enabled
  from public.loyalty_rule_versions
  where status = 'ACTIVE'
    and effective_from <= now()
  order by effective_from desc, version_number desc
  limit 1;

  if not found or not v_checkin_enabled then
    raise exception 'Tính năng điểm danh hiện chưa được bật.';
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

comment on function loyalty_private.prepare_checkin_30_day_cycle() is
  'Validates the active check-in toggle and prepares the next 30-day customer cycle.';

notify pgrst, 'reload schema';

commit;
