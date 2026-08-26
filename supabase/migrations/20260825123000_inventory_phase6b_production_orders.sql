-- Phase 6B: lệnh sản xuất tối giản nhưng có đủ dấu vết tồn kho và giá vốn.
-- Mọi biến động nguyên liệu/đầu ra được ghi trong cùng một transaction.

create sequence if not exists public.inventory_production_order_code_seq;

alter table public.inventory_documents
  drop constraint if exists inventory_documents_document_type_check;

alter table public.inventory_documents
  add constraint inventory_documents_document_type_check
  check (document_type in (
    'opening_balance',
    'purchase_receipt',
    'stock_issue',
    'transfer',
    'internal_requisition',
    'stock_count',
    'stock_adjustment',
    'waste',
    'return',
    'transfer_return',
    'reversal',
    'production_consumption',
    'production_output'
  ));

create table if not exists public.inventory_production_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  bom_id uuid not null references public.inventory_boms(id),
  output_item_id uuid not null references public.inventory_items(id),
  warehouse_id uuid not null references public.inventory_warehouses(id),
  output_unit_id uuid not null references public.inventory_units(id),
  output_conversion_to_base numeric(18,6) not null,
  planned_output_quantity numeric(18,6) not null,
  actual_output_quantity numeric(18,6),
  status text not null default 'draft',
  notes text,
  estimated_total_cost numeric(18,2) not null default 0,
  actual_total_cost numeric(18,2),
  actual_unit_cost numeric(18,2),
  input_document_id uuid references public.inventory_documents(id),
  output_document_id uuid references public.inventory_documents(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  started_at timestamptz,
  started_by uuid references auth.users(id),
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancellation_reason text,
  constraint inventory_production_orders_output_conversion_check check (output_conversion_to_base > 0),
  constraint inventory_production_orders_planned_output_check check (planned_output_quantity > 0),
  constraint inventory_production_orders_actual_output_check check (actual_output_quantity is null or actual_output_quantity > 0),
  constraint inventory_production_orders_status_check check (status in ('draft', 'in_progress', 'completed', 'cancelled')),
  constraint inventory_production_orders_actual_cost_check check (actual_total_cost is null or actual_total_cost >= 0),
  constraint inventory_production_orders_unit_cost_check check (actual_unit_cost is null or actual_unit_cost >= 0)
);

create table if not exists public.inventory_production_order_lines (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.inventory_production_orders(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id),
  unit_id uuid not null references public.inventory_units(id),
  conversion_to_base numeric(18,6) not null,
  waste_percent numeric(7,4) not null default 0,
  planned_quantity numeric(18,6) not null,
  planned_base_quantity numeric(18,6) not null,
  actual_quantity numeric(18,6),
  actual_base_quantity numeric(18,6),
  unit_cost numeric(18,2),
  line_total_cost numeric(18,2),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint inventory_production_order_lines_item_unique unique (production_order_id, item_id),
  constraint inventory_production_order_lines_conversion_check check (conversion_to_base > 0),
  constraint inventory_production_order_lines_waste_check check (waste_percent >= 0 and waste_percent <= 100),
  constraint inventory_production_order_lines_planned_quantity_check check (planned_quantity > 0),
  constraint inventory_production_order_lines_planned_base_check check (planned_base_quantity > 0),
  constraint inventory_production_order_lines_actual_quantity_check check (actual_quantity is null or actual_quantity > 0),
  constraint inventory_production_order_lines_actual_base_check check (actual_base_quantity is null or actual_base_quantity > 0),
  constraint inventory_production_order_lines_unit_cost_check check (unit_cost is null or unit_cost >= 0),
  constraint inventory_production_order_lines_line_cost_check check (line_total_cost is null or line_total_cost >= 0)
);

create table if not exists public.inventory_production_order_operations (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.inventory_production_orders(id) on delete cascade,
  operation text not null,
  idempotency_key text not null unique,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  constraint inventory_production_order_operations_unique unique (production_order_id, operation)
);

create index if not exists inventory_production_orders_warehouse_status_idx
  on public.inventory_production_orders(warehouse_id, status, created_at desc);

create index if not exists inventory_production_orders_bom_idx
  on public.inventory_production_orders(bom_id, created_at desc);

