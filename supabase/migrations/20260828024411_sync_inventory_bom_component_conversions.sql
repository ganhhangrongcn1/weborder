create or replace function private.inventory_prepare_bom_component()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_output_item_id uuid;
  v_bom_status text;
  v_is_derived_refresh boolean := false;
begin
  select bom.output_item_id, bom.status
  into v_output_item_id, v_bom_status
  from public.inventory_boms bom
  where bom.id = new.bom_id
    and bom.deleted_at is null;

  if not found then
    raise exception 'Không tìm thấy BOM đang sử dụng.';
  end if;

  if tg_op = 'UPDATE' then
    v_is_derived_refresh := row(
      old.id,
      old.bom_id,
      old.component_item_id,
      old.quantity,
      old.unit_id,
      old.waste_percent,
      old.display_order,
      old.notes,
      old.created_at,
      old.created_by,
      old.updated_by
    ) is not distinct from row(
      new.id,
      new.bom_id,
      new.component_item_id,
      new.quantity,
      new.unit_id,
      new.waste_percent,
      new.display_order,
      new.notes,
      new.created_at,
      new.created_by,
      new.updated_by
    );
  end if;

  if v_bom_status <> 'draft' and not v_is_derived_refresh then
    raise exception 'Chỉ được sửa thành phần của BOM bản nháp.';
  end if;

  if new.component_item_id = v_output_item_id then
    raise exception 'Bán thành phẩm không thể dùng chính nó làm thành phần.';
  end if;

  perform 1
  from public.inventory_items item
  where item.id = new.component_item_id
    and item.is_active
    and item.deleted_at is null;

  if not found then
    raise exception 'Thành phần BOM không tồn tại hoặc đã ngừng sử dụng.';
  end if;

  if exists (
    with recursive descendants(item_id) as (
      select component.component_item_id
      from public.inventory_boms bom
      join public.inventory_bom_components component on component.bom_id = bom.id
      where bom.output_item_id = new.component_item_id
        and bom.deleted_at is null
        and bom.status in ('draft', 'active')

      union

      select component.component_item_id
      from descendants descendant
      join public.inventory_boms bom on bom.output_item_id = descendant.item_id
      join public.inventory_bom_components component on component.bom_id = bom.id
      where bom.deleted_at is null
        and bom.status in ('draft', 'active')
    )
    select 1
    from descendants
    where item_id = v_output_item_id
  ) then
    raise exception 'BOM tạo vòng lặp giữa các bán thành phẩm.';
  end if;

  new.conversion_to_base := private.inventory_item_unit_to_base(
    new.component_item_id,
    new.unit_id
  );
  new.base_quantity := round(new.quantity * new.conversion_to_base, 6);
  new.updated_at := now();
  return new;
end;
$$;

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

  update public.inventory_bom_components component
  set conversion_to_base = private.inventory_item_unit_to_base(component.component_item_id, component.unit_id),
      base_quantity = round(
        component.quantity * private.inventory_item_unit_to_base(component.component_item_id, component.unit_id),
        6
      ),
      updated_at = clock_timestamp()
  where component.component_item_id = new.id;

  update public.inventory_production_orders production_order
  set output_conversion_to_base = private.inventory_item_unit_to_base(production_order.output_item_id, production_order.output_unit_id),
      updated_at = clock_timestamp()
  where production_order.output_item_id = new.id
    and production_order.status in ('draft', 'in_progress');

  update public.inventory_production_order_lines production_line
  set conversion_to_base = private.inventory_item_unit_to_base(production_line.item_id, production_line.unit_id),
      planned_base_quantity = round(
        production_line.planned_quantity * private.inventory_item_unit_to_base(production_line.item_id, production_line.unit_id),
        6
      ),
      actual_base_quantity = case
        when production_line.actual_quantity is null then null
        else round(
          production_line.actual_quantity * private.inventory_item_unit_to_base(production_line.item_id, production_line.unit_id),
          6
        )
      end,
      updated_at = clock_timestamp()
  from public.inventory_production_orders production_order
  where production_line.production_order_id = production_order.id
    and production_line.item_id = new.id
    and production_order.status in ('draft', 'in_progress');

  update public.inventory_production_orders production_order
  set estimated_total_cost = coalesce((
        select round(sum(production_line.planned_base_quantity * coalesce(balance.average_cost, 0)), 2)
        from public.inventory_production_order_lines production_line
        left join public.inventory_stock_balances balance
          on balance.warehouse_id = production_order.warehouse_id
         and balance.item_id = production_line.item_id
        where production_line.production_order_id = production_order.id
      ), 0),
      updated_at = clock_timestamp()
  where production_order.status in ('draft', 'in_progress')
    and exists (
      select 1
      from public.inventory_production_order_lines production_line
      where production_line.production_order_id = production_order.id
        and production_line.item_id = new.id
    );

  return new;
