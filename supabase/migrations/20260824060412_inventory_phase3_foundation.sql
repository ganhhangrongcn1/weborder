-- Inventory Phase 3: master data, branch identity and scoped access hardening.
-- This migration is local-only until the production audit and explicit approval are complete.

alter table public.inventory_warehouses
  drop constraint if exists inventory_warehouses_warehouse_type_check;

alter table public.inventory_warehouses
  add constraint inventory_warehouses_warehouse_type_check
  check (warehouse_type in ('central', 'branch', 'department', 'mobile', 'other'));

alter table public.inventory_items
  drop constraint if exists inventory_items_item_type_check;

alter table public.inventory_items
  add constraint inventory_items_item_type_check
  check (item_type in ('ingredient', 'semi_finished', 'finished_good', 'packaging', 'other'));

alter table public.inventory_warehouses
  add column if not exists department_code text,
  add column if not exists department_name text,
  add column if not exists is_default_for_branch boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);

alter table public.inventory_units
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id);

alter table public.inventory_item_groups
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id);

alter table public.inventory_items
  add column if not exists reorder_point numeric(18,6) not null default 0,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);

alter table public.inventory_items
  drop constraint if exists inventory_items_reorder_point_check;

alter table public.inventory_items
  add constraint inventory_items_reorder_point_check
  check (reorder_point >= 0);

alter table public.inventory_suppliers
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);

alter table public.inventory_supplier_items
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id);

create unique index if not exists inventory_warehouses_default_branch_unique
  on public.inventory_warehouses (branch_uuid)
  where branch_uuid is not null
    and is_default_for_branch
    and is_active
    and deleted_at is null;

create unique index if not exists inventory_warehouses_department_code_unique
  on public.inventory_warehouses (branch_uuid, department_code)
  where branch_uuid is not null
    and department_code is not null
    and is_active
    and deleted_at is null;

create index if not exists inventory_warehouses_active_branch_idx
  on public.inventory_warehouses (branch_uuid, warehouse_type, name)
  where is_active and deleted_at is null;

create index if not exists inventory_items_active_group_name_idx
  on public.inventory_items (group_id, name)
  where is_active and deleted_at is null;

create index if not exists inventory_items_reorder_idx
  on public.inventory_items (reorder_point)
  where is_active and deleted_at is null and reorder_point > 0;

create index if not exists inventory_suppliers_active_name_idx
  on public.inventory_suppliers (name)
  where is_active and deleted_at is null;

create or replace function private.inventory_sync_warehouse_branch_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch_id bigint;
  v_branch_uuid uuid;
begin
  if new.branch_id is not null then
    select branch.id, branch.branch_uuid
    into v_branch_id, v_branch_uuid
    from public.branches branch
    where branch.id = new.branch_id;

    if v_branch_id is null then
      raise exception 'Chi nhánh của kho không tồn tại.';
    end if;

    if new.branch_uuid is not null and new.branch_uuid <> v_branch_uuid then
      raise exception 'Mã chi nhánh và UUID chi nhánh của kho không khớp.';
    end if;

    new.branch_uuid := v_branch_uuid;
  elsif new.branch_uuid is not null then
    select branch.id, branch.branch_uuid
    into v_branch_id, v_branch_uuid
    from public.branches branch
    where branch.branch_uuid = new.branch_uuid;

    if v_branch_id is null then
      raise exception 'UUID chi nhánh của kho không tồn tại.';
    end if;

    new.branch_id := v_branch_id;
  end if;

  if new.warehouse_type in ('branch', 'department')
     and (new.branch_id is null or new.branch_uuid is null) then
    raise exception 'Kho chi nhánh hoặc kho bộ phận phải liên kết với một chi nhánh.';
  end if;

  if new.warehouse_type = 'department'
     and nullif(btrim(coalesce(new.department_code, '')), '') is null then
    raise exception 'Kho bộ phận phải có mã khu.';
  end if;

  if new.department_code is not null then
    new.department_code := upper(regexp_replace(btrim(new.department_code), '\s+', '_', 'g'));
    if new.department_code !~ '^[A-Z0-9_-]+$' then
      raise exception 'Mã khu chỉ gồm chữ in hoa, số, gạch ngang hoặc gạch dưới.';
    end if;
  end if;

  if new.is_default_for_branch
     and (new.branch_uuid is null or new.warehouse_type <> 'branch') then
    raise exception 'Kho mặc định phải là kho chi nhánh và có chi nhánh hợp lệ.';
  end if;

  if new.deleted_at is not null then
    new.is_active := false;
    new.is_default_for_branch := false;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_warehouses_sync_branch_identity
  on public.inventory_warehouses;

