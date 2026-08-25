alter table public.inventory_document_lines
  add column if not exists adjustment_direction text;

alter table public.inventory_document_lines
  drop constraint if exists inventory_document_lines_adjustment_direction_check;

alter table public.inventory_document_lines
  add constraint inventory_document_lines_adjustment_direction_check
  check (adjustment_direction is null or adjustment_direction in ('in', 'out'));

alter table public.inventory_documents
  drop constraint if exists inventory_documents_stock_adjustment_source_check;

alter table public.inventory_documents
  add constraint inventory_documents_stock_adjustment_source_check
  check (document_type <> 'stock_adjustment' or source_warehouse_id is not null);

create or replace function private.inventory_approve_stock_adjustment_impl(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_line record;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_allow_negative boolean;
  v_quantity numeric(18,6);
  v_old_quantity numeric(18,6);
  v_average_cost numeric(18,2);
  v_new_quantity numeric(18,6);
  v_movement_count integer := 0;
  v_total_amount numeric(18,2) := 0;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để duyệt phiếu điều chỉnh tồn.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác duyệt điều chỉnh.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found or v_document.document_type <> 'stock_adjustment' then
    raise exception 'Không tìm thấy phiếu điều chỉnh tồn hợp lệ.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'approve_stock_adjustment';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Phiếu đã được duyệt bằng một idempotency key khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'submitted' then
    raise exception 'Chỉ phiếu đang chờ duyệt mới được ghi sổ. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if v_document.source_warehouse_id is null then
    raise exception 'Phiếu chưa chọn kho cần điều chỉnh.';
  end if;

  if nullif(btrim(v_document.notes), '') is null then
    raise exception 'Phiếu điều chỉnh tồn phải có lý do.';
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_document.source_warehouse_id
          and access.role in ('central_manager', 'branch_manager')
        )
      )
  ) then
    raise exception 'Chỉ Admin hoặc quản lý được phân quyền đúng kho mới được duyệt điều chỉnh tồn.';
  end if;

  select warehouse.allow_negative_stock
  into v_allow_negative
  from public.inventory_warehouses warehouse
  where warehouse.id = v_document.source_warehouse_id
    and warehouse.is_active;

  if not found then
    raise exception 'Kho điều chỉnh không tồn tại hoặc đã ngừng hoạt động.';
  end if;

  if not exists (
    select 1
    from public.inventory_document_lines line
    where line.document_id = p_document_id
      and line.adjustment_direction in ('in', 'out')
      and line.actual_quantity > 0
      and line.conversion_to_base > 0
  ) then
    raise exception 'Phiếu phải có ít nhất một dòng tăng hoặc giảm tồn hợp lệ.';
  end if;

  if exists (
    select 1
    from public.inventory_document_lines line
    where line.document_id = p_document_id
      and (
        line.adjustment_direction is null
        or line.actual_quantity is null
        or line.actual_quantity <= 0
        or line.conversion_to_base <= 0
      )
  ) then
    raise exception 'Phiếu còn dòng thiếu chiều điều chỉnh hoặc số lượng.';
  end if;

  insert into public.inventory_stock_balances (
    warehouse_id, item_id, quantity, average_cost, updated_at
  )
  select distinct
    v_document.source_warehouse_id, line.item_id, 0, 0, clock_timestamp()
  from public.inventory_document_lines line
  where line.document_id = p_document_id
  on conflict (warehouse_id, item_id) do nothing;

  perform balance.item_id
  from public.inventory_stock_balances balance
  join public.inventory_document_lines line
    on line.item_id = balance.item_id
   and line.document_id = p_document_id
  where balance.warehouse_id = v_document.source_warehouse_id
  order by balance.item_id
  for update of balance;

  for v_line in
    select line.*
    from public.inventory_document_lines line
    where line.document_id = p_document_id
    order by line.item_id
  loop
    v_quantity := v_line.actual_quantity * v_line.conversion_to_base;

    select balance.quantity, balance.average_cost
    into v_old_quantity, v_average_cost
    from public.inventory_stock_balances balance
    where balance.warehouse_id = v_document.source_warehouse_id
      and balance.item_id = v_line.item_id
    for update;

    v_new_quantity := case
      when v_line.adjustment_direction = 'in' then v_old_quantity + v_quantity
      else v_old_quantity - v_quantity
    end;

    if not v_allow_negative and v_new_quantity < 0 then
      raise exception 'Điều chỉnh làm âm tồn mặt hàng %. Hiện có %, cần giảm %.',
        v_line.item_id,
        v_old_quantity,
        v_quantity;
    end if;

    insert into public.inventory_stock_movements (
      warehouse_id,
      item_id,
      document_id,
      document_line_id,
      direction,
      movement_stage,
      quantity,
      unit_cost,
      occurred_at,
      created_by
    )
    values (
      v_document.source_warehouse_id,
      v_line.item_id,
      p_document_id,
      v_line.id,
      v_line.adjustment_direction,
      'adjustment',
      v_quantity,
      v_average_cost,
      v_document.occurred_at,
      v_actor
    );

    update public.inventory_stock_balances
    set quantity = v_new_quantity,
        updated_at = clock_timestamp()
    where warehouse_id = v_document.source_warehouse_id
      and item_id = v_line.item_id;

    update public.inventory_document_lines
    set approved_quantity = actual_quantity,
        base_quantity = v_quantity,
        unit_price = v_average_cost
    where id = v_line.id;

    v_total_amount := v_total_amount + v_quantity * v_average_cost;
    v_movement_count := v_movement_count + 1;
  end loop;

  update public.inventory_documents
  set status = 'completed',
      approved_at = clock_timestamp(),
      approved_by = v_actor,
      completed_at = clock_timestamp(),
      completed_by = v_actor,
      total_amount = v_total_amount
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id, event_type, from_status, to_status, event_data, created_by
  )
  values (
    p_document_id,
    'stock_adjustment_approved',
    'submitted',
    'completed',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'warehouse_id', v_document.source_warehouse_id,
      'movement_count', v_movement_count
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'completed',
    'warehouse_id', v_document.source_warehouse_id,
    'movement_count', v_movement_count,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id, operation, idempotency_key, result, created_by
  )
  values (
    p_document_id,
    'approve_stock_adjustment',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function public.inventory_approve_stock_adjustment(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_approve_stock_adjustment_impl(p_document_id, p_idempotency_key);
$$;

revoke all on function private.inventory_approve_stock_adjustment_impl(uuid, text) from public;
revoke all on function public.inventory_approve_stock_adjustment(uuid, text) from public;
grant execute on function private.inventory_approve_stock_adjustment_impl(uuid, text) to authenticated;
grant execute on function public.inventory_approve_stock_adjustment(uuid, text) to authenticated;

notify pgrst, 'reload schema';
