-- Read-only postcheck for Inventory Phase 3 P0 settings forms.

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'inventory_units' and column_name in ('symbol', 'base_unit_id', 'conversion_factor', 'display_order'))
    or (table_name = 'inventory_item_groups' and column_name in ('description', 'display_order'))
  )
order by table_name, column_name;

select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname in (
  'inventory_units_base_unit_id_fkey',
  'inventory_units_conversion_factor_check',
  'inventory_units_base_unit_not_self_check',
  'inventory_units_display_order_check',
  'inventory_item_groups_display_order_check',
  'inventory_items_item_type_check'
)
order by conname;

select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and trigger_name in (
    'inventory_items_assign_code',
    'inventory_units_validate_conversion'
  );

select
  has_table_privilege('authenticated', 'public.inventory_units', 'select,insert,update') as units_grant_ok,
  has_table_privilege('authenticated', 'public.inventory_item_groups', 'select,insert,update') as groups_grant_ok,
  has_table_privilege('authenticated', 'public.inventory_items', 'select,insert,update') as items_grant_ok,
  has_sequence_privilege('authenticated', 'public.inventory_item_code_seq', 'usage') as item_code_sequence_usage_ok;

select
  (select count(*) from public.inventory_units where deleted_at is null) as unit_count,
  (select count(*) from public.inventory_item_groups where deleted_at is null) as group_count,
  (select count(*) from public.inventory_items where deleted_at is null) as item_count;
