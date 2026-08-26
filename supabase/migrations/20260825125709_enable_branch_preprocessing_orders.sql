-- Phase 6B: cho quản lý chi nhánh vận hành công thức/lệnh sơ chế đúng kho được cấp.
-- Quyền sản xuất/đóng gói Kho Tổng vẫn chỉ thuộc Admin/Owner hoặc central_manager.

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
        and access.warehouse_id = target_warehouse_id
        and warehouse.is_active
        and warehouse.deleted_at is null
        and (
          (
            access.role = 'central_manager'
            and warehouse.warehouse_type = 'central'
            and target_production_scope = 'central'
          )
          or (
            access.role = 'branch_manager'
            and warehouse.warehouse_type = 'branch'
            and target_production_scope = 'branch'
          )
          or (
            access.role = 'branch_manager'
            and warehouse.warehouse_type = 'department'
            and target_production_scope = 'department'
          )
        )
    );
$$;

revoke all on function private.inventory_can_manage_bom(uuid, text) from public, anon;
grant execute on function private.inventory_can_manage_bom(uuid, text) to authenticated, service_role;

comment on function private.inventory_can_manage_bom(uuid, text) is
  'Admin/Owner quản lý toàn hệ thống; central_manager chỉ sản xuất tại Kho Tổng; branch_manager chỉ sơ chế tại đúng kho chi nhánh hoặc kho bộ phận được cấp.';

notify pgrst, 'reload schema';
