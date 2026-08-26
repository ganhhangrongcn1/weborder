-- One preprocessing recipe is shared by every branch. The execution warehouse
-- belongs to each preprocessing order, where actual input/output is recorded.

create or replace function private.inventory_can_view_bom(target_warehouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.inventory_is_admin())
    or (
      target_warehouse_id is null
      and exists (
        select 1
        from public.inventory_user_access access
        where access.auth_user_id = (select auth.uid())
          and access.is_active
          and access.role = 'branch_manager'
      )
    )
    or (
      target_warehouse_id is not null
      and (select private.inventory_can_access_warehouse(target_warehouse_id))
    );
$$;

create or replace function private.inventory_validate_bom_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_warehouse_type text;
begin
  if new.production_scope = 'branch' and new.default_warehouse_id is null then
    return new;
  end if;

  if new.default_warehouse_id is null then
    raise exception 'Công thức chế biến phải chọn Kho thực hiện.';
  end if;

  select warehouse.warehouse_type
  into v_warehouse_type
  from public.inventory_warehouses warehouse
  where warehouse.id = new.default_warehouse_id
    and warehouse.is_active
    and warehouse.deleted_at is null;

  if not found then
    raise exception 'Kho thực hiện không tồn tại hoặc đã ngừng sử dụng.';
  end if;

  if new.production_scope = 'central' and v_warehouse_type <> 'central' then
    raise exception 'Công thức sản xuất/đóng gói chỉ được gắn với Kho Tổng.';
  elsif new.production_scope = 'branch' and v_warehouse_type <> 'branch' then
    raise exception 'Công thức sơ chế tại chi nhánh phải dùng chung hoặc gắn với Kho chi nhánh.';
  elsif new.production_scope = 'department' and v_warehouse_type <> 'department' then
    raise exception 'Công thức sơ chế bộ phận phải gắn với Kho bộ phận.';
  end if;

  return new;
end;
$$;

create unique index if not exists inventory_boms_one_active_shared_scope_idx
  on public.inventory_boms(output_item_id, production_scope)
  where status = 'active' and deleted_at is null and default_warehouse_id is null;

