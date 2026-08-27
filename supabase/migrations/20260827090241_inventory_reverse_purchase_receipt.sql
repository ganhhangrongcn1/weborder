create unique index if not exists inventory_documents_purchase_reversal_unique
  on public.inventory_documents (source_document_id)
  where document_type = 'reversal';

create or replace function private.inventory_reverse_purchase_receipt_impl(
  p_document_id uuid,
  p_idempotency_key text,
  p_reversal_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_existing_result jsonb;
  v_existing_key text;
  v_reason text := nullif(btrim(coalesce(p_reversal_reason, '')), '');
  v_reversal_document_id uuid;
  v_reversal_document_no text;
  v_reversal_line_id uuid;
  v_line record;
  v_old_quantity numeric(18,6);
  v_old_average_cost numeric(18,2);
  v_new_quantity numeric(18,6);
  v_new_inventory_value numeric(24,6);
  v_new_average_cost numeric(18,2);
  v_quantity numeric(18,6);
  v_movement_count integer := 0;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để hoàn tác phiếu nhập kho.';
  end if;

  if p_document_id is null
     or nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'Thiếu phiếu hoặc khóa chống trùng khi hoàn tác phiếu nhập.';
  end if;

  if v_reason is null then
    raise exception 'Vui lòng nhập lý do hoàn tác phiếu nhập.';
  end if;

  if not (select private.inventory_is_admin()) then
    raise exception 'Chỉ Admin hoặc quản lý Tổng kho được hoàn tác phiếu nhập.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found or v_document.document_type <> 'purchase_receipt' then
    raise exception 'Không tìm thấy phiếu nhập mua hợp lệ.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'reverse_purchase_receipt';

  if found then
    if v_existing_key <> btrim(p_idempotency_key)
       or coalesce(v_existing_result ->> 'reversal_reason', '') <> v_reason then
      raise exception 'Phiếu đã được hoàn tác bằng khóa hoặc lý do khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
  ) then
    raise exception 'Khóa chống trùng đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'completed' then
    raise exception 'Chỉ phiếu nhập đã hoàn tất mới được hoàn tác. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if v_document.destination_warehouse_id is null then
    raise exception 'Phiếu nhập chưa xác định kho nhận.';
  end if;

  if exists (
    select 1
    from public.inventory_documents reversal
    where reversal.document_type = 'reversal'
      and reversal.source_document_id = p_document_id
  ) then
    raise exception 'Phiếu nhập này đã có chứng từ hoàn tác.';
  end if;

  if not exists (
    select 1
    from public.inventory_stock_movements movement
    where movement.document_id = p_document_id
      and movement.direction = 'in'
      and movement.movement_stage = 'completion'
  ) then
    raise exception 'Phiếu nhập chưa có bút toán tồn kho để hoàn tác.';
  end if;

  perform balance.item_id
  from public.inventory_stock_balances balance
  join public.inventory_stock_movements movement
    on movement.warehouse_id = balance.warehouse_id
   and movement.item_id = balance.item_id
   and movement.document_id = p_document_id
   and movement.direction = 'in'
   and movement.movement_stage = 'completion'
  where balance.warehouse_id = v_document.destination_warehouse_id
  order by balance.item_id
  for update of balance;

  for v_line in
    select
      line.*,
      movement.quantity as movement_quantity,
      movement.unit_cost as movement_unit_cost
    from public.inventory_document_lines line
    join public.inventory_stock_movements movement
      on movement.document_line_id = line.id
     and movement.document_id = line.document_id
     and movement.direction = 'in'
     and movement.movement_stage = 'completion'
    where line.document_id = p_document_id
    order by line.item_id
  loop
    v_quantity := v_line.movement_quantity;

    select balance.quantity, balance.average_cost
    into v_old_quantity, v_old_average_cost
    from public.inventory_stock_balances balance
    where balance.warehouse_id = v_document.destination_warehouse_id
      and balance.item_id = v_line.item_id
    for update;

    if not found or v_old_quantity < v_quantity then
      raise exception 'Không thể hoàn tác vì tồn hiện tại của mặt hàng % chỉ còn %, thấp hơn số đã nhập %.',
        v_line.item_id,
        coalesce(v_old_quantity, 0),
        v_quantity;
    end if;

    if exists (
      select 1
      from public.inventory_stock_lots lot
      where lot.source_document_line_id = v_line.id
        and lot.remaining_quantity < v_quantity
    ) then
      raise exception 'Không thể hoàn tác vì lô hàng của mặt hàng % không còn đủ số lượng.', v_line.item_id;
    end if;

    v_new_quantity := v_old_quantity - v_quantity;
    v_new_inventory_value :=
      (v_old_quantity * v_old_average_cost)
      - (v_quantity * v_line.movement_unit_cost);

    if v_new_quantity > 0 and v_new_inventory_value < -0.01 then
      raise exception 'Không thể tự động hoàn tác giá vốn của mặt hàng %. Vui lòng dùng phiếu điều chỉnh.', v_line.item_id;
    end if;
  end loop;

  v_reversal_document_no := 'HT-' || v_document.document_no;

  insert into public.inventory_documents (
    document_no,
    idempotency_key,
    document_type,
    status,
    source_warehouse_id,
    supplier_id,
    source_document_id,
    reference_no,
    occurred_at,
    notes,
    total_amount,
    metadata,
    created_by,
    submitted_at,
    submitted_by,
    approved_at,
    approved_by,
    completed_at,
    completed_by,
    reversal_reason
  ) values (
    v_reversal_document_no,
    btrim(p_idempotency_key),
    'reversal',
    'completed',
    v_document.destination_warehouse_id,
    v_document.supplier_id,
    p_document_id,
    v_document.document_no,
    clock_timestamp(),
    'Hoàn tác phiếu nhập ' || v_document.document_no || ': ' || v_reason,
    v_document.total_amount,
    jsonb_build_object(
      'source_document_no', v_document.document_no,
      'reversal_reason', v_reason
    ),
    v_actor,
    clock_timestamp(),
    v_actor,
    clock_timestamp(),
    v_actor,
    clock_timestamp(),
    v_actor,
    v_reason
  )
  returning id into v_reversal_document_id;

  for v_line in
    select
      line.*,
      movement.quantity as movement_quantity,
      movement.unit_cost as movement_unit_cost
    from public.inventory_document_lines line
    join public.inventory_stock_movements movement
      on movement.document_line_id = line.id
     and movement.document_id = line.document_id
     and movement.direction = 'in'
     and movement.movement_stage = 'completion'
    where line.document_id = p_document_id
    order by line.item_id
  loop
    v_quantity := v_line.movement_quantity;

    insert into public.inventory_document_lines (
      document_id,
      item_id,
      unit_id,
      conversion_to_base,
      expected_quantity,
      actual_quantity,
      base_quantity,
      unit_price,
      lot_number,
      manufactured_on,
      expires_on,
      notes
    ) values (
      v_reversal_document_id,
      v_line.item_id,
      v_line.unit_id,
      v_line.conversion_to_base,
      v_quantity / v_line.conversion_to_base,
      v_quantity / v_line.conversion_to_base,
      v_quantity,
      v_line.movement_unit_cost * v_line.conversion_to_base,
      v_line.lot_number,
      v_line.manufactured_on,
      v_line.expires_on,
      v_reason
    )
    returning id into v_reversal_line_id;

    select balance.quantity, balance.average_cost
    into v_old_quantity, v_old_average_cost
    from public.inventory_stock_balances balance
    where balance.warehouse_id = v_document.destination_warehouse_id
      and balance.item_id = v_line.item_id
    for update;

    v_new_quantity := v_old_quantity - v_quantity;
    v_new_inventory_value :=
      (v_old_quantity * v_old_average_cost)
      - (v_quantity * v_line.movement_unit_cost);
    v_new_average_cost := case
      when v_new_quantity <= 0 then 0
      else round(greatest(v_new_inventory_value, 0) / v_new_quantity, 2)
    end;

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
    ) values (
      v_document.destination_warehouse_id,
      v_line.item_id,
      v_reversal_document_id,
      v_reversal_line_id,
      'out',
      'reversal',
      v_quantity,
      v_line.movement_unit_cost,
      clock_timestamp(),
      v_actor
    );

    update public.inventory_stock_balances
    set quantity = v_new_quantity,
        average_cost = v_new_average_cost,
        updated_at = clock_timestamp()
    where warehouse_id = v_document.destination_warehouse_id
      and item_id = v_line.item_id;

    update public.inventory_stock_lots
    set remaining_quantity = remaining_quantity - v_quantity,
        status = case when remaining_quantity - v_quantity <= 0 then 'depleted' else status end,
        metadata = metadata || jsonb_build_object(
          'reversed_by_document_id', v_reversal_document_id,
          'reversal_reason', v_reason
        ),
        updated_at = clock_timestamp()
    where source_document_line_id = v_line.id;

    v_movement_count := v_movement_count + 1;
  end loop;

  update public.inventory_documents
  set status = 'cancelled',
      cancelled_at = clock_timestamp(),
      cancelled_by = v_actor,
      cancellation_reason = v_reason,
      metadata = metadata || jsonb_build_object(
        'reversal_document_id', v_reversal_document_id,
        'reversal_document_no', v_reversal_document_no
      )
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id,
    event_type,
    from_status,
    to_status,
    event_data,
    created_by
  ) values
  (
    p_document_id,
    'purchase_receipt_reversed',
    'completed',
    'cancelled',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'reversal_document_id', v_reversal_document_id,
      'reversal_document_no', v_reversal_document_no,
      'reversal_reason', v_reason,
      'movement_count', v_movement_count
    ),
    v_actor
  ),
  (
    v_reversal_document_id,
    'reversal_completed',
    null,
    'completed',
    jsonb_build_object(
      'source_document_id', p_document_id,
      'source_document_no', v_document.document_no,
      'reversal_reason', v_reason,
      'movement_count', v_movement_count
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'cancelled',
    'reversal_document_id', v_reversal_document_id,
    'reversal_document_no', v_reversal_document_no,
    'reversal_reason', v_reason,
    'movement_count', v_movement_count,
    'stock_changed', true,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id,
    operation,
    idempotency_key,
    result,
    created_by
  ) values (
    p_document_id,
    'reverse_purchase_receipt',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$function$;

create or replace function public.inventory_reverse_purchase_receipt(
  p_document_id uuid,
  p_idempotency_key text,
  p_reversal_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.inventory_reverse_purchase_receipt_impl(
    p_document_id,
    p_idempotency_key,
    p_reversal_reason
  );
$function$;

revoke all on function private.inventory_reverse_purchase_receipt_impl(uuid, text, text)
from public, anon;
revoke all on function public.inventory_reverse_purchase_receipt(uuid, text, text)
from public, anon;

grant execute on function private.inventory_reverse_purchase_receipt_impl(uuid, text, text)
to authenticated, service_role;
grant execute on function public.inventory_reverse_purchase_receipt(uuid, text, text)
to authenticated, service_role;

comment on function public.inventory_reverse_purchase_receipt(uuid, text, text) is
  'Hoàn tác toàn bộ phiếu nhập mua đã hoàn tất bằng chứng từ reversal; chặn khi tồn hoặc giá trị kho không đủ.';

notify pgrst, 'reload schema';