create index if not exists inventory_production_order_lines_order_idx
  on public.inventory_production_order_lines(production_order_id, display_order, item_id);

create or replace function public.inventory_save_production_order_draft(
  p_order_id uuid,
  p_bom_id uuid,
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
  v_factor numeric(18,8);
begin
  if v_actor is null then
    raise exception 'Phiên đăng nhập đã hết hạn.';
  end if;
  if coalesce(p_planned_output_quantity, 0) <= 0 then
    raise exception 'Số lượng cần sản xuất phải lớn hơn 0.';
  end if;

  select bom.* into v_bom
  from public.inventory_boms bom
  where bom.id = p_bom_id
    and bom.status = 'active'
    and bom.deleted_at is null
    and bom.effective_from <= current_date
    and (bom.effective_to is null or bom.effective_to >= current_date);

  if not found then
    raise exception 'Công thức không tồn tại hoặc chưa được kích hoạt.';
  end if;
  if not (select private.inventory_can_manage_bom(v_bom.default_warehouse_id, v_bom.production_scope)) then
    raise exception 'Bạn không có quyền lập lệnh sản xuất tại kho này.';
  end if;
  if v_bom.default_warehouse_id is null then
    raise exception 'Công thức chưa có kho thực hiện.';
  end if;

  if p_order_id is null then
    insert into public.inventory_production_orders (
      order_no, bom_id, output_item_id, warehouse_id, output_unit_id,
      output_conversion_to_base, planned_output_quantity, status, notes,
      created_by, updated_by
    ) values (
      'LSX-' || lpad(nextval('public.inventory_production_order_code_seq'::regclass)::text, 6, '0'),
      v_bom.id, v_bom.output_item_id, v_bom.default_warehouse_id, v_bom.yield_unit_id,
      v_bom.yield_conversion_to_base, p_planned_output_quantity, 'draft', nullif(btrim(p_notes), ''),
      v_actor, v_actor
    ) returning id into v_order_id;
  else
    select production_order.* into v_order
    from public.inventory_production_orders production_order
    where production_order.id = p_order_id
    for update;

    if not found or v_order.status <> 'draft' then
      raise exception 'Chỉ lệnh sản xuất bản nháp mới được sửa.';
    end if;
    if not (select private.inventory_can_manage_bom(v_order.warehouse_id, v_bom.production_scope)) then
      raise exception 'Bạn không có quyền sửa lệnh sản xuất này.';
    end if;

    update public.inventory_production_orders
    set bom_id = v_bom.id,
        output_item_id = v_bom.output_item_id,
        warehouse_id = v_bom.default_warehouse_id,
        output_unit_id = v_bom.yield_unit_id,
        output_conversion_to_base = v_bom.yield_conversion_to_base,
        planned_output_quantity = p_planned_output_quantity,
        notes = nullif(btrim(p_notes), ''),
        updated_at = now(),
        updated_by = v_actor
    where id = p_order_id;

    delete from public.inventory_production_order_lines
    where production_order_id = p_order_id;
    v_order_id := p_order_id;
  end if;

  v_factor := p_planned_output_quantity / v_bom.yield_quantity;

  insert into public.inventory_production_order_lines (
    production_order_id, item_id, unit_id, conversion_to_base, waste_percent,
    planned_quantity, planned_base_quantity, display_order, created_by, updated_by
  )
  select
    v_order_id,
    component.component_item_id,
    component.unit_id,
    component.conversion_to_base,
    component.waste_percent,
    round(component.quantity * v_factor * (1 + component.waste_percent / 100), 6),
    round(component.base_quantity * v_factor * (1 + component.waste_percent / 100), 6),
    component.display_order,
    v_actor,
    v_actor
  from public.inventory_bom_components component
  where component.bom_id = v_bom.id
  order by component.display_order, component.id;

  if not found then
    raise exception 'Công thức chưa có thành phần.';
  end if;

  update public.inventory_production_orders production_order
  set estimated_total_cost = coalesce((
        select round(sum(line.planned_base_quantity * coalesce(balance.average_cost, 0)), 2)
        from public.inventory_production_order_lines line
        left join public.inventory_stock_balances balance
          on balance.warehouse_id = production_order.warehouse_id
         and balance.item_id = line.item_id
        where line.production_order_id = production_order.id
      ), 0),
      updated_at = now(),
      updated_by = v_actor
  where production_order.id = v_order_id;

  return v_order_id;
end;
$$;

create or replace function public.inventory_start_production_order(
  p_order_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_order public.inventory_production_orders%rowtype;
  v_bom_scope text;
  v_existing jsonb;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'Phiên đăng nhập đã hết hạn.'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'Thiếu mã chống ghi trùng.'; end if;

  select operation.result into v_existing
  from public.inventory_production_order_operations operation
  where operation.production_order_id = p_order_id and operation.operation = 'start';
  if found then return v_existing || jsonb_build_object('idempotent_replay', true); end if;

  select production_order.*
  into v_order
  from public.inventory_production_orders production_order
  where production_order.id = p_order_id
  for update;

  if not found then raise exception 'Không tìm thấy lệnh sản xuất.'; end if;
  select bom.production_scope into v_bom_scope
  from public.inventory_boms bom where bom.id = v_order.bom_id;
  if not (select private.inventory_can_manage_bom(v_order.warehouse_id, v_bom_scope)) then
    raise exception 'Bạn không có quyền bắt đầu lệnh sản xuất này.';
  end if;
  if v_order.status <> 'draft' then raise exception 'Chỉ lệnh bản nháp mới được bắt đầu.'; end if;

  update public.inventory_production_orders
  set status = 'in_progress', started_at = now(), started_by = v_actor,
      updated_at = now(), updated_by = v_actor
  where id = p_order_id;

  v_result := jsonb_build_object('order_id', p_order_id, 'status', 'in_progress');
  insert into public.inventory_production_order_operations
    (production_order_id, operation, idempotency_key, result, created_by)
  values (p_order_id, 'start', btrim(p_idempotency_key), v_result, v_actor);
  return v_result;
end;
$$;

create or replace function public.inventory_complete_production_order(
  p_order_id uuid,
  p_actual_output_quantity numeric,
  p_actual_inputs jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_order public.inventory_production_orders%rowtype;
  v_bom_scope text;
  v_line record;
  v_actual_quantity numeric(18,6);
  v_actual_base numeric(18,6);
  v_output_base numeric(18,6);
  v_old_quantity numeric(18,6);
  v_old_cost numeric(18,2);
  v_new_quantity numeric(18,6);
  v_output_cost numeric(18,2);
  v_total_cost numeric(18,2) := 0;
  v_input_document_id uuid := gen_random_uuid();
  v_output_document_id uuid := gen_random_uuid();
  v_document_line_id uuid;
  v_existing jsonb;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'Phiên đăng nhập đã hết hạn.'; end if;
  if coalesce(p_actual_output_quantity, 0) <= 0 then raise exception 'Số lượng thành phẩm thực nhận phải lớn hơn 0.'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'Thiếu mã chống ghi trùng.'; end if;

  select operation.result into v_existing
  from public.inventory_production_order_operations operation
  where operation.production_order_id = p_order_id and operation.operation = 'complete';
  if found then return v_existing || jsonb_build_object('idempotent_replay', true); end if;

  select production_order.*
  into v_order
  from public.inventory_production_orders production_order
  where production_order.id = p_order_id
  for update;

  if not found then raise exception 'Không tìm thấy lệnh sản xuất.'; end if;
  select bom.production_scope into v_bom_scope
  from public.inventory_boms bom where bom.id = v_order.bom_id;
  if not (select private.inventory_can_manage_bom(v_order.warehouse_id, v_bom_scope)) then
    raise exception 'Bạn không có quyền hoàn thành lệnh sản xuất này.';
  end if;
  if v_order.status <> 'in_progress' then raise exception 'Lệnh phải ở trạng thái đang làm trước khi hoàn thành.'; end if;

  insert into public.inventory_stock_balances (warehouse_id, item_id, quantity, average_cost, updated_at)
  select v_order.warehouse_id, item_id, 0, 0, now()
  from (
    select line.item_id
    from public.inventory_production_order_lines line
    where line.production_order_id = p_order_id
    union
    select v_order.output_item_id
  ) item_set
  on conflict (warehouse_id, item_id) do nothing;

  perform balance.item_id
  from public.inventory_stock_balances balance
  where balance.warehouse_id = v_order.warehouse_id
    and balance.item_id in (
      select line.item_id from public.inventory_production_order_lines line where line.production_order_id = p_order_id
      union select v_order.output_item_id
    )
  order by balance.item_id
  for update;

  insert into public.inventory_documents (
    id, document_no, idempotency_key, document_type, status,
    source_warehouse_id, occurred_at, notes, metadata, created_by,
    submitted_at, submitted_by, completed_at, completed_by
  ) values (
    v_input_document_id,
    'SX-OUT-' || v_order.order_no,
    btrim(p_idempotency_key) || ':input',
    'production_consumption', 'completed', v_order.warehouse_id, now(),
    'Xuất nguyên liệu cho lệnh ' || v_order.order_no,
    jsonb_build_object('production_order_id', p_order_id, 'production_order_no', v_order.order_no),
    v_actor, now(), v_actor, now(), v_actor
  );

  for v_line in
    select line.*
    from public.inventory_production_order_lines line
    where line.production_order_id = p_order_id
    order by line.item_id
  loop
    select coalesce(
      (
        select nullif(input_row->>'actualQuantity', '')::numeric
        from jsonb_array_elements(coalesce(p_actual_inputs, '[]'::jsonb)) input_row
        where input_row->>'lineId' = v_line.id::text
        limit 1
      ),
      v_line.planned_quantity
    ) into v_actual_quantity;

    if coalesce(v_actual_quantity, 0) <= 0 then
      raise exception 'Số lượng nguyên liệu thực dùng phải lớn hơn 0.';
    end if;
    v_actual_base := round(v_actual_quantity * v_line.conversion_to_base, 6);

    select balance.quantity, balance.average_cost
    into v_old_quantity, v_old_cost
    from public.inventory_stock_balances balance
    where balance.warehouse_id = v_order.warehouse_id and balance.item_id = v_line.item_id;

    if v_old_quantity < v_actual_base then
      raise exception 'Tồn kho không đủ cho %. Hiện có %, cần dùng % (đơn vị lưu kho).',
        v_line.item_id, v_old_quantity, v_actual_base;
    end if;

    v_document_line_id := gen_random_uuid();
    insert into public.inventory_document_lines (
      id, document_id, item_id, unit_id, conversion_to_base,
      expected_quantity, actual_quantity, base_quantity, unit_price, notes
    ) values (
      v_document_line_id, v_input_document_id, v_line.item_id, v_line.unit_id, v_line.conversion_to_base,
      v_line.planned_quantity, v_actual_quantity, v_actual_base,
      round(v_old_cost * v_line.conversion_to_base, 2), 'Tiêu hao theo lệnh sản xuất'
    );

    insert into public.inventory_stock_movements (
      warehouse_id, item_id, document_id, document_line_id, direction,
      movement_stage, quantity, unit_cost, occurred_at, created_by
    ) values (
      v_order.warehouse_id, v_line.item_id, v_input_document_id, v_document_line_id, 'out',
      'order_consumption', v_actual_base, v_old_cost, now(), v_actor
    );

    update public.inventory_stock_balances
    set quantity = quantity - v_actual_base, updated_at = now()
    where warehouse_id = v_order.warehouse_id and item_id = v_line.item_id;

    update public.inventory_production_order_lines
    set actual_quantity = v_actual_quantity,
        actual_base_quantity = v_actual_base,
        unit_cost = v_old_cost,
        line_total_cost = round(v_actual_base * v_old_cost, 2),
        updated_at = now(),
        updated_by = v_actor
    where id = v_line.id;

    v_total_cost := v_total_cost + round(v_actual_base * v_old_cost, 2);
  end loop;

  v_output_base := round(p_actual_output_quantity * v_order.output_conversion_to_base, 6);
  v_output_cost := case when v_output_base > 0 then round(v_total_cost / v_output_base, 2) else 0 end;

  select balance.quantity, balance.average_cost
  into v_old_quantity, v_old_cost
  from public.inventory_stock_balances balance
  where balance.warehouse_id = v_order.warehouse_id and balance.item_id = v_order.output_item_id;

  v_new_quantity := v_old_quantity + v_output_base;

  insert into public.inventory_documents (
    id, document_no, idempotency_key, document_type, status,
    destination_warehouse_id, occurred_at, notes, total_amount, metadata, created_by,
    submitted_at, submitted_by, completed_at, completed_by, source_document_id
  ) values (
    v_output_document_id,
    'SX-IN-' || v_order.order_no,
    btrim(p_idempotency_key) || ':output',
    'production_output', 'completed', v_order.warehouse_id, now(),
    'Nhập thành phẩm từ lệnh ' || v_order.order_no,
    v_total_cost,
    jsonb_build_object('production_order_id', p_order_id, 'production_order_no', v_order.order_no),
    v_actor, now(), v_actor, now(), v_actor, v_input_document_id
  );

  v_document_line_id := gen_random_uuid();
  insert into public.inventory_document_lines (
    id, document_id, item_id, unit_id, conversion_to_base,
    expected_quantity, actual_quantity, base_quantity, unit_price, notes
  ) values (
    v_document_line_id, v_output_document_id, v_order.output_item_id, v_order.output_unit_id,
    v_order.output_conversion_to_base, v_order.planned_output_quantity, p_actual_output_quantity,
    v_output_base, round(v_output_cost * v_order.output_conversion_to_base, 2), 'Thành phẩm hoàn thành'
  );

  insert into public.inventory_stock_movements (
    warehouse_id, item_id, document_id, document_line_id, direction,
    movement_stage, quantity, unit_cost, occurred_at, created_by
  ) values (
    v_order.warehouse_id, v_order.output_item_id, v_output_document_id, v_document_line_id, 'in',
    'completion', v_output_base, v_output_cost, now(), v_actor
  );

  update public.inventory_stock_balances
  set quantity = v_new_quantity,
      average_cost = case
        when v_new_quantity <= 0 then average_cost
        when v_old_quantity > 0 then round(((v_old_quantity * v_old_cost) + v_total_cost) / v_new_quantity, 2)
        else v_output_cost
      end,
      updated_at = now()
  where warehouse_id = v_order.warehouse_id and item_id = v_order.output_item_id;

  update public.inventory_documents
  set total_amount = v_total_cost
  where id = v_input_document_id;

  update public.inventory_production_orders
  set status = 'completed', actual_output_quantity = p_actual_output_quantity,
      actual_total_cost = v_total_cost, actual_unit_cost = v_output_cost,
      input_document_id = v_input_document_id, output_document_id = v_output_document_id,
      completed_at = now(), completed_by = v_actor,
      updated_at = now(), updated_by = v_actor
  where id = p_order_id;

  v_result := jsonb_build_object(
    'order_id', p_order_id,
    'status', 'completed',
    'actual_output_quantity', p_actual_output_quantity,
    'actual_total_cost', v_total_cost,
    'actual_unit_cost', v_output_cost
  );

  insert into public.inventory_production_order_operations
    (production_order_id, operation, idempotency_key, result, created_by)
  values (p_order_id, 'complete', btrim(p_idempotency_key), v_result, v_actor);
  return v_result;
end;
$$;

create or replace function public.inventory_cancel_production_order(
  p_order_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_order public.inventory_production_orders%rowtype;
  v_bom_scope text;
  v_existing jsonb;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'Phiên đăng nhập đã hết hạn.'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'Vui lòng nhập lý do hủy lệnh.'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'Thiếu mã chống ghi trùng.'; end if;

  select operation.result into v_existing
  from public.inventory_production_order_operations operation
  where operation.production_order_id = p_order_id and operation.operation = 'cancel';
  if found then return v_existing || jsonb_build_object('idempotent_replay', true); end if;

  select production_order.*
  into v_order
  from public.inventory_production_orders production_order
  where production_order.id = p_order_id
  for update;

  if not found then raise exception 'Không tìm thấy lệnh sản xuất.'; end if;
  select bom.production_scope into v_bom_scope
  from public.inventory_boms bom where bom.id = v_order.bom_id;
  if not (select private.inventory_can_manage_bom(v_order.warehouse_id, v_bom_scope)) then
    raise exception 'Bạn không có quyền hủy lệnh sản xuất này.';
  end if;
  if v_order.status not in ('draft', 'in_progress') then raise exception 'Lệnh đã hoàn thành hoặc đã hủy.'; end if;

  update public.inventory_production_orders
  set status = 'cancelled', cancellation_reason = btrim(p_reason),
      cancelled_at = now(), cancelled_by = v_actor,
      updated_at = now(), updated_by = v_actor
  where id = p_order_id;

  v_result := jsonb_build_object('order_id', p_order_id, 'status', 'cancelled');
  insert into public.inventory_production_order_operations
    (production_order_id, operation, idempotency_key, result, created_by)
  values (p_order_id, 'cancel', btrim(p_idempotency_key), v_result, v_actor);
  return v_result;
end;
$$;

create or replace function public.inventory_delete_production_order_draft(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_order public.inventory_production_orders%rowtype;
  v_bom_scope text;
begin
  if v_actor is null then raise exception 'Phiên đăng nhập đã hết hạn.'; end if;
  select production_order.*
  into v_order
  from public.inventory_production_orders production_order
  where production_order.id = p_order_id
  for update;
  if not found or v_order.status <> 'draft' then raise exception 'Chỉ lệnh bản nháp mới được xóa.'; end if;
  select bom.production_scope into v_bom_scope
  from public.inventory_boms bom where bom.id = v_order.bom_id;
  if not (select private.inventory_can_manage_bom(v_order.warehouse_id, v_bom_scope)) then
    raise exception 'Bạn không có quyền xóa lệnh sản xuất này.';
  end if;
  delete from public.inventory_production_orders where id = p_order_id;
  return true;
end;
$$;

alter table public.inventory_production_orders enable row level security;
alter table public.inventory_production_order_lines enable row level security;
alter table public.inventory_production_order_operations enable row level security;

revoke all on table public.inventory_production_orders from public, anon, authenticated;
revoke all on table public.inventory_production_order_lines from public, anon, authenticated;
revoke all on table public.inventory_production_order_operations from public, anon, authenticated;

grant select on table public.inventory_production_orders to authenticated;
grant select on table public.inventory_production_order_lines to authenticated;
grant all on table public.inventory_production_orders to service_role;
grant all on table public.inventory_production_order_lines to service_role;
grant all on table public.inventory_production_order_operations to service_role;
grant usage, select on sequence public.inventory_production_order_code_seq to service_role;

drop policy if exists inventory_production_orders_select on public.inventory_production_orders;
create policy inventory_production_orders_select
on public.inventory_production_orders for select to authenticated
using ((select private.inventory_can_view_bom(warehouse_id)));

drop policy if exists inventory_production_order_lines_select on public.inventory_production_order_lines;
create policy inventory_production_order_lines_select
on public.inventory_production_order_lines for select to authenticated
using (
  exists (
    select 1 from public.inventory_production_orders production_order
    where production_order.id = production_order_id
      and (select private.inventory_can_view_bom(production_order.warehouse_id))
  )
);

revoke all on function public.inventory_save_production_order_draft(uuid, uuid, numeric, text) from public, anon;
revoke all on function public.inventory_start_production_order(uuid, text) from public, anon;
revoke all on function public.inventory_complete_production_order(uuid, numeric, jsonb, text) from public, anon;
revoke all on function public.inventory_cancel_production_order(uuid, text, text) from public, anon;
revoke all on function public.inventory_delete_production_order_draft(uuid) from public, anon;

grant execute on function public.inventory_save_production_order_draft(uuid, uuid, numeric, text) to authenticated, service_role;
grant execute on function public.inventory_start_production_order(uuid, text) to authenticated, service_role;
grant execute on function public.inventory_complete_production_order(uuid, numeric, jsonb, text) to authenticated, service_role;
grant execute on function public.inventory_cancel_production_order(uuid, text, text) to authenticated, service_role;
grant execute on function public.inventory_delete_production_order_draft(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

comment on table public.inventory_production_orders is
  'Lệnh sản xuất/sơ chế; chỉ hoàn thành mới ghi giảm nguyên liệu và tăng bán thành phẩm.';
comment on function public.inventory_complete_production_order(uuid, numeric, jsonb, text) is
  'Hoàn thành lệnh nguyên tử: trừ nguyên liệu theo đơn vị gốc, nhập đầu ra và tính giá vốn bình quân.';
