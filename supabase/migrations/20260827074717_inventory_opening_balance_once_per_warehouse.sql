create unique index if not exists inventory_documents_one_completed_opening_per_warehouse
  on public.inventory_documents (destination_warehouse_id)
  where document_type = 'opening_balance'
    and status = 'completed';

create or replace function public.inventory_create_opening_balance(
  p_warehouse_id uuid,
  p_occurred_at timestamptz,
  p_notes text,
  p_lines jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_document_id uuid;
  v_document_no text;
  v_total_amount numeric(18,2);
  v_result jsonb;
  v_line_count integer;
  v_line record;
  v_base_quantity numeric(18,6);
  v_base_unit_cost numeric(18,2);
  v_movement_count integer := 0;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để nhập tồn đầu kỳ.';
  end if;

  if not (select private.inventory_is_admin()) then
    raise exception 'Chỉ Admin hoặc Quản lý Tổng kho được nhập tồn đầu kỳ.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.inventory_warehouses warehouse
    where warehouse.id = p_warehouse_id
      and warehouse.is_active
      and warehouse.deleted_at is null
  ) then
    raise exception 'Kho không tồn tại hoặc đã ngừng hoạt động.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu mã chống ghi nhận trùng.';
  end if;

  select document.id
  into v_document_id
  from public.inventory_documents document
  where document.idempotency_key = btrim(p_idempotency_key)
    and document.document_type = 'opening_balance';

  if found then
    return jsonb_build_object(
      'ok', true,
      'document_id', v_document_id,
      'status', 'completed',
      'idempotent_replay', true
    );
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Tồn đầu kỳ cần ít nhất một nguyên vật liệu.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_warehouse_id::text, 0));

  if exists (
    select 1
    from public.inventory_documents document
    where document.document_type = 'opening_balance'
      and document.status = 'completed'
      and document.destination_warehouse_id = p_warehouse_id
  ) then
    raise exception 'Kho này đã nhập tồn đầu kỳ. Hãy dùng Phiếu nhập kho hoặc Điều chỉnh tồn cho thay đổi tiếp theo.';
  end if;

  if exists (
    select 1
    from public.inventory_stock_movements movement
    where movement.warehouse_id = p_warehouse_id
  ) or exists (
    select 1
    from public.inventory_stock_balances balance
    where balance.warehouse_id = p_warehouse_id
      and balance.quantity <> 0
  ) then
    raise exception 'Kho đã có phát sinh nhập, xuất hoặc trừ tồn. Không thể nhập tồn đầu kỳ sau khi kho đã vận hành.';
  end if;

  with input_lines as (
    select *
    from jsonb_to_recordset(p_lines) as input(
      item_id uuid,
      unit_id uuid,
      conversion_to_base numeric,
      quantity numeric,
      unit_price numeric
    )
  )
  select count(*)
  into v_line_count
  from input_lines input
  join public.inventory_items item
    on item.id = input.item_id
   and item.is_active
  join public.inventory_units unit
    on unit.id = input.unit_id
   and unit.is_active
  where input.quantity > 0
    and input.unit_price >= 0
    and (
      unit.id = item.base_unit_id
      or unit.id = item.purchase_unit_id
      or unit.base_unit_id = item.base_unit_id
    );

  if v_line_count <> jsonb_array_length(p_lines) then
    raise exception 'Có nguyên vật liệu, đơn vị, số lượng hoặc giá vốn chưa hợp lệ.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as input(item_id uuid)
    group by input.item_id
    having count(*) > 1
  ) then
    raise exception 'Một nguyên vật liệu chỉ được xuất hiện một lần trong tồn đầu kỳ.';
  end if;

  select round(sum(input.quantity * input.unit_price), 2)
  into v_total_amount
  from jsonb_to_recordset(p_lines) as input(quantity numeric, unit_price numeric);

  v_document_id := gen_random_uuid();
  v_document_no := 'TDK-' || to_char(coalesce(p_occurred_at, now()) at time zone 'Asia/Bangkok', 'YYYYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  insert into public.inventory_documents (
    id,
    document_no,
    idempotency_key,
    document_type,
    status,
    destination_warehouse_id,
    occurred_at,
    notes,
    total_amount,
    metadata,
    created_by
  )
  values (
    v_document_id,
    v_document_no,
    btrim(p_idempotency_key),
    'opening_balance',
    'draft',
    p_warehouse_id,
    coalesce(p_occurred_at, now()),
    nullif(btrim(coalesce(p_notes, '')), ''),
    coalesce(v_total_amount, 0),
    jsonb_build_object('source', 'opening_balance_setup', 'one_time', true),
    v_actor
  );

  insert into public.inventory_document_lines (
    document_id,
    item_id,
    unit_id,
    conversion_to_base,
    expected_quantity,
    actual_quantity,
    unit_price
  )
  select
    v_document_id,
    input.item_id,
    input.unit_id,
    case
      when input.unit_id = item.base_unit_id then 1
      when input.unit_id = item.purchase_unit_id and item.purchase_to_base_ratio > 0 then item.purchase_to_base_ratio
      when unit.base_unit_id = item.base_unit_id and unit.conversion_factor > 0 then unit.conversion_factor
      else 1
    end,
    input.quantity,
    input.quantity,
    input.unit_price
  from jsonb_to_recordset(p_lines) as input(
    item_id uuid,
    unit_id uuid,
    conversion_to_base numeric,
    quantity numeric,
    unit_price numeric
  )
  join public.inventory_items item on item.id = input.item_id
  join public.inventory_units unit on unit.id = input.unit_id;

  perform private.inventory_submit_document_impl(
    v_document_id,
    btrim(p_idempotency_key) || '-submit'
  );

  insert into public.inventory_stock_balances (
    warehouse_id,
    item_id,
    quantity,
    average_cost,
    updated_at
  )
  select distinct
    p_warehouse_id,
    line.item_id,
    0,
    0,
    now()
  from public.inventory_document_lines line
  where line.document_id = v_document_id
  on conflict (warehouse_id, item_id) do nothing;

  perform balance.item_id
  from public.inventory_stock_balances balance
  join public.inventory_document_lines line
    on line.item_id = balance.item_id
   and line.document_id = v_document_id
  where balance.warehouse_id = p_warehouse_id
  order by balance.item_id
  for update of balance;

  for v_line in
    select line.*
    from public.inventory_document_lines line
    where line.document_id = v_document_id
    order by line.item_id
  loop
    v_base_quantity := v_line.actual_quantity * v_line.conversion_to_base;
    v_base_unit_cost := round(v_line.unit_price / v_line.conversion_to_base, 2);

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
      p_warehouse_id,
      v_line.item_id,
      v_document_id,
      v_line.id,
      'in',
      'completion',
      v_base_quantity,
      v_base_unit_cost,
      coalesce(p_occurred_at, now()),
      v_actor
    );

    update public.inventory_stock_balances
    set quantity = v_base_quantity,
        average_cost = v_base_unit_cost,
        updated_at = now()
    where warehouse_id = p_warehouse_id
      and item_id = v_line.item_id;

    update public.inventory_document_lines
    set base_quantity = v_base_quantity
    where id = v_line.id;

    v_movement_count := v_movement_count + 1;
  end loop;

  update public.inventory_documents
  set status = 'completed',
      completed_at = now(),
      completed_by = v_actor
  where id = v_document_id;

  insert into public.inventory_document_events (
    document_id,
    event_type,
    from_status,
    to_status,
    event_data,
    created_by
  )
  values (
    v_document_id,
    'completed',
    'submitted',
    'completed',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key) || '-complete',
      'warehouse_id', p_warehouse_id,
      'direction', 'in',
      'movement_count', v_movement_count,
      'opening_balance', true
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', v_document_id,
    'status', 'completed',
    'warehouse_id', p_warehouse_id,
    'direction', 'in',
    'movement_count', v_movement_count,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id,
    operation,
    idempotency_key,
    result,
    created_by
  )
  values (
    v_document_id,
    'complete',
    btrim(p_idempotency_key) || '-complete',
    v_result,
    v_actor
  );

  return v_result || jsonb_build_object(
    'document_id', v_document_id,
    'document_no', v_document_no,
    'warehouse_id', p_warehouse_id,
    'total_amount', coalesce(v_total_amount, 0)
  );
end;
$function$;

comment on function public.inventory_create_opening_balance(uuid, timestamptz, text, jsonb, text) is
  'Tạo và hoàn tất nguyên tử phiếu tồn đầu kỳ; mỗi kho chỉ được ghi nhận một lần trước khi có movement.';

revoke all on function public.inventory_create_opening_balance(uuid, timestamptz, text, jsonb, text) from public;
revoke all on function public.inventory_create_opening_balance(uuid, timestamptz, text, jsonb, text) from anon;
grant execute on function public.inventory_create_opening_balance(uuid, timestamptz, text, jsonb, text) to authenticated;
grant execute on function public.inventory_create_opening_balance(uuid, timestamptz, text, jsonb, text) to service_role;

notify pgrst, 'reload schema';
