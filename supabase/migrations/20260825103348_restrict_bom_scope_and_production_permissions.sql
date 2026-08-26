-- Scope every processing recipe to one warehouse and keep production writes
-- limited to global Admin/Owner or the manager assigned to a central warehouse.

create or replace function private.inventory_can_view_bom(target_warehouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.inventory_is_admin())
    or (
      target_warehouse_id is not null
      and (select private.inventory_can_access_warehouse(target_warehouse_id))
    );
$$;

create or replace function private.inventory_can_manage_bom(
  target_warehouse_id uuid,
  target_production_scope text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.inventory_is_admin())
    or exists (
      select 1
      from public.inventory_user_access access
      join public.inventory_warehouses warehouse
        on warehouse.id = access.warehouse_id
      where access.auth_user_id = (select auth.uid())
        and access.is_active
        and access.role = 'central_manager'
        and access.warehouse_id = target_warehouse_id
        and warehouse.warehouse_type = 'central'
        and warehouse.is_active
        and warehouse.deleted_at is null
        and target_production_scope = 'central'
    );
$$;

create or replace function private.inventory_validate_bom_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_warehouse_type text;
begin
  if new.default_warehouse_id is null then
    raise exception 'Công thức chế biến phải chọn Kho thực hiện.';
  end if;

  select warehouse.warehouse_type
  into v_warehouse_type
  from public.inventory_warehouses warehouse
  where warehouse.id = new.default_warehouse_id
    and warehouse.is_active
    and warehouse.deleted_at is null;

  if not found then
    raise exception 'Kho thực hiện không tồn tại hoặc đã ngừng sử dụng.';
  end if;

  if new.production_scope = 'central' and v_warehouse_type <> 'central' then
    raise exception 'Công thức sản xuất/đóng gói chỉ được gắn với Kho Tổng.';
  elsif new.production_scope = 'branch' and v_warehouse_type <> 'branch' then
    raise exception 'Công thức sơ chế tại chi nhánh phải gắn với Kho chi nhánh.';
  elsif new.production_scope = 'department' and v_warehouse_type <> 'department' then
    raise exception 'Công thức sơ chế bộ phận phải gắn với Kho bộ phận.';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_boms_validate_scope on public.inventory_boms;
create trigger inventory_boms_validate_scope
before insert or update of production_scope, default_warehouse_id
on public.inventory_boms
for each row execute function private.inventory_validate_bom_scope();

drop index if exists public.inventory_boms_one_active_output_idx;
create unique index inventory_boms_one_active_output_warehouse_idx
  on public.inventory_boms(output_item_id, default_warehouse_id)
  where status = 'active' and deleted_at is null;