create trigger inventory_warehouses_sync_branch_identity
before insert or update of
  branch_id,
  branch_uuid,
  warehouse_type,
  department_code,
  department_name,
  is_default_for_branch,
  deleted_at
on public.inventory_warehouses
for each row
execute function private.inventory_sync_warehouse_branch_identity();

create or replace function private.inventory_apply_soft_delete_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    new.is_active := false;
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_units_soft_delete_state on public.inventory_units;
create trigger inventory_units_soft_delete_state
before insert or update of deleted_at on public.inventory_units
for each row execute function private.inventory_apply_soft_delete_state();

drop trigger if exists inventory_item_groups_soft_delete_state on public.inventory_item_groups;
create trigger inventory_item_groups_soft_delete_state
before insert or update of deleted_at on public.inventory_item_groups
for each row execute function private.inventory_apply_soft_delete_state();

drop trigger if exists inventory_items_soft_delete_state on public.inventory_items;
create trigger inventory_items_soft_delete_state
before insert or update of deleted_at on public.inventory_items
for each row execute function private.inventory_apply_soft_delete_state();

drop trigger if exists inventory_suppliers_soft_delete_state on public.inventory_suppliers;
create trigger inventory_suppliers_soft_delete_state
before insert or update of deleted_at on public.inventory_suppliers
for each row execute function private.inventory_apply_soft_delete_state();

drop trigger if exists inventory_supplier_items_soft_delete_state on public.inventory_supplier_items;
create trigger inventory_supplier_items_soft_delete_state
before insert or update of deleted_at on public.inventory_supplier_items
for each row execute function private.inventory_apply_soft_delete_state();

create or replace function private.inventory_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.profiles profile
      where profile.auth_user_id = (select auth.uid())
        and lower(coalesce(profile.role, '')) = 'admin'
        and lower(coalesce(profile.status, 'active')) = 'active'
    )
    or exists (
      select 1
      from public.inventory_user_access access
      where access.auth_user_id = (select auth.uid())
        and access.warehouse_id is null
        and access.is_active
        and access.role in ('owner', 'admin')
    );
$$;

drop policy if exists inventory_warehouses_select on public.inventory_warehouses;
create policy inventory_warehouses_select
on public.inventory_warehouses for select to authenticated
using (
  (select private.inventory_is_admin())
  or (
    deleted_at is null
    and (select private.inventory_can_access_warehouse(id))
  )
);

drop policy if exists inventory_units_select on public.inventory_units;
create policy inventory_units_select
on public.inventory_units for select to authenticated
using ((select private.inventory_is_admin()) or deleted_at is null);

drop policy if exists inventory_item_groups_select on public.inventory_item_groups;
create policy inventory_item_groups_select
on public.inventory_item_groups for select to authenticated
using ((select private.inventory_is_admin()) or deleted_at is null);

drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select
on public.inventory_items for select to authenticated
using ((select private.inventory_is_admin()) or deleted_at is null);

drop policy if exists inventory_suppliers_select on public.inventory_suppliers;
create policy inventory_suppliers_select
on public.inventory_suppliers for select to authenticated
using (
  (select private.inventory_is_admin())
  or (deleted_at is null and (select private.inventory_can_manage_purchasing()))
);

drop policy if exists inventory_supplier_items_select on public.inventory_supplier_items;
create policy inventory_supplier_items_select
on public.inventory_supplier_items for select to authenticated
using (
  (select private.inventory_is_admin())
  or (deleted_at is null and (select private.inventory_can_manage_purchasing()))
);

drop policy if exists inventory_warehouses_admin_delete on public.inventory_warehouses;
drop policy if exists inventory_units_admin_delete on public.inventory_units;
drop policy if exists inventory_item_groups_admin_delete on public.inventory_item_groups;
drop policy if exists inventory_items_admin_delete on public.inventory_items;
drop policy if exists inventory_suppliers_admin_delete on public.inventory_suppliers;
drop policy if exists inventory_supplier_items_admin_delete on public.inventory_supplier_items;

revoke delete on table
  public.inventory_warehouses,
  public.inventory_units,
  public.inventory_item_groups,
  public.inventory_items,
  public.inventory_suppliers,
  public.inventory_supplier_items
from anon, authenticated;

revoke all on function private.inventory_sync_warehouse_branch_identity() from public;
revoke all on function private.inventory_apply_soft_delete_state() from public;

notify pgrst, 'reload schema';
