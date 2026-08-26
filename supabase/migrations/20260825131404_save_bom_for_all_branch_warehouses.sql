-- Allow each manager to save recipes only inside their assigned warehouse,
-- and let Admin create the same branch preprocessing draft for many branches
-- atomically without duplicating the semi-finished item code.

create or replace function public.inventory_save_bom_draft(
  p_bom_id uuid,
  p_output_item_id uuid,
  p_yield_quantity numeric,
  p_yield_unit_id uuid,
  p_production_scope text,
  p_default_warehouse_id uuid,
  p_effective_from date,
  p_notes text,
  p_components jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_bom_id uuid;
  v_component jsonb;
  v_target public.inventory_boms%rowtype;
begin
  if v_actor is null then
    raise exception 'Phiên đăng nhập đã hết hạn.';
  end if;

  if jsonb_typeof(coalesce(p_components, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_components, '[]'::jsonb)) < 1 then
    raise exception 'Công thức phải có ít nhất một thành phần.';
  end if;

  if p_bom_id is null then
    if not (select private.inventory_can_manage_bom(p_default_warehouse_id, p_production_scope)) then
      raise exception 'Bạn không có quyền tạo công thức tại kho này.';
    end if;

    insert into public.inventory_boms (
      code, output_item_id, version, yield_quantity, yield_unit_id,
      production_scope, default_warehouse_id, effective_from, notes,
      status, created_by, updated_by
    ) values (
      '', p_output_item_id, null, p_yield_quantity, p_yield_unit_id,
      coalesce(nullif(btrim(p_production_scope), ''), 'central'),
      p_default_warehouse_id, coalesce(p_effective_from, current_date),
      nullif(btrim(p_notes), ''), 'draft', v_actor, v_actor
    )
    returning id into v_bom_id;
  else
    select bom.*
    into v_target
    from public.inventory_boms bom
    where bom.id = p_bom_id
      and bom.status = 'draft'
      and bom.deleted_at is null
    for update;

    if not found then
      raise exception 'Chỉ được sửa công thức bản nháp.';
    end if;

    if not (select private.inventory_can_manage_bom(v_target.default_warehouse_id, v_target.production_scope))
      or not (select private.inventory_can_manage_bom(p_default_warehouse_id, p_production_scope)) then
      raise exception 'Bạn không có quyền sửa công thức tại kho này.';
    end if;

    v_bom_id := v_target.id;
    update public.inventory_boms
    set output_item_id = p_output_item_id,
        yield_quantity = p_yield_quantity,
        yield_unit_id = p_yield_unit_id,
        production_scope = coalesce(nullif(btrim(p_production_scope), ''), 'central'),
        default_warehouse_id = p_default_warehouse_id,
        effective_from = coalesce(p_effective_from, current_date),
        notes = nullif(btrim(p_notes), ''),
        updated_by = v_actor
    where id = v_bom_id;

    delete from public.inventory_bom_components where bom_id = v_bom_id;
  end if;

  for v_component in select value from jsonb_array_elements(p_components)
  loop
    insert into public.inventory_bom_components (
      bom_id, component_item_id, quantity, unit_id, base_quantity,
      waste_percent, display_order, notes, created_by, updated_by
    ) values (
      v_bom_id,
      (v_component ->> 'componentItemId')::uuid,
      (v_component ->> 'quantity')::numeric,
      (v_component ->> 'unitId')::uuid,
      1,
      coalesce((v_component ->> 'wastePercent')::numeric, 0),
      coalesce((v_component ->> 'displayOrder')::integer, 0),
      nullif(btrim(v_component ->> 'notes'), ''),
      v_actor,
      v_actor
    );
  end loop;

  return v_bom_id;
end;
$$;

create or replace function public.inventory_save_bom_drafts_for_warehouses(
  p_output_item_id uuid,
  p_yield_quantity numeric,
  p_yield_unit_id uuid,
  p_warehouse_ids uuid[],
  p_effective_from date,
  p_notes text,
  p_components jsonb
)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_warehouse_id uuid;
  v_bom_ids uuid[] := array[]::uuid[];
begin
  if coalesce(array_length(p_warehouse_ids, 1), 0) < 2 then
    raise exception 'Cần chọn ít nhất hai kho chi nhánh.';
  end if;

  if coalesce(array_length(p_warehouse_ids, 1), 0) > 50 then
    raise exception 'Số kho chi nhánh vượt quá giới hạn cho một lần tạo.';
  end if;

  for v_warehouse_id in
    select distinct warehouse_id
    from unnest(p_warehouse_ids) as selected(warehouse_id)
    where warehouse_id is not null
  loop
    v_bom_ids := array_append(v_bom_ids, public.inventory_save_bom_draft(
      null,
      p_output_item_id,
      p_yield_quantity,
      p_yield_unit_id,
      'branch',
      v_warehouse_id,
      p_effective_from,
      p_notes,
      p_components
    ));
  end loop;

  if coalesce(array_length(v_bom_ids, 1), 0) < 2 then
    raise exception 'Danh sách kho chi nhánh không hợp lệ.';
  end if;

  return v_bom_ids;
end;
$$;

revoke all on function public.inventory_save_bom_draft(uuid, uuid, numeric, uuid, text, uuid, date, text, jsonb) from public, anon;
revoke all on function public.inventory_save_bom_drafts_for_warehouses(uuid, numeric, uuid, uuid[], date, text, jsonb) from public, anon;
grant execute on function public.inventory_save_bom_draft(uuid, uuid, numeric, uuid, text, uuid, date, text, jsonb) to authenticated, service_role;
grant execute on function public.inventory_save_bom_drafts_for_warehouses(uuid, numeric, uuid, uuid[], date, text, jsonb) to authenticated, service_role;

comment on function public.inventory_save_bom_drafts_for_warehouses(uuid, numeric, uuid, uuid[], date, text, jsonb) is
  'Creates one branch preprocessing BOM draft per warehouse in a single transaction; every draft uses the same output item code.';