end;
$$;

revoke all on function private.inventory_sync_item_bom_yield_conversion() from public, anon, authenticated;

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

  update public.inventory_bom_components component
  set conversion_to_base = private.inventory_item_unit_to_base(component.component_item_id, component.unit_id),
      base_quantity = round(
        component.quantity * private.inventory_item_unit_to_base(component.component_item_id, component.unit_id),
        6
      ),
      updated_at = clock_timestamp()
  where component.unit_id = new.id;

  update public.inventory_production_orders production_order
  set output_conversion_to_base = private.inventory_item_unit_to_base(production_order.output_item_id, production_order.output_unit_id),
      updated_at = clock_timestamp()
  where production_order.output_unit_id = new.id
    and production_order.status in ('draft', 'in_progress');

  update public.inventory_production_order_lines production_line
  set conversion_to_base = private.inventory_item_unit_to_base(production_line.item_id, production_line.unit_id),
      planned_base_quantity = round(
        production_line.planned_quantity * private.inventory_item_unit_to_base(production_line.item_id, production_line.unit_id),
        6
      ),
      actual_base_quantity = case
        when production_line.actual_quantity is null then null
        else round(
          production_line.actual_quantity * private.inventory_item_unit_to_base(production_line.item_id, production_line.unit_id),
          6
        )
      end,
      updated_at = clock_timestamp()
  from public.inventory_production_orders production_order
  where production_line.production_order_id = production_order.id
    and production_line.unit_id = new.id
    and production_order.status in ('draft', 'in_progress');

  update public.inventory_production_orders production_order
  set estimated_total_cost = coalesce((
        select round(sum(production_line.planned_base_quantity * coalesce(balance.average_cost, 0)), 2)
        from public.inventory_production_order_lines production_line
        left join public.inventory_stock_balances balance
          on balance.warehouse_id = production_order.warehouse_id
         and balance.item_id = production_line.item_id
        where production_line.production_order_id = production_order.id
      ), 0),
      updated_at = clock_timestamp()
  where production_order.status in ('draft', 'in_progress')
    and exists (
      select 1
      from public.inventory_production_order_lines production_line
      where production_line.production_order_id = production_order.id
        and production_line.unit_id = new.id
    );

  return new;
end;
$$;

revoke all on function private.inventory_sync_unit_bom_yield_conversion() from public, anon, authenticated;

update public.inventory_bom_components component
set conversion_to_base = private.inventory_item_unit_to_base(component.component_item_id, component.unit_id),
    base_quantity = round(
      component.quantity * private.inventory_item_unit_to_base(component.component_item_id, component.unit_id),
      6
    ),
    updated_at = clock_timestamp();

update public.inventory_production_order_lines production_line
set conversion_to_base = private.inventory_item_unit_to_base(production_line.item_id, production_line.unit_id),
    planned_base_quantity = round(
      production_line.planned_quantity * private.inventory_item_unit_to_base(production_line.item_id, production_line.unit_id),
      6
    ),
    actual_base_quantity = case
      when production_line.actual_quantity is null then null
      else round(
        production_line.actual_quantity * private.inventory_item_unit_to_base(production_line.item_id, production_line.unit_id),
        6
      )
    end,
    updated_at = clock_timestamp()
from public.inventory_production_orders production_order
where production_line.production_order_id = production_order.id
  and production_order.status in ('draft', 'in_progress');

update public.inventory_production_orders production_order
set estimated_total_cost = coalesce((
      select round(sum(production_line.planned_base_quantity * coalesce(balance.average_cost, 0)), 2)
      from public.inventory_production_order_lines production_line
      left join public.inventory_stock_balances balance
        on balance.warehouse_id = production_order.warehouse_id
       and balance.item_id = production_line.item_id
      where production_line.production_order_id = production_order.id
    ), 0),
    updated_at = clock_timestamp()
where production_order.status in ('draft', 'in_progress');

notify pgrst, 'reload schema';
