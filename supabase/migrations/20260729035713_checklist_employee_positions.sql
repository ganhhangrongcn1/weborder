-- Structured employee positions and assignment history.

begin;

create table if not exists public.checklist_positions (
  id uuid primary key default gen_random_uuid(),
  position_code text not null unique check (btrim(position_code) <> ''),
  name text not null unique check (btrim(name) <> ''),
  description text not null default '',
  display_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.checklist_employees
  add column if not exists position_id uuid references public.checklist_positions(id) on update cascade on delete restrict;

create table if not exists public.checklist_employee_position_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.checklist_employees(id) on delete cascade,
  position_id uuid not null references public.checklist_positions(id) on update cascade on delete restrict,
  position_name_snapshot text not null,
  effective_from date not null default current_date,
  effective_to date,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id),
  check (effective_to is null or effective_to >= effective_from)
);

create unique index if not exists checklist_employee_position_one_current_idx
  on public.checklist_employee_position_history (employee_id)
  where effective_to is null;
create index if not exists checklist_employee_position_history_employee_date_idx
  on public.checklist_employee_position_history (employee_id, effective_from desc);

insert into public.checklist_positions (position_code, name, description, display_order) values
  ('SALES', 'Nhân viên bán hàng', 'Tiếp nhận đơn, giao món và phục vụ khách.', 10),
  ('PREPARATION', 'Nhân viên chế biến', 'Chuẩn bị nguyên liệu và chế biến sản phẩm.', 20),
  ('MULTI_SKILL', 'Nhân viên đa nhiệm', 'Có thể bán hàng và chế biến theo phân công.', 30),
  ('SHIFT_LEAD', 'Ca trưởng', 'Điều phối hoạt động trong ca.', 40),
  ('STORE_MANAGER', 'Quản lý cửa hàng', 'Chịu trách nhiệm vận hành một cửa hàng.', 50),
  ('SUPERVISOR', 'Giám sát vận hành', 'Kiểm tra và theo dõi tiêu chuẩn nhiều cửa hàng.', 60),
  ('WAREHOUSE', 'Nhân viên kho', 'Phụ trách nhập, xuất và bảo quản hàng hóa.', 70),
  ('OTHER', 'Văn phòng / Khác', 'Các vị trí hỗ trợ hoặc chưa phân nhóm.', 80)
on conflict (position_code) do update set
  name = excluded.name,
  description = excluded.description,
  display_order = excluded.display_order;

update public.checklist_employees employee
set position_id = position.id
from public.checklist_positions position
where employee.position_id is null
  and (
    lower(btrim(employee.position_name)) = lower(btrim(position.name))
    or (lower(btrim(employee.position_name)) = 'nhân viên' and position.position_code = 'MULTI_SKILL')
  );

insert into public.checklist_employee_position_history (
  employee_id, position_id, position_name_snapshot, effective_from, changed_by
)
select employee.id, employee.position_id, employee.position_name,
  coalesce(employee.started_on, employee.created_at::date), employee.created_by
from public.checklist_employees employee
where employee.position_id is not null
  and not exists (
    select 1 from public.checklist_employee_position_history history
    where history.employee_id = employee.id and history.effective_to is null
  );

alter table public.checklist_positions enable row level security;
alter table public.checklist_employee_position_history enable row level security;
grant select, insert, update, delete on public.checklist_positions to authenticated;
grant select, insert, update, delete on public.checklist_employee_position_history to authenticated;

drop policy if exists checklist_positions_read on public.checklist_positions;
create policy checklist_positions_read on public.checklist_positions for select to authenticated
using ((select private.checklist_can_use_app()));
drop policy if exists checklist_positions_admin_insert on public.checklist_positions;
create policy checklist_positions_admin_insert on public.checklist_positions for insert to authenticated
with check ((select private.checklist_is_admin()));
drop policy if exists checklist_positions_admin_update on public.checklist_positions;
create policy checklist_positions_admin_update on public.checklist_positions for update to authenticated
using ((select private.checklist_is_admin())) with check ((select private.checklist_is_admin()));
drop policy if exists checklist_positions_admin_delete on public.checklist_positions;
create policy checklist_positions_admin_delete on public.checklist_positions for delete to authenticated
using ((select private.checklist_is_admin()));

