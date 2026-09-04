-- Cho phép sửa đơn vị gốc trực tiếp khi nguyên vật liệu chưa có bất kỳ dữ liệu
-- vận hành/công thức nào. Khi đã có dữ liệu, vẫn giữ nguyên cơ chế bảo vệ và
-- chỉ cho đổi qua cặp đơn vị có tỷ lệ xác định được.

create or replace function private.inventory_rebase_item_on_base_unit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_quantity_factor numeric;
  v_has_derived_data boolean;
begin
  if new.base_unit_id is not distinct from old.base_unit_id then
    return new;
  end if;

  select exists (
    select 1 from public.inventory_stock_balances where item_id = new.id
    union all
    select 1 from public.inventory_stock_movements where item_id = new.id
    union all
    select 1 from public.inventory_stock_lots where item_id = new.id
    union all
    select 1 from public.inventory_document_lines where item_id = new.id
    union all
    select 1 from public.inventory_stock_count_snapshots where item_id = new.id
    union all
    select 1 from public.inventory_bom_components where component_item_id = new.id
    union all
    select 1 from public.inventory_boms where output_item_id = new.id
    union all
    select 1 from public.inventory_sales_recipe_components where item_id = new.id
    union all
    select 1 from public.inventory_production_order_lines where item_id = new.id
    union all
    select 1 from public.inventory_production_orders where output_item_id = new.id
    union all
    select 1 from public.inventory_sales_order_event_lines where item_id = new.id
    union all
    select 1 from public.inventory_supplier_items where item_id = new.id
  ) into v_has_derived_data;

  if not v_has_derived_data then
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

comment on function private.inventory_rebase_item_on_base_unit_change() is
  'Cho đổi đơn vị gốc trực tiếp khi mặt hàng chưa có dữ liệu phụ thuộc; nếu đã có dữ liệu thì quy đổi để giữ nguyên lượng vật lý và giá trị tồn.';

-- Đồng bộ hai mã thử nghiệm đã đổi đơn vị hiển thị sang Bịch nhưng đơn vị gốc
-- vẫn còn Gram. Guard bên dưới khiến migration dừng nếu dữ liệu không còn đúng
-- với tình trạng đã được kiểm tra.
do $migration$
declare
  v_bich_unit_id uuid;
  v_changed_count integer;
begin
  select id
  into v_bich_unit_id
  from public.inventory_units
  where code = 'BICH'
    and deleted_at is null;

  if v_bich_unit_id is null then
    raise exception 'Không tìm thấy đơn vị Bịch để đồng bộ Dầu Ớt và Dầu Tỏi.';
  end if;

  update public.inventory_items item
  set base_unit_id = v_bich_unit_id,
      metadata = jsonb_set(
        coalesce(item.metadata, '{}'::jsonb),
        '{display_unit_id}',
        to_jsonb(v_bich_unit_id::text),
        true
      ),
      updated_at = clock_timestamp()
  from public.inventory_units old_base,
       public.inventory_units purchase_unit
  where item.code in ('NVL_000055', 'NVL_000064')
    and item.deleted_at is null
    and old_base.id = item.base_unit_id
    and old_base.code = 'GRAM'
    and purchase_unit.id = item.purchase_unit_id
    and purchase_unit.code = 'KILOGRAM'
    and item.purchase_to_base_ratio = 200
    and item.metadata ->> 'display_unit_id' = v_bich_unit_id::text;

  get diagnostics v_changed_count = row_count;
  if v_changed_count <> 2 then
    raise exception 'Số nguyên vật liệu cần đồng bộ không đúng dự kiến: %.', v_changed_count;
  end if;
end
$migration$;
