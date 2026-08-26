create or replace function private.inventory_can_access_warehouse(target_warehouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select private.inventory_is_admin())
    or exists (
      select 1
      from public.inventory_user_access access
      where access.auth_user_id = (select auth.uid())
        and access.is_active
        and access.warehouse_id = target_warehouse_id
    )
    or exists (
      select 1
      from public.inventory_user_access access
      where access.auth_user_id = (select auth.uid())
        and access.is_active
        and access.role = 'central_manager'
    );
$function$;

comment on function private.inventory_can_access_warehouse(uuid) is
  'Admin truy cập toàn hệ thống; central_manager truy cập tất cả kho; quyền chi nhánh chỉ truy cập kho được gán.';
