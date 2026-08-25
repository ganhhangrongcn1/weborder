-- GHR Inventory Phase 3 postcheck - READ ONLY.
-- Run after Phase 1 + Phase 3 migrations. This script never writes business data.

begin transaction read only;

do $$
declare
  v_missing_columns text;
  v_missing_triggers text;
  v_invalid_delete_grants text;
  v_constraint_definition text;
begin
  select string_agg(required.column_name, ', ' order by required.column_name)
  into v_missing_columns
  from (
    values
      ('inventory_warehouses', 'department_name'),
      ('inventory_warehouses', 'department_code'),
      ('inventory_warehouses', 'is_default_for_branch'),
      ('inventory_warehouses', 'deleted_at'),
      ('inventory_items', 'reorder_point'),
      ('inventory_items', 'deleted_at'),
      ('inventory_units', 'deleted_at'),
      ('inventory_item_groups', 'deleted_at'),
      ('inventory_suppliers', 'deleted_at'),
      ('inventory_supplier_items', 'deleted_at')
  ) as required(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns column_state
    where column_state.table_schema = 'public'
      and column_state.table_name = required.table_name
      and column_state.column_name = required.column_name
  );

  if v_missing_columns is not null then
    raise exception 'Thiếu cột Phase 3: %', v_missing_columns;
  end if;

  select string_agg(required.trigger_name, ', ' order by required.trigger_name)
  into v_missing_triggers
  from (
    values
      ('inventory_warehouses_sync_branch_identity'),
      ('inventory_units_soft_delete_state'),
      ('inventory_item_groups_soft_delete_state'),
      ('inventory_items_soft_delete_state'),
      ('inventory_suppliers_soft_delete_state'),
      ('inventory_supplier_items_soft_delete_state')
  ) as required(trigger_name)
  where not exists (
    select 1
    from pg_trigger trigger_state
    where trigger_state.tgname = required.trigger_name
      and not trigger_state.tgisinternal
  );

  if v_missing_triggers is not null then
    raise exception 'Thiếu trigger Phase 3: %', v_missing_triggers;
  end if;

  select string_agg(table_state.table_name, ', ' order by table_state.table_name)
  into v_invalid_delete_grants
  from (
    values
      ('inventory_warehouses'),
      ('inventory_units'),
      ('inventory_item_groups'),
      ('inventory_items'),
      ('inventory_suppliers'),
      ('inventory_supplier_items')
  ) as table_state(table_name)
  where has_table_privilege(
    'authenticated',
    format('public.%I', table_state.table_name),
    'DELETE'
  );

  if v_invalid_delete_grants is not null then
    raise exception 'Authenticated còn quyền xóa vật lý: %', v_invalid_delete_grants;
  end if;

  select pg_get_constraintdef(constraint_state.oid)
  into v_constraint_definition
  from pg_constraint constraint_state
  join pg_class table_state on table_state.oid = constraint_state.conrelid
  join pg_namespace namespace on namespace.oid = table_state.relnamespace
  where namespace.nspname = 'public'
    and table_state.relname = 'inventory_warehouses'
    and constraint_state.conname = 'inventory_warehouses_warehouse_type_check';

  if v_constraint_definition is null
     or position('department' in v_constraint_definition) = 0
     or position('mobile' in v_constraint_definition) = 0
     or position('transit' in v_constraint_definition) > 0 then
    raise exception 'Ràng buộc loại kho Phase 3 không đúng hợp đồng vận hành.';
  end if;

  if not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and procedure.proname = 'inventory_is_admin'
      and procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']
  ) then
    raise exception 'Hàm inventory_is_admin chưa được harden đúng.';
  end if;
end;
$$;

select
  table_state.relname as table_name,
  table_state.relrowsecurity as rls_enabled,
  has_table_privilege('authenticated', table_state.oid, 'SELECT') as authenticated_can_select,
  has_table_privilege('authenticated', table_state.oid, 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', table_state.oid, 'UPDATE') as authenticated_can_update,
  has_table_privilege('authenticated', table_state.oid, 'DELETE') as authenticated_can_delete
from pg_class table_state
join pg_namespace namespace on namespace.oid = table_state.relnamespace
where namespace.nspname = 'public'
  and table_state.relname in (
    'inventory_warehouses',
    'inventory_units',
    'inventory_item_groups',
    'inventory_items',
    'inventory_suppliers',
    'inventory_supplier_items'
  )
order by table_state.relname;

select
  policy.tablename,
  policy.policyname,
  policy.cmd,
  policy.roles,
  policy.qual,
  policy.with_check
from pg_policies policy
where policy.schemaname = 'public'
  and policy.tablename like 'inventory_%'
order by policy.tablename, policy.policyname;

rollback;

select 'inventory_phase3_postcheck_passed' as result;