drop policy if exists checklist_position_history_admin_all on public.checklist_employee_position_history;
create policy checklist_position_history_admin_all on public.checklist_employee_position_history for all to authenticated
using ((select private.checklist_is_admin())) with check ((select private.checklist_is_admin()));

create or replace function public.save_checklist_employee_v2(
  p_employee_id uuid default null,
  p_employee_code text default '',
  p_full_name text default '',
  p_phone text default null,
  p_position_id uuid default null,
  p_employment_status text default 'active',
  p_started_on date default null,
  p_branch_uuids uuid[] default array[]::uuid[]
)
returns public.checklist_employees
language plpgsql
set search_path = ''
as $$
declare
  selected_position public.checklist_positions;
  previous_position_id uuid;
  saved_employee public.checklist_employees;
begin
  if not private.checklist_is_admin() then raise exception 'Bạn không có quyền quản lý nhân sự.'; end if;
  select position.* into selected_position from public.checklist_positions position where position.id = p_position_id;
  if selected_position.id is null then raise exception 'Vui lòng chọn vị trí công việc hợp lệ.'; end if;

  if p_employee_id is not null then
    select employee.position_id into previous_position_id from public.checklist_employees employee where employee.id = p_employee_id;
  end if;

  saved_employee := public.save_checklist_employee(
    p_employee_id, p_employee_code, p_full_name, p_phone, selected_position.name,
    p_employment_status, p_started_on, p_branch_uuids
  );
  update public.checklist_employees set position_id = selected_position.id where id = saved_employee.id returning * into saved_employee;

  if previous_position_id is distinct from selected_position.id then
    update public.checklist_employee_position_history
    set effective_to = current_date
    where employee_id = saved_employee.id and effective_to is null;
    insert into public.checklist_employee_position_history (
      employee_id, position_id, position_name_snapshot, effective_from, changed_by
    ) values (
      saved_employee.id, selected_position.id, selected_position.name,
      coalesce(p_started_on, current_date), auth.uid()
    );
  end if;

  return saved_employee;
end;
$$;

create or replace function public.create_checklist_employee_auto_v2(
  p_full_name text,
  p_phone text default null,
  p_position_id uuid default null,
  p_employment_status text default 'active',
  p_started_on date default null,
  p_branch_uuids uuid[] default array[]::uuid[]
)
returns public.checklist_employees
language plpgsql
set search_path = ''
as $$
declare
  selected_position public.checklist_positions;
  saved_employee public.checklist_employees;
begin
  if not private.checklist_is_admin() then raise exception 'Bạn không có quyền quản lý nhân sự.'; end if;
  select position.* into selected_position from public.checklist_positions position where position.id = p_position_id and position.is_active;
  if selected_position.id is null then raise exception 'Vui lòng chọn một vị trí đang hoạt động.'; end if;

  saved_employee := public.create_checklist_employee_auto(
    p_full_name, p_phone, selected_position.name, p_employment_status, p_started_on, p_branch_uuids
  );
  update public.checklist_employees set position_id = selected_position.id where id = saved_employee.id returning * into saved_employee;
  insert into public.checklist_employee_position_history (
    employee_id, position_id, position_name_snapshot, effective_from, changed_by
  ) values (
    saved_employee.id, selected_position.id, selected_position.name,
    coalesce(p_started_on, current_date), auth.uid()
  );
  return saved_employee;
end;
$$;

revoke all on function public.save_checklist_employee_v2(uuid, text, text, text, uuid, text, date, uuid[]) from public, anon;
revoke all on function public.create_checklist_employee_auto_v2(text, text, uuid, text, date, uuid[]) from public, anon;
grant execute on function public.save_checklist_employee_v2(uuid, text, text, text, uuid, text, date, uuid[]) to authenticated;
grant execute on function public.create_checklist_employee_auto_v2(text, text, uuid, text, date, uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;
