-- Đổi đơn vị gốc của nguyên vật liệu phải giữ nguyên lượng vật lý và giá trị tồn.
-- Ví dụ: 10 Kg -> 10.000 Gr; giá 300.000 đ/Kg -> 300 đ/Gr.

create or replace function private.inventory_rebase_item_derived_data(
  p_item_id uuid,
  p_quantity_factor numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_item_id is null or p_quantity_factor is null or p_quantity_factor <= 0 then
    raise exception 'Tỷ lệ đổi đơn vị tồn kho không hợp lệ.';
  end if;

  update public.inventory_stock_balances
  set quantity = round(quantity * p_quantity_factor, 6),
      average_cost = round(average_cost / p_quantity_factor, 6),
      updated_at = now()
  where item_id = p_item_id;

  update public.inventory_stock_movements
  set quantity = round(quantity * p_quantity_factor, 6),
      unit_cost = round(unit_cost / p_quantity_factor, 6)
  where item_id = p_item_id;

  update public.inventory_stock_lots
  set received_quantity = round(received_quantity * p_quantity_factor, 6),
      remaining_quantity = round(remaining_quantity * p_quantity_factor, 6),
      unit_cost = round(unit_cost / p_quantity_factor, 6),
      updated_at = now()
  where item_id = p_item_id;

  update public.inventory_document_lines
  set conversion_to_base = round(conversion_to_base * p_quantity_factor, 6),
      base_quantity = round(base_quantity * p_quantity_factor, 6)
  where item_id = p_item_id;

  update public.inventory_stock_count_snapshots
  set system_quantity = round(system_quantity * p_quantity_factor, 6),
      movement_quantity_until_count = round(movement_quantity_until_count * p_quantity_factor, 6),
      movement_quantity_until_submit = round(movement_quantity_until_submit * p_quantity_factor, 6),
      expected_quantity_at_count = round(expected_quantity_at_count * p_quantity_factor, 6),
      expected_quantity_at_submit = round(expected_quantity_at_submit * p_quantity_factor, 6)
  where item_id = p_item_id;

  update public.inventory_bom_components
  set conversion_to_base = round(conversion_to_base * p_quantity_factor, 6),
      base_quantity = round(base_quantity * p_quantity_factor, 6)
  where component_item_id = p_item_id;

  update public.inventory_sales_recipe_components
  set conversion_to_base = round(conversion_to_base * p_quantity_factor, 6),
      base_quantity = round(base_quantity * p_quantity_factor, 6)
  where item_id = p_item_id;

  update public.inventory_production_order_lines
  set conversion_to_base = round(conversion_to_base * p_quantity_factor, 6),
      planned_base_quantity = round(planned_base_quantity * p_quantity_factor, 6),
      actual_base_quantity = round(actual_base_quantity * p_quantity_factor, 6),
      unit_cost = round(unit_cost / p_quantity_factor, 6)
  where item_id = p_item_id;

  update public.inventory_production_orders
  set output_conversion_to_base = round(output_conversion_to_base * p_quantity_factor, 6)
  where output_item_id = p_item_id;

  update public.inventory_sales_order_event_lines
  set required_quantity = round(required_quantity * p_quantity_factor, 6)
  where item_id = p_item_id
    and required_quantity is not null;

  update public.inventory_supplier_items
  set pack_size = round(pack_size * p_quantity_factor, 6),
      updated_at = now()
  where item_id = p_item_id;
end;
$function$;

revoke all on function private.inventory_rebase_item_derived_data(uuid, numeric)
from public, anon, authenticated;

create or replace function private.inventory_rebase_item_on_base_unit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_quantity_factor numeric;
begin
  if new.base_unit_id is not distinct from old.base_unit_id then
    return new;
  end if;

  if old.base_unit_id = new.purchase_unit_id and new.purchase_to_base_ratio > 0 then
    v_quantity_factor := new.purchase_to_base_ratio;
  elsif new.base_unit_id = old.purchase_unit_id and old.purchase_to_base_ratio > 0 then
    v_quantity_factor := 1 / old.purchase_to_base_ratio;
  else
    raise exception 'Không xác định được tỷ lệ đổi đơn vị tồn kho. Hãy chọn đơn vị mua/nhập là đơn vị gốc cũ và nhập đúng tỷ lệ quy đổi.';
  end if;

  perform private.inventory_rebase_item_derived_data(new.id, v_quantity_factor);
  return new;
end;
$function$;

revoke all on function private.inventory_rebase_item_on_base_unit_change()
from public, anon, authenticated;

drop trigger if exists inventory_items_rebase_derived_data on public.inventory_items;
create trigger inventory_items_rebase_derived_data
after update of base_unit_id on public.inventory_items
for each row
when (old.base_unit_id is distinct from new.base_unit_id)
execute function private.inventory_rebase_item_on_base_unit_change();

-- Sửa dữ liệu thử Muối TN đã bị đổi nhãn 10 Kg thành 10 Gr lúc 16:05 ngày 31/08.
-- Guard chỉ cho phép chạy khi toàn bộ dấu vết vẫn đúng với sự cố đã xác minh.
do $migration$
declare
  v_item_id uuid;
begin
  select item.id
  into v_item_id
  from public.inventory_items item
  join public.inventory_units base_unit on base_unit.id = item.base_unit_id
  join public.inventory_units purchase_unit on purchase_unit.id = item.purchase_unit_id
  where item.code = 'NVL_000067'
    and item.name = 'Muối TN'
    and base_unit.code = 'GRAM'
    and purchase_unit.code = 'KILOGRAM'
    and item.purchase_to_base_ratio = 1000
    and exists (
      select 1
      from public.inventory_stock_movements movement
      join public.inventory_document_lines line on line.id = movement.document_line_id
      join public.inventory_documents document on document.id = movement.document_id
      join public.inventory_units document_unit on document_unit.id = line.unit_id
      where movement.item_id = item.id
        and document.document_no = 'PNK-20260831-155503-BB4'
        and document_unit.code = 'KILOGRAM'
        and line.conversion_to_base = 1
        and line.base_quantity = 10
        and movement.quantity = 10
        and movement.unit_cost = 300000
    )
    and exists (
      select 1
      from public.inventory_stock_balances balance
      where balance.item_id = item.id
        and balance.quantity = 10
        and balance.average_cost = 300000
    );

  if v_item_id is null then
    return;
  end if;

  perform private.inventory_rebase_item_derived_data(v_item_id, 1000);

  update public.inventory_items
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'base_unit_rebased_at', now(),
        'base_unit_rebase_factor', 1000,
        'base_unit_rebase_reason', 'preserve_10kg_as_10000g'
      ),
      updated_at = now()
  where id = v_item_id;
end
$migration$;

comment on function private.inventory_rebase_item_on_base_unit_change() is
  'Giữ nguyên lượng vật lý và giá trị tồn khi đổi đơn vị gốc của nguyên vật liệu.';
