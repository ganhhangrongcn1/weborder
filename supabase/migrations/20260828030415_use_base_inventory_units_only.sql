do $$
begin
  if exists (
    select 1
    from public.inventory_bom_components component
    join public.inventory_items item on item.id = component.component_item_id
    join public.inventory_units unit on unit.id = component.unit_id
    where unit.base_unit_id is not null
      and unit.id <> item.base_unit_id
      and (unit.id <> item.purchase_unit_id or coalesce(item.purchase_to_base_ratio, 0) <= 0)
  ) then
    raise exception 'Có thành phần BOM dùng đơn vị quy đổi nhưng chưa có tỷ lệ mua / nhập riêng.';
  end if;

  if exists (
    select 1
    from public.inventory_sales_recipe_components component
    join public.inventory_items item on item.id = component.item_id
    join public.inventory_units unit on unit.id = component.unit_id
    where unit.base_unit_id is not null
      and unit.id <> item.base_unit_id
      and (unit.id <> item.purchase_unit_id or coalesce(item.purchase_to_base_ratio, 0) <= 0)
  ) then
    raise exception 'Có công thức bán hàng dùng đơn vị quy đổi nhưng chưa có tỷ lệ mua / nhập riêng.';
  end if;

  if exists (
    select 1
    from public.inventory_production_order_lines production_line
    join public.inventory_production_orders production_order
      on production_order.id = production_line.production_order_id
    join public.inventory_items item on item.id = production_line.item_id
    join public.inventory_units unit on unit.id = production_line.unit_id
    where production_order.status in ('draft', 'in_progress')
      and unit.base_unit_id is not null
      and unit.id <> item.base_unit_id
      and (unit.id <> item.purchase_unit_id or coalesce(item.purchase_to_base_ratio, 0) <= 0)
  ) then
    raise exception 'Có lệnh sản xuất đang mở dùng đơn vị quy đổi nhưng chưa có tỷ lệ mua / nhập riêng.';
  end if;
end;
$$;

update public.inventory_items item
set metadata = jsonb_set(
      coalesce(item.metadata, '{}'::jsonb),
      '{display_unit_id}',
      to_jsonb(item.base_unit_id::text),
      true
    ),
    updated_at = clock_timestamp()
from public.inventory_units display_unit
where display_unit.id = case
    when coalesce(item.metadata ->> 'display_unit_id', '')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then (item.metadata ->> 'display_unit_id')::uuid
    else item.base_unit_id
  end
  and display_unit.base_unit_id is not null;

update public.inventory_units
set base_unit_id = null,
    conversion_factor = 1,
    updated_at = clock_timestamp()
where base_unit_id is not null
   or conversion_factor <> 1;

update public.inventory_sales_recipe_components component
set conversion_to_base = private.inventory_item_unit_to_base(component.item_id, component.unit_id),
    base_quantity = round(
      component.quantity
        * private.inventory_item_unit_to_base(component.item_id, component.unit_id)
        * (1 + component.waste_percent / 100),
      6
    ),
    updated_at = clock_timestamp();

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conname = 'inventory_units_base_only_check'
      and constraint_row.conrelid = 'public.inventory_units'::regclass
  ) then
    alter table public.inventory_units
      add constraint inventory_units_base_only_check
      check (base_unit_id is null and conversion_factor = 1);
  end if;
end;
$$;

notify pgrst, 'reload schema';