create or replace function public.inventory_activate_bom(p_bom_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_target public.inventory_boms%rowtype;
begin
  if v_actor is null then
    raise exception 'Phiên đăng nhập đã hết hạn.';
  end if;

  select bom.*
  into v_target
  from public.inventory_boms bom
  where bom.id = p_bom_id
    and bom.status = 'draft'
    and bom.deleted_at is null
  for update;

  if not found then
    raise exception 'Không tìm thấy công thức bản nháp để kích hoạt.';
  end if;

  if not (select private.inventory_can_manage_bom(v_target.default_warehouse_id, v_target.production_scope)) then
    raise exception 'Bạn không có quyền kích hoạt công thức tại kho này.';
  end if;

  if not exists (
    select 1
    from public.inventory_bom_components component
    where component.bom_id = v_target.id
  ) then
    raise exception 'Công thức phải có ít nhất một thành phần trước khi kích hoạt.';
  end if;

  update public.inventory_boms
  set status = 'inactive',
      effective_to = greatest(effective_from, v_target.effective_from - 1),
      updated_at = now(),
      updated_by = v_actor
  where output_item_id = v_target.output_item_id
    and default_warehouse_id = v_target.default_warehouse_id
    and status = 'active'
    and deleted_at is null
    and id <> v_target.id;

  update public.inventory_boms
  set status = 'active',
      effective_from = coalesce(effective_from, current_date),
      effective_to = null,
      updated_at = now(),
      updated_by = v_actor
  where id = v_target.id;

  return v_target.id;
end;
$$;

drop policy if exists inventory_boms_select on public.inventory_boms;
create policy inventory_boms_select
on public.inventory_boms for select to authenticated
using (
  (select private.inventory_can_view_bom(default_warehouse_id))
  and (deleted_at is null or (select private.inventory_can_manage_bom(default_warehouse_id, production_scope)))
);

drop policy if exists inventory_boms_insert on public.inventory_boms;
create policy inventory_boms_insert
on public.inventory_boms for insert to authenticated
with check (
  status = 'draft'
  and created_by = (select auth.uid())
  and (select private.inventory_can_manage_bom(default_warehouse_id, production_scope))
);

drop policy if exists inventory_boms_update on public.inventory_boms;
create policy inventory_boms_update
on public.inventory_boms for update to authenticated
using ((select private.inventory_can_manage_bom(default_warehouse_id, production_scope)))
with check ((select private.inventory_can_manage_bom(default_warehouse_id, production_scope)));

drop policy if exists inventory_bom_components_select on public.inventory_bom_components;
create policy inventory_bom_components_select
on public.inventory_bom_components for select to authenticated
using (
  exists (
    select 1
    from public.inventory_boms bom
    where bom.id = bom_id
      and (select private.inventory_can_view_bom(bom.default_warehouse_id))
      and (bom.deleted_at is null or (select private.inventory_can_manage_bom(bom.default_warehouse_id, bom.production_scope)))
  )
);

drop policy if exists inventory_bom_components_insert on public.inventory_bom_components;
create policy inventory_bom_components_insert
on public.inventory_bom_components for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.inventory_boms bom
    where bom.id = bom_id
      and bom.status = 'draft'
      and bom.deleted_at is null
      and (select private.inventory_can_manage_bom(bom.default_warehouse_id, bom.production_scope))
  )
);

drop policy if exists inventory_bom_components_update on public.inventory_bom_components;
create policy inventory_bom_components_update
on public.inventory_bom_components for update to authenticated
using (
  exists (
    select 1 from public.inventory_boms bom
    where bom.id = bom_id
      and bom.status = 'draft'
      and bom.deleted_at is null
      and (select private.inventory_can_manage_bom(bom.default_warehouse_id, bom.production_scope))
  )
)
with check (
  exists (
    select 1 from public.inventory_boms bom
    where bom.id = bom_id
      and bom.status = 'draft'
      and bom.deleted_at is null
      and (select private.inventory_can_manage_bom(bom.default_warehouse_id, bom.production_scope))
  )
);

drop policy if exists inventory_bom_components_delete on public.inventory_bom_components;
create policy inventory_bom_components_delete
on public.inventory_bom_components for delete to authenticated
using (
  exists (
    select 1 from public.inventory_boms bom
    where bom.id = bom_id
      and bom.status = 'draft'
      and bom.deleted_at is null
      and (select private.inventory_can_manage_bom(bom.default_warehouse_id, bom.production_scope))
  )
);

revoke all on function private.inventory_can_view_bom(uuid) from public, anon;
revoke all on function private.inventory_can_manage_bom(uuid, text) from public, anon;
revoke all on function private.inventory_validate_bom_scope() from public, anon, authenticated;
grant execute on function private.inventory_can_view_bom(uuid) to authenticated, service_role;
grant execute on function private.inventory_can_manage_bom(uuid, text) to authenticated, service_role;

comment on function private.inventory_can_view_bom(uuid) is
  'Admin xem toàn hệ thống; tài khoản Kho chỉ xem công thức gắn đúng kho được cấp.';
comment on function private.inventory_can_manage_bom(uuid, text) is
  'Chỉ Admin/Owner hoặc central_manager của đúng Kho Tổng được quản lý công thức sản xuất.';
