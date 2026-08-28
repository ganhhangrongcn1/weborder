create or replace function private.inventory_sync_item_bom_yield_conversion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.inventory_boms bom
  set yield_conversion_to_base = private.inventory_item_unit_to_base(bom.output_item_id, bom.yield_unit_id),
      yield_base_quantity = bom.yield_quantity * private.inventory_item_unit_to_base(bom.output_item_id, bom.yield_unit_id),
      updated_at = clock_timestamp()
  where bom.output_item_id = new.id
    and bom.deleted_at is null;

  update public.inventory_production_orders production_order
  set output_conversion_to_base = private.inventory_item_unit_to_base(production_order.output_item_id, production_order.output_unit_id),
      updated_at = clock_timestamp()
  where production_order.output_item_id = new.id
    and production_order.status in ('draft', 'in_progress');

  return new;
end;
$$;

revoke all on function private.inventory_sync_item_bom_yield_conversion() from public, anon, authenticated;

drop trigger if exists inventory_items_sync_bom_yield_conversion on public.inventory_items;
create trigger inventory_items_sync_bom_yield_conversion
after update of base_unit_id, purchase_unit_id, purchase_to_base_ratio
on public.inventory_items
for each row
when (
  old.base_unit_id is distinct from new.base_unit_id
  or old.purchase_unit_id is distinct from new.purchase_unit_id
  or old.purchase_to_base_ratio is distinct from new.purchase_to_base_ratio
)
execute function private.inventory_sync_item_bom_yield_conversion();

create or replace function private.inventory_sync_unit_bom_yield_conversion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.inventory_boms bom
  set yield_conversion_to_base = private.inventory_item_unit_to_base(bom.output_item_id, bom.yield_unit_id),
      yield_base_quantity = bom.yield_quantity * private.inventory_item_unit_to_base(bom.output_item_id, bom.yield_unit_id),
      updated_at = clock_timestamp()
  where bom.yield_unit_id = new.id
    and bom.deleted_at is null;

  update public.inventory_production_orders production_order
  set output_conversion_to_base = private.inventory_item_unit_to_base(production_order.output_item_id, production_order.output_unit_id),
      updated_at = clock_timestamp()
  where production_order.output_unit_id = new.id
    and production_order.status in ('draft', 'in_progress');

  return new;
end;
$$;

revoke all on function private.inventory_sync_unit_bom_yield_conversion() from public, anon, authenticated;

drop trigger if exists inventory_units_sync_bom_yield_conversion on public.inventory_units;
create trigger inventory_units_sync_bom_yield_conversion
after update of base_unit_id, conversion_factor, is_active
on public.inventory_units
for each row
when (
  old.base_unit_id is distinct from new.base_unit_id
  or old.conversion_factor is distinct from new.conversion_factor
  or old.is_active is distinct from new.is_active
)
execute function private.inventory_sync_unit_bom_yield_conversion();

update public.inventory_boms bom
set yield_conversion_to_base = private.inventory_item_unit_to_base(bom.output_item_id, bom.yield_unit_id),
    yield_base_quantity = bom.yield_quantity * private.inventory_item_unit_to_base(bom.output_item_id, bom.yield_unit_id),
    updated_at = clock_timestamp()
where bom.deleted_at is null;

update public.inventory_production_orders production_order
set output_conversion_to_base = private.inventory_item_unit_to_base(production_order.output_item_id, production_order.output_unit_id),
    updated_at = clock_timestamp()
where production_order.status in ('draft', 'in_progress');

notify pgrst, 'reload schema';
