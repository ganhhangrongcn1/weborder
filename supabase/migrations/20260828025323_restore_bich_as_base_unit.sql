do $$
declare
  v_bom_id uuid;
  v_bom_status text;
  v_chili_oil_item_id uuid;
  v_gram_unit_id uuid;
  v_bich_unit_id uuid;
  v_changed_components integer := 0;
begin
  select bom.id, bom.status
  into v_bom_id, v_bom_status
  from public.inventory_boms bom
  where bom.code = 'BOM-000018'
    and bom.deleted_at is null;

  select item.id
  into v_chili_oil_item_id
  from public.inventory_items item
  where item.code = 'NVL_000055'
    and item.deleted_at is null;

  select unit.id
  into v_gram_unit_id
  from public.inventory_units unit
  where unit.code = 'GRAM'
    and unit.deleted_at is null;

  select unit.id
  into v_bich_unit_id
  from public.inventory_units unit
  where unit.code = 'BICH';

  if v_bom_id is null
    or v_chili_oil_item_id is null
    or v_gram_unit_id is null
    or v_bich_unit_id is null then
    raise exception 'Không tìm thấy đủ dữ liệu BOM-000018, Dầu Ớt, Gram hoặc Bịch để đồng bộ.';
  end if;

  if exists (
    select 1
    from public.inventory_bom_components component
    where component.bom_id = v_bom_id
      and component.component_item_id = v_chili_oil_item_id
      and component.unit_id = v_bich_unit_id
  ) then
    update public.inventory_boms
    set status = 'draft'
    where id = v_bom_id;

    update public.inventory_bom_components component
    set quantity = round(component.base_quantity, 6),
        unit_id = v_gram_unit_id
    where component.bom_id = v_bom_id
      and component.component_item_id = v_chili_oil_item_id
      and component.unit_id = v_bich_unit_id;

    get diagnostics v_changed_components = row_count;
    if v_changed_components <> 1 then
      raise exception 'Số dòng Dầu Ớt cần sửa trong BOM-000018 không đúng dự kiến: %.', v_changed_components;
    end if;

    update public.inventory_boms
    set status = v_bom_status
    where id = v_bom_id;
  end if;

  update public.inventory_units
  set base_unit_id = null,
      conversion_factor = 1,
      is_active = true,
      deleted_at = null,
      deleted_by = null,
      updated_at = clock_timestamp()
  where id = v_bich_unit_id;
end;
$$;

notify pgrst, 'reload schema';
