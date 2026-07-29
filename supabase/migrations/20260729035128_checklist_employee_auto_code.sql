-- Generate stable employee codes in the database.

begin;

create sequence if not exists public.checklist_employee_code_seq;

select setval(
  'public.checklist_employee_code_seq',
  greatest(coalesce((
    select max(substring(employee_code from '^NV([0-9]+)$')::bigint)
    from public.checklist_employees
    where employee_code ~ '^NV[0-9]+$'
  ), 0), 1),
  exists (select 1 from public.checklist_employees where employee_code ~ '^NV[0-9]+$')
);

create or replace function public.create_checklist_employee_auto(
  p_full_name text,
  p_phone text default null,
  p_position_name text default 'Nhân viên',
  p_employment_status text default 'active',
  p_started_on date default null,
  p_branch_uuids uuid[] default array[]::uuid[]
)
returns public.checklist_employees
language plpgsql
set search_path = ''
as $$
declare
  generated_code text;
  saved_employee public.checklist_employees;
begin
  if not private.checklist_is_admin() then
    raise exception 'Bạn không có quyền quản lý nhân sự.';
  end if;

  loop
    generated_code := 'NV' || lpad(nextval('public.checklist_employee_code_seq')::text, 4, '0');
    exit when not exists (
      select 1 from public.checklist_employees employee where employee.employee_code = generated_code
    );
  end loop;

  saved_employee := public.save_checklist_employee(
    null,
    generated_code,
    p_full_name,
    p_phone,
    p_position_name,
    p_employment_status,
    p_started_on,
    p_branch_uuids
  );

  return saved_employee;
end;
$$;

revoke all on sequence public.checklist_employee_code_seq from public, anon;
grant usage, select on sequence public.checklist_employee_code_seq to authenticated;
revoke all on function public.create_checklist_employee_auto(text, text, text, text, date, uuid[]) from public, anon;
grant execute on function public.create_checklist_employee_auto(text, text, text, text, date, uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;
