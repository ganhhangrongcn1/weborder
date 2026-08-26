create or replace function private.inventory_allowed_sales_branch_uuids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(distinct warehouse.branch_uuid),
    '{}'::uuid[]
  )
  from public.inventory_user_access access
  join public.inventory_warehouses warehouse on warehouse.id = access.warehouse_id
  where access.auth_user_id = (select auth.uid())
    and access.is_active
    and warehouse.is_active
    and warehouse.deleted_at is null
    and warehouse.branch_uuid is not null;
$$;

revoke all on function private.inventory_allowed_sales_branch_uuids()
  from public, anon;
grant execute on function private.inventory_allowed_sales_branch_uuids()
  to authenticated, service_role;

drop policy if exists inventory_channel_catalog_select
  on public.inventory_channel_catalog;
create policy inventory_channel_catalog_select
on public.inventory_channel_catalog
for select
to authenticated
using (
  (select private.inventory_can_manage_boms())
  or branch_uuid in (
    select unnest(private.inventory_allowed_sales_branch_uuids())
  )
);

notify pgrst, 'reload schema';
