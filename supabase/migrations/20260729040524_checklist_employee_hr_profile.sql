begin;

create table if not exists public.checklist_departments (
  id uuid primary key default gen_random_uuid(),
  department_code text not null unique check (btrim(department_code) <> ''),
  name text not null unique check (btrim(name) <> ''),
  description text not null default '',
  display_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.checklist_departments (department_code, name, description, display_order) values
  ('STORE_OPERATIONS', 'Vận hành cửa hàng', 'Nhân sự bán hàng, chế biến và quản lý tại cửa hàng.', 10),
  ('OPERATIONS_CONTROL', 'Giám sát vận hành', 'Nhân sự kiểm tra và theo dõi tiêu chuẩn hệ thống.', 20),
  ('WAREHOUSE', 'Kho vận', 'Nhân sự kho và điều phối hàng hóa.', 30),
  ('OFFICE', 'Văn phòng', 'Nhân sự hành chính và hỗ trợ.', 40)
on conflict (department_code) do update set
  name = excluded.name,
  description = excluded.description,
  display_order = excluded.display_order;

alter table public.checklist_employees
  add column if not exists family_name text,
  add column if not exists given_name text,
  add column if not exists email text,
  add column if not exists department_id uuid references public.checklist_departments(id) on update cascade on delete restrict,
  add column if not exists employee_type text not null default 'official',
  add column if not exists level_code text,
  add column if not exists base_salary numeric(14,2),
  add column if not exists kpi_salary numeric(14,2),
  add column if not exists birth_date date,
  add column if not exists gender text,
  add column if not exists address_province text,
  add column if not exists address_district text,
  add column if not exists address_line text,
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_holder text,
  add column if not exists national_id_number text,
  add column if not exists national_id_issued_on date,
  add column if not exists national_id_front_url text,
  add column if not exists national_id_back_url text,
  add column if not exists payroll_method text not null default 'bank_transfer';

do $$ begin
  alter table public.checklist_employees add constraint checklist_employees_employee_type_check
    check (employee_type in ('official', 'probation', 'part_time', 'seasonal'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.checklist_employees add constraint checklist_employees_gender_check
    check (gender is null or gender in ('male', 'female', 'other'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.checklist_employees add constraint checklist_employees_payroll_method_check
    check (payroll_method in ('bank_transfer', 'cash'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.checklist_employees add constraint checklist_employees_salary_check
    check ((base_salary is null or base_salary >= 0) and (kpi_salary is null or kpi_salary >= 0));
exception when duplicate_object then null; end $$;

create unique index if not exists checklist_employees_email_unique_idx
  on public.checklist_employees (lower(email)) where email is not null and btrim(email) <> '';
create unique index if not exists checklist_employees_national_id_unique_idx
  on public.checklist_employees (national_id_number) where national_id_number is not null and btrim(national_id_number) <> '';
create index if not exists checklist_employees_department_status_idx
  on public.checklist_employees (department_id, employment_status);

update public.checklist_employees
set department_id = (select id from public.checklist_departments where department_code = 'STORE_OPERATIONS')
where department_id is null;

alter table public.checklist_departments enable row level security;
grant select, insert, update, delete on public.checklist_departments to authenticated;
drop policy if exists checklist_departments_read on public.checklist_departments;
create policy checklist_departments_read on public.checklist_departments for select to authenticated
using ((select private.checklist_can_use_app()));
drop policy if exists checklist_departments_admin_insert on public.checklist_departments;
create policy checklist_departments_admin_insert on public.checklist_departments for insert to authenticated
with check ((select private.checklist_is_admin()));
drop policy if exists checklist_departments_admin_update on public.checklist_departments;
create policy checklist_departments_admin_update on public.checklist_departments for update to authenticated
using ((select private.checklist_is_admin())) with check ((select private.checklist_is_admin()));
drop policy if exists checklist_departments_admin_delete on public.checklist_departments;
create policy checklist_departments_admin_delete on public.checklist_departments for delete to authenticated
using ((select private.checklist_is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checklist-hr-documents',
  'checklist-hr-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists checklist_hr_documents_admin_select on storage.objects;
create policy checklist_hr_documents_admin_select on storage.objects for select to authenticated
using (bucket_id = 'checklist-hr-documents' and (select private.checklist_is_admin()));
drop policy if exists checklist_hr_documents_admin_insert on storage.objects;
create policy checklist_hr_documents_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'checklist-hr-documents' and (select private.checklist_is_admin()));
drop policy if exists checklist_hr_documents_admin_update on storage.objects;
create policy checklist_hr_documents_admin_update on storage.objects for update to authenticated
using (bucket_id = 'checklist-hr-documents' and (select private.checklist_is_admin()))
with check (bucket_id = 'checklist-hr-documents' and (select private.checklist_is_admin()));

create or replace function public.save_checklist_employee_hr(
  p_employee_id uuid default null,
  p_employee_code text default '',
  p_full_name text default '',
  p_family_name text default null,
  p_given_name text default null,
  p_email text default null,
  p_phone text default null,
  p_position_id uuid default null,
  p_department_id uuid default null,
  p_employee_type text default 'official',
  p_level_code text default null,
  p_base_salary numeric default null,
  p_kpi_salary numeric default null,
  p_birth_date date default null,
  p_gender text default null,
  p_started_on date default null,
  p_employment_status text default 'active',
  p_address_province text default null,
  p_address_district text default null,
  p_address_line text default null,
  p_bank_name text default null,
  p_bank_account_number text default null,
  p_bank_account_holder text default null,
  p_national_id_number text default null,
  p_national_id_issued_on date default null,
  p_national_id_front_url text default null,
  p_national_id_back_url text default null,
  p_payroll_method text default 'bank_transfer',
  p_branch_uuids uuid[] default array[]::uuid[]
)
returns public.checklist_employees
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_employee public.checklist_employees;
begin
  if not private.checklist_is_admin() then
    raise exception 'Bạn không có quyền quản lý nhân sự.';
  end if;
  if nullif(btrim(coalesce(p_full_name, '')), '') is null then
    raise exception 'Vui lòng nhập họ và tên nhân viên.';
  end if;
  if p_department_id is not null and not exists (
    select 1 from public.checklist_departments where id = p_department_id
  ) then
    raise exception 'Bộ phận không hợp lệ.';
  end if;

  if p_employee_id is null then
    saved_employee := public.create_checklist_employee_auto_v2(
      p_full_name, p_phone, p_position_id, p_employment_status, p_started_on, p_branch_uuids
    );
  else
    saved_employee := public.save_checklist_employee_v2(
      p_employee_id, p_employee_code, p_full_name, p_phone, p_position_id,
      p_employment_status, p_started_on, p_branch_uuids
    );
  end if;

  update public.checklist_employees set
    family_name = nullif(btrim(coalesce(p_family_name, '')), ''),
    given_name = nullif(btrim(coalesce(p_given_name, '')), ''),
    email = nullif(lower(btrim(coalesce(p_email, ''))), ''),
    department_id = p_department_id,
    employee_type = p_employee_type,
    level_code = nullif(btrim(coalesce(p_level_code, '')), ''),
    base_salary = p_base_salary,
    kpi_salary = p_kpi_salary,
    birth_date = p_birth_date,
    gender = nullif(p_gender, ''),
    address_province = nullif(btrim(coalesce(p_address_province, '')), ''),
    address_district = nullif(btrim(coalesce(p_address_district, '')), ''),
    address_line = nullif(btrim(coalesce(p_address_line, '')), ''),
    bank_name = nullif(btrim(coalesce(p_bank_name, '')), ''),
    bank_account_number = nullif(btrim(coalesce(p_bank_account_number, '')), ''),
    bank_account_holder = nullif(btrim(coalesce(p_bank_account_holder, '')), ''),
    national_id_number = nullif(btrim(coalesce(p_national_id_number, '')), ''),
    national_id_issued_on = p_national_id_issued_on,
    national_id_front_url = nullif(btrim(coalesce(p_national_id_front_url, '')), ''),
    national_id_back_url = nullif(btrim(coalesce(p_national_id_back_url, '')), ''),
    payroll_method = p_payroll_method,
    updated_at = now(),
    updated_by = auth.uid()
  where id = saved_employee.id
  returning * into saved_employee;

  return saved_employee;
end;
$$;

revoke all on function public.save_checklist_employee_hr(uuid, text, text, text, text, text, text, uuid, uuid, text, text, numeric, numeric, date, text, date, text, text, text, text, text, text, text, text, date, text, text, text, uuid[]) from public, anon;
grant execute on function public.save_checklist_employee_hr(uuid, text, text, text, text, text, text, uuid, uuid, text, text, numeric, numeric, date, text, date, text, text, text, text, text, text, text, text, date, text, text, text, uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;
