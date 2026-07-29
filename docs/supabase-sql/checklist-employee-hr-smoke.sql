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
  test_branch uuid;
begin
  select branch_uuid into test_branch from public.branches where branch_uuid is not null limit 1;

  test_employee := public.save_checklist_employee_hr(
    p_full_name => 'Lê Ngọc Minh Châu',
    p_family_name => 'Lê Ngọc Minh',
    p_given_name => 'Châu',
    p_email => 'employee-smoke@ganhhangrong.test',
    p_phone => '0900000000',
    p_position_id => (select id from public.checklist_positions where position_code = 'STORE_MANAGER'),
    p_department_id => (select id from public.checklist_departments where department_code = 'STORE_OPERATIONS'),
    p_employee_type => 'official',
    p_base_salary => 8000000,
    p_kpi_salary => 1000000,
    p_started_on => current_date,
    p_employment_status => 'active',
    p_payroll_method => 'bank_transfer',
    p_branch_uuids => case when test_branch is null then array[]::uuid[] else array[test_branch] end
  );

  if test_employee.id is null or test_employee.position_id is null or test_employee.department_id is null then
    raise exception 'Không lưu đủ liên kết hồ sơ nhân viên.';
  end if;
  if test_employee.family_name <> 'Lê Ngọc Minh' or test_employee.given_name <> 'Châu' then
    raise exception 'Không lưu đúng họ tên nhân viên.';
  end if;
  if test_branch is not null and not exists (
    select 1 from public.checklist_employee_branches
    where employee_id = test_employee.id and branch_uuid = test_branch and is_active
  ) then
    raise exception 'Không lưu được chi nhánh nhân viên.';
  end if;
end;
$$;

rollback;
