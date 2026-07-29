-- Smoke test read-only cho RPC báo cáo Phase 4.

begin;

select set_config(
  'request.jwt.claims',
  (select json_build_object('sub', auth_user_id::text, 'role', 'authenticated')::text
   from public.profiles
   where lower(role) = 'admin' and lower(status) = 'active' and auth_user_id is not null
   limit 1),
  true
);

set local role authenticated;

do $$
declare
  supervision_report jsonb;
  employee_report jsonb;
begin
  supervision_report := public.get_checklist_supervision_report(current_date - 30, current_date, null);
  employee_report := public.get_checklist_employee_monthly_report(current_date, null);

  if supervision_report -> 'summary' is null or supervision_report -> 'history' is null then
    raise exception 'Báo cáo giám sát thiếu cấu trúc bắt buộc.';
  end if;

  if employee_report -> 'summary' is null or employee_report -> 'employees' is null then
    raise exception 'Báo cáo nhân viên thiếu cấu trúc bắt buộc.';
  end if;
end;
$$;

rollback;
