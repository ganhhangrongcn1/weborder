-- Smoke test có rollback cho mã nhân viên tự động.

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
  test_employee public.checklist_employees;
begin
  test_employee := public.create_checklist_employee_auto(
    'Nhân viên kiểm thử mã tự động', null, 'Nhân viên', 'active', current_date, array[]::uuid[]
  );

  if test_employee.employee_code !~ '^NV[0-9]{4,}$' then
    raise exception 'Mã tự động không đúng định dạng: %', test_employee.employee_code;
  end if;
end;
$$;

rollback;
