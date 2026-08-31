-- Một số dữ liệu thử đã được nhập theo hướng dẫn cũ: đầu ra đã giảm đúng
-- nhưng hao hụt lại để 0%. Khôi phục tỷ lệ hao hụt từ phiên bản trước và tạo
-- phiên bản BOM mới để giữ nguyên lịch sử.
do $migration$
declare
  v_row record;
  v_new_bom_id uuid;
begin
  for v_row in
    with active_component as (
      select
        bom.*,
        component.component_item_id,
        component.quantity as component_quantity,
        component.unit_id as component_unit_id,
        component.base_quantity as component_base_quantity,
        component.display_order as component_display_order,
        component.notes as component_notes,
        component.created_by as component_created_by,
        component.updated_by as component_updated_by,
        count(*) over (partition by bom.id) as component_count
      from public.inventory_boms bom
      join public.inventory_bom_components component on component.bom_id = bom.id
      where bom.status = 'active'
        and bom.deleted_at is null
        and component.waste_percent = 0
    )
    select
      current_bom.*,
      round(
        (1 - current_bom.yield_base_quantity / current_bom.component_base_quantity) * 100,
        4
      ) as inferred_waste_percent
    from active_component current_bom
    join public.inventory_items output_item on output_item.id = current_bom.output_item_id
    join public.inventory_items input_item on input_item.id = current_bom.component_item_id
    where current_bom.component_count = 1
      and output_item.base_unit_id = input_item.base_unit_id
      and current_bom.yield_base_quantity > 0
      and current_bom.yield_base_quantity < current_bom.component_base_quantity
      and exists (
        select 1
        from public.inventory_boms previous_bom
        join public.inventory_bom_components previous_component
          on previous_component.bom_id = previous_bom.id
        where previous_bom.output_item_id = current_bom.output_item_id
          and previous_bom.id <> current_bom.id
          and previous_bom.status = 'inactive'
          and previous_bom.deleted_at is null
          and previous_component.component_item_id = current_bom.component_item_id
          and abs(
            previous_component.waste_percent
            - round(
                (1 - current_bom.yield_base_quantity / current_bom.component_base_quantity) * 100,
                4
              )
          ) < 0.0001
      )
  loop
    insert into public.inventory_boms (
      code, output_item_id, version, yield_quantity, yield_unit_id,
      production_scope, default_warehouse_id, effective_from, notes,
      metadata, status, created_by, updated_by
    ) values (
      '', v_row.output_item_id, null, v_row.yield_quantity, v_row.yield_unit_id,
      v_row.production_scope, v_row.default_warehouse_id, current_date, v_row.notes,
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
      v_row.component_unit_id, 1, v_row.inferred_waste_percent,
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
