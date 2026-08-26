create or replace function private.inventory_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
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
        and access.is_active
        and access.role in ('owner', 'admin', 'central_manager')
    );
$function$;

comment on function private.inventory_is_admin() is
  'Quyền quản trị chỉ trong phân hệ Kho: Admin hệ thống hoặc owner/admin/central_manager của Kho.';
