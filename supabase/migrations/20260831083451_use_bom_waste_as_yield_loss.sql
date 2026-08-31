-- Hao hụt BOM là phần nguyên liệu mất đi sau sơ chế.
-- Lượng thành phần là lượng thực tế đưa vào; không cộng hao hụt lần hai khi tạo lệnh.

do $migration$
declare
  v_signature text;
  v_function_oid oid;
  v_definition text;
  v_old_quantity_expression constant text := 'round(component.quantity * v_factor * (1 + component.waste_percent / 100), 6)';
  v_old_base_expression constant text := 'round(component.base_quantity * v_factor * (1 + component.waste_percent / 100), 6)';
begin
  foreach v_signature in array array[
    'private.inventory_save_production_order_draft(uuid,uuid,numeric,text)',
    'private.inventory_save_production_order_draft(uuid,uuid,uuid,numeric,text)'
  ] loop
    v_function_oid := to_regprocedure(v_signature);
    if v_function_oid is null then
      raise exception 'Không tìm thấy hàm % để cập nhật cách tính hao hụt.', v_signature;
    end if;

    select pg_get_functiondef(v_function_oid) into v_definition;
    if position(v_old_quantity_expression in v_definition) = 0
      or position(v_old_base_expression in v_definition) = 0 then
      raise exception 'Hàm % không còn chứa công thức hao hụt cũ.', v_signature;
    end if;

    v_definition := replace(
      replace(
        v_definition,
        v_old_quantity_expression,
        'round(component.quantity * v_factor, 6)'
      ),
      v_old_base_expression,
      'round(component.base_quantity * v_factor, 6)'
    );
    execute v_definition;
  end loop;
end
$migration$;

-- Đồng bộ công thức cũ theo cơ chế phiên bản sẵn có. BOM đang hoạt động được
-- sao chép thành phiên bản mới; không sửa cấu trúc trực tiếp trên phiên bản cũ.
do $migration$
declare
  v_row record;
  v_new_bom_id uuid;
begin
  for v_row in
    with component_summary as (
      select
        component.*,
        count(*) over (partition by component.bom_id) as component_count
      from public.inventory_bom_components component
    )
    select
      bom.*,
      component.id as component_id,
      component.component_item_id,
      component.quantity as component_quantity,
      component.unit_id as component_unit_id,
      component.waste_percent as component_waste_percent,
      component.display_order as component_display_order,
      component.notes as component_notes,
      component.created_by as component_created_by,
      component.updated_by as component_updated_by,
      round(component.base_quantity * (1 - component.waste_percent / 100), 6)
        as next_yield_base_quantity
    from public.inventory_boms bom
    join component_summary component
      on component.bom_id = bom.id
     and component.component_count = 1
    join public.inventory_items output_item on output_item.id = bom.output_item_id
    join public.inventory_items input_item on input_item.id = component.component_item_id
    where bom.deleted_at is null
      and bom.status in ('draft', 'active')
      and component.waste_percent > 0
      and component.waste_percent < 100
      and output_item.base_unit_id = input_item.base_unit_id
      and abs(
        bom.yield_base_quantity
        - round(component.base_quantity * (1 + component.waste_percent / 100), 6)
      ) < 0.000001
  loop
    if v_row.status = 'draft' then
      update public.inventory_boms
      set yield_quantity = round(
            v_row.next_yield_base_quantity / nullif(v_row.yield_conversion_to_base, 0),
            6
          ),
          metadata = coalesce(v_row.metadata, '{}'::jsonb) || jsonb_build_object(
            'waste_semantics', 'yield_loss',
            'waste_semantics_updated_at', now()
          ),
          updated_at = now()
      where id = v_row.id;
      continue;
    end if;

    insert into public.inventory_boms (
      code, output_item_id, version, yield_quantity, yield_unit_id,
      production_scope, default_warehouse_id, effective_from, notes,
      metadata, status, created_by, updated_by
    ) values (
      '', v_row.output_item_id, null,
      round(v_row.next_yield_base_quantity / nullif(v_row.yield_conversion_to_base, 0), 6),
      v_row.yield_unit_id, v_row.production_scope, v_row.default_warehouse_id,
      current_date, v_row.notes,
      coalesce(v_row.metadata, '{}'::jsonb) || jsonb_build_object(
        'waste_semantics', 'yield_loss',
        'waste_semantics_updated_at', now(),
        'migrated_from_bom_id', v_row.id
      ),
      'draft', v_row.updated_by, v_row.updated_by
    )
    returning id into v_new_bom_id;

    insert into public.inventory_bom_components (
      bom_id, component_item_id, quantity, unit_id, base_quantity,
      waste_percent, display_order, notes, created_by, updated_by
    ) values (
      v_new_bom_id, v_row.component_item_id, v_row.component_quantity,
      v_row.component_unit_id, 1, v_row.component_waste_percent,
      v_row.component_display_order, v_row.component_notes,
      v_row.component_created_by, v_row.component_updated_by
    );

    update public.inventory_boms
    set status = 'inactive',
        effective_to = greatest(effective_from, current_date - 1),
        updated_at = now()
    where id = v_row.id;

    update public.inventory_boms
    set status = 'active', effective_to = null, updated_at = now()
    where id = v_new_bom_id;
  end loop;
end
$migration$;

comment on function public.inventory_save_production_order_draft(uuid, uuid, numeric, text) is
  'Tạo/sửa lệnh sản xuất. Số lượng BOM là đầu vào thực tế; hao hụt làm giảm sản lượng đầu ra và không được cộng lại vào nguyên liệu.';

comment on function public.inventory_save_production_order_draft(uuid, uuid, uuid, numeric, text) is
  'Tạo/sửa lệnh sản xuất theo kho thực hiện. Số lượng BOM là đầu vào thực tế; hao hụt làm giảm sản lượng đầu ra và không được cộng lại vào nguyên liệu.';