create or replace function public.inventory_activate_bom(p_bom_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_target public.inventory_boms%rowtype;
begin
  if v_actor is null then
    raise exception 'Phiên đăng nhập đã hết hạn.';
  end if;

  select bom.* into v_target
  from public.inventory_boms bom
  where bom.id = p_bom_id
    and bom.status = 'draft'
    and bom.deleted_at is null
  for update;

  if not found then
    raise exception 'Không tìm thấy công thức bản nháp để kích hoạt.';
  end if;

  if not (select private.inventory_can_manage_bom(v_target.default_warehouse_id, v_target.production_scope)) then
    raise exception 'Bạn không có quyền kích hoạt công thức này.';
  end if;

  if not exists (select 1 from public.inventory_bom_components component where component.bom_id = v_target.id) then
    raise exception 'Công thức phải có ít nhất một thành phần trước khi kích hoạt.';
  end if;

  update public.inventory_boms
  set status = 'inactive',
      effective_to = greatest(effective_from, v_target.effective_from - 1),
      updated_at = now(),
      updated_by = v_actor
  where output_item_id = v_target.output_item_id
    and production_scope = v_target.production_scope
    and default_warehouse_id is not distinct from v_target.default_warehouse_id
    and status = 'active'
    and deleted_at is null
    and id <> v_target.id;

  update public.inventory_boms
  set status = 'active', effective_from = coalesce(effective_from, current_date),
      effective_to = null, updated_at = now(), updated_by = v_actor
  where id = v_target.id;

  return v_target.id;
end;
$$;

create or replace function private.inventory_save_production_order_draft(
  p_order_id uuid,
  p_bom_id uuid,
  p_warehouse_id uuid,
  p_planned_output_quantity numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_bom public.inventory_boms%rowtype;
  v_order public.inventory_production_orders%rowtype;
  v_order_id uuid;
  v_execution_warehouse_id uuid;
  v_expected_warehouse_type text;
  v_factor numeric(18,8);
begin
  if v_actor is null then raise exception 'Phiên đăng nhập đã hết hạn.'; end if;
  if coalesce(p_planned_output_quantity, 0) <= 0 then raise exception 'Số lượng cần làm phải lớn hơn 0.'; end if;

  select bom.* into v_bom
  from public.inventory_boms bom
  where bom.id = p_bom_id
    and bom.status = 'active'
    and bom.deleted_at is null
    and bom.effective_from <= current_date
    and (bom.effective_to is null or bom.effective_to >= current_date);

  if not found then raise exception 'Công thức không tồn tại hoặc chưa được kích hoạt.'; end if;

  v_execution_warehouse_id := coalesce(v_bom.default_warehouse_id, p_warehouse_id);
  if v_execution_warehouse_id is null then raise exception 'Vui lòng chọn kho thực hiện.'; end if;
  if v_bom.default_warehouse_id is not null and p_warehouse_id is distinct from v_bom.default_warehouse_id then
    raise exception 'Kho thực hiện không đúng với công thức.';
  end if;

  v_expected_warehouse_type := case v_bom.production_scope
    when 'central' then 'central'
    when 'branch' then 'branch'
    when 'department' then 'department'
    else null
  end;

  if v_expected_warehouse_type is not null and not exists (
    select 1 from public.inventory_warehouses warehouse
    where warehouse.id = v_execution_warehouse_id
      and warehouse.warehouse_type = v_expected_warehouse_type
      and warehouse.is_active
      and warehouse.deleted_at is null
  ) then
    raise exception 'Kho thực hiện không phù hợp với loại công thức.';
  end if;

  if not (select private.inventory_can_manage_bom(v_execution_warehouse_id, v_bom.production_scope)) then
    raise exception 'Bạn không có quyền lập lệnh tại kho này.';
  end if;

  if p_order_id is null then
    insert into public.inventory_production_orders (
      order_no, bom_id, output_item_id, warehouse_id, output_unit_id,
      output_conversion_to_base, planned_output_quantity, status, notes,
      created_by, updated_by
    ) values (
      'LSX-' || lpad(nextval('public.inventory_production_order_code_seq'::regclass)::text, 6, '0'),
      v_bom.id, v_bom.output_item_id, v_execution_warehouse_id, v_bom.yield_unit_id,
      v_bom.yield_conversion_to_base, p_planned_output_quantity, 'draft', nullif(btrim(p_notes), ''),
      v_actor, v_actor
    ) returning id into v_order_id;
  else
    select production_order.* into v_order
    from public.inventory_production_orders production_order
    where production_order.id = p_order_id
    for update;

    if not found or v_order.status <> 'draft' then raise exception 'Chỉ lệnh bản nháp mới được sửa.'; end if;
    if not (select private.inventory_can_manage_bom(v_order.warehouse_id, v_bom.production_scope))
      or not (select private.inventory_can_manage_bom(v_execution_warehouse_id, v_bom.production_scope)) then
      raise exception 'Bạn không có quyền sửa lệnh này.';
    end if;

    update public.inventory_production_orders
    set bom_id = v_bom.id, output_item_id = v_bom.output_item_id,
        warehouse_id = v_execution_warehouse_id, output_unit_id = v_bom.yield_unit_id,
        output_conversion_to_base = v_bom.yield_conversion_to_base,
        planned_output_quantity = p_planned_output_quantity,
        notes = nullif(btrim(p_notes), ''), updated_at = now(), updated_by = v_actor
    where id = p_order_id;

    delete from public.inventory_production_order_lines where production_order_id = p_order_id;
    v_order_id := p_order_id;
  end if;

  v_factor := p_planned_output_quantity / v_bom.yield_quantity;

  insert into public.inventory_production_order_lines (
    production_order_id, item_id, unit_id, conversion_to_base, waste_percent,
    planned_quantity, planned_base_quantity, display_order, created_by, updated_by
  )
  select v_order_id, component.component_item_id, component.unit_id,
    component.conversion_to_base, component.waste_percent,
    round(component.quantity * v_factor * (1 + component.waste_percent / 100), 6),
    round(component.base_quantity * v_factor * (1 + component.waste_percent / 100), 6),
    component.display_order, v_actor, v_actor
  from public.inventory_bom_components component
  where component.bom_id = v_bom.id
  order by component.display_order, component.id;

  if not found then raise exception 'Công thức chưa có thành phần.'; end if;

  update public.inventory_production_orders production_order
  set estimated_total_cost = coalesce((
        select round(sum(line.planned_base_quantity * coalesce(balance.average_cost, 0)), 2)
        from public.inventory_production_order_lines line
        left join public.inventory_stock_balances balance
          on balance.warehouse_id = production_order.warehouse_id and balance.item_id = line.item_id
        where line.production_order_id = production_order.id
      ), 0),
      updated_at = now(), updated_by = v_actor
  where production_order.id = v_order_id;

  return v_order_id;
end;
$$;

create or replace function public.inventory_save_production_order_draft(
  p_order_id uuid,
  p_bom_id uuid,
  p_warehouse_id uuid,
  p_planned_output_quantity numeric,
  p_notes text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_save_production_order_draft(
    p_order_id, p_bom_id, p_warehouse_id, p_planned_output_quantity, p_notes
  );
$$;

drop function if exists public.inventory_save_bom_drafts_for_warehouses(uuid, numeric, uuid, uuid[], date, text, jsonb);

revoke all on function private.inventory_can_view_bom(uuid) from public, anon;
revoke all on function private.inventory_validate_bom_scope() from public, anon, authenticated;
revoke all on function private.inventory_save_production_order_draft(uuid, uuid, uuid, numeric, text) from public, anon;
revoke all on function public.inventory_save_production_order_draft(uuid, uuid, uuid, numeric, text) from public, anon;

grant execute on function private.inventory_can_view_bom(uuid) to authenticated, service_role;
grant execute on function private.inventory_save_production_order_draft(uuid, uuid, uuid, numeric, text) to authenticated, service_role;
grant execute on function public.inventory_save_production_order_draft(uuid, uuid, uuid, numeric, text) to authenticated, service_role;

comment on function private.inventory_validate_bom_scope() is
  'Branch preprocessing recipes are shared system-wide; central and department recipes remain warehouse-scoped.';
comment on function public.inventory_save_production_order_draft(uuid, uuid, uuid, numeric, text) is
  'Creates a production/preprocessing draft from a shared recipe at an explicitly selected authorized warehouse.';

notify pgrst, 'reload schema';
