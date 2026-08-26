-- Phase 6B: ghi lô và hạn sử dụng cho bán thành phẩm đầu ra trong cùng
-- transaction hoàn thành lệnh sản xuất/sơ chế.

alter table public.inventory_production_orders
  add column if not exists output_lot_number text,
  add column if not exists output_manufactured_on date,
  add column if not exists output_expires_on date;

alter table public.inventory_production_orders
  drop constraint if exists inventory_production_orders_output_expiry_dates_check;

alter table public.inventory_production_orders
  add constraint inventory_production_orders_output_expiry_dates_check check (
    output_manufactured_on is null
    or output_expires_on is null
    or output_expires_on >= output_manufactured_on
  );

create or replace function private.inventory_apply_production_output_lot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.inventory_documents%rowtype;
  v_order public.inventory_production_orders%rowtype;
  v_item public.inventory_items%rowtype;
  v_track_expiry boolean;
  v_completed_date date;
begin
  select document.* into v_document
  from public.inventory_documents document
  where document.id = new.document_id;

  if not found or v_document.document_type <> 'production_output' then
    return new;
  end if;

  select production_order.* into v_order
  from public.inventory_production_orders production_order
  where production_order.id::text = v_document.metadata ->> 'production_order_id';

  if not found then
    raise exception 'Không tìm thấy lệnh sản xuất của chứng từ đầu ra.';
  end if;

  select item.* into v_item
  from public.inventory_items item
  where item.id = new.item_id;

  if not found then
    raise exception 'Không tìm thấy bán thành phẩm đầu ra.';
  end if;

  v_track_expiry := coalesce(v_item.metadata ->> 'track_expiry', 'false') = 'true';
  if not v_track_expiry then
    return new;
  end if;

  v_completed_date := (v_document.occurred_at at time zone 'Asia/Bangkok')::date;
  new.lot_number := coalesce(
    nullif(btrim(v_order.output_lot_number), ''),
    'SX-' || v_order.order_no
  );
  new.manufactured_on := coalesce(v_order.output_manufactured_on, v_completed_date);
  new.expires_on := v_order.output_expires_on;

  if new.expires_on is null then
    raise exception 'Bán thành phẩm % đang theo dõi hạn sử dụng nên phải nhập ngày hết hạn.', v_item.name;
  end if;
  if new.manufactured_on > v_completed_date then
    raise exception 'Ngày sản xuất đầu ra không được sau ngày hoàn thành lệnh.';
  end if;
  if new.expires_on < v_completed_date then
    raise exception 'Không thể nhập bán thành phẩm đã hết hạn.';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_apply_production_output_lot_before_line
  on public.inventory_document_lines;

create trigger inventory_apply_production_output_lot_before_line
before insert on public.inventory_document_lines
for each row
execute function private.inventory_apply_production_output_lot();

create or replace function private.inventory_record_purchase_lot_from_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.inventory_documents%rowtype;
  v_line public.inventory_document_lines%rowtype;
  v_item public.inventory_items%rowtype;
  v_track_expiry boolean;
  v_received_date date;
begin
  if new.direction <> 'in' or new.movement_stage <> 'completion' then
    return new;
  end if;

  select document.* into v_document
  from public.inventory_documents document
  where document.id = new.document_id;

  if not found or v_document.document_type not in ('purchase_receipt', 'production_output') then
    return new;
  end if;

  select line.* into v_line
  from public.inventory_document_lines line
  where line.id = new.document_line_id
    and line.document_id = new.document_id;

  if not found then
    raise exception 'Không tìm thấy dòng chứng từ để ghi nhận lô hàng.';
  end if;

  select item.* into v_item
  from public.inventory_items item
  where item.id = new.item_id;

  if not found then
    raise exception 'Không tìm thấy nguyên vật liệu của lô hàng.';
  end if;

  v_track_expiry := coalesce(v_item.metadata ->> 'track_expiry', 'false') = 'true';
  if v_document.document_type = 'production_output' and not v_track_expiry then
    return new;
  end if;

  v_received_date := (v_document.occurred_at at time zone 'Asia/Bangkok')::date;

  if nullif(btrim(v_line.lot_number), '') is null then
    raise exception 'Chứng từ nhập kho phải có mã lô cho từng nguyên vật liệu.';
  end if;
  if v_track_expiry and v_line.expires_on is null then
    raise exception 'Nguyên vật liệu % đang theo dõi hạn sử dụng nên phải nhập ngày hết hạn.', v_item.name;
  end if;
  if v_line.manufactured_on is not null and v_line.manufactured_on > v_received_date then
    raise exception 'Ngày sản xuất của % không được sau ngày nhập kho.', v_item.name;
  end if;
  if v_line.expires_on is not null and v_line.expires_on < v_received_date then
    raise exception 'Không thể nhập % vì lô hàng đã hết hạn.', v_item.name;
  end if;

  insert into public.inventory_stock_lots (
    warehouse_id, item_id, source_document_id, source_document_line_id,
    lot_number, manufactured_on, expires_on, received_quantity,
    remaining_quantity, unit_cost, metadata, created_by
  ) values (
    new.warehouse_id, new.item_id, new.document_id, new.document_line_id,
    btrim(v_line.lot_number), v_line.manufactured_on, v_line.expires_on,
    new.quantity, new.quantity, new.unit_cost,
    jsonb_build_object(
      'source_type', v_document.document_type,
      'supplier_id', v_document.supplier_id,
      'document_no', v_document.document_no,
      'production_order_id', v_document.metadata ->> 'production_order_id',
      'received_at', v_document.occurred_at
    ),
    new.created_by
  )
  on conflict (source_document_line_id) do nothing;

  return new;
end;
$$;

create or replace function private.inventory_complete_production_order_with_lot(
  p_order_id uuid,
  p_actual_output_quantity numeric,
  p_actual_inputs jsonb,
  p_output_expires_on date,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.inventory_production_orders%rowtype;
  v_item public.inventory_items%rowtype;
  v_track_expiry boolean;
begin
  if exists (
    select 1
    from public.inventory_production_order_operations operation
    where operation.production_order_id = p_order_id
      and operation.operation = 'complete'
  ) then
    return private.inventory_complete_production_order(
      p_order_id, p_actual_output_quantity, p_actual_inputs, p_idempotency_key
    );
  end if;

  select production_order.* into v_order
  from public.inventory_production_orders production_order
  where production_order.id = p_order_id
  for update;

  if not found then
    raise exception 'Không tìm thấy lệnh sản xuất.';
  end if;

  select item.* into v_item
  from public.inventory_items item
  where item.id = v_order.output_item_id;

  if not found then
    raise exception 'Không tìm thấy bán thành phẩm đầu ra.';
  end if;

  v_track_expiry := coalesce(v_item.metadata ->> 'track_expiry', 'false') = 'true';
  if v_track_expiry and p_output_expires_on is null then
    raise exception 'Vui lòng nhập hạn sử dụng của bán thành phẩm đầu ra.';
  end if;
  if v_track_expiry and p_output_expires_on < current_date then
    raise exception 'Hạn sử dụng đầu ra không được trước ngày hoàn thành.';
  end if;

  update public.inventory_production_orders
  set output_lot_number = case when v_track_expiry then 'SX-' || v_order.order_no else null end,
      output_manufactured_on = case when v_track_expiry then current_date else null end,
      output_expires_on = case when v_track_expiry then p_output_expires_on else null end,
      updated_at = now(),
      updated_by = (select auth.uid())
  where id = p_order_id;

  return private.inventory_complete_production_order(
    p_order_id, p_actual_output_quantity, p_actual_inputs, p_idempotency_key
  );
end;
$$;

create or replace function public.inventory_complete_production_order_with_lot(
  p_order_id uuid,
  p_actual_output_quantity numeric,
  p_actual_inputs jsonb,
  p_output_expires_on date,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_complete_production_order_with_lot(
    p_order_id,
    p_actual_output_quantity,
    p_actual_inputs,
    p_output_expires_on,
    p_idempotency_key
  );
$$;

revoke all on function private.inventory_apply_production_output_lot() from public, anon, authenticated;
revoke all on function private.inventory_record_purchase_lot_from_movement() from public, anon, authenticated;
revoke all on function private.inventory_complete_production_order_with_lot(uuid, numeric, jsonb, date, text) from public, anon;
revoke all on function public.inventory_complete_production_order_with_lot(uuid, numeric, jsonb, date, text) from public, anon;

grant execute on function private.inventory_complete_production_order_with_lot(uuid, numeric, jsonb, date, text)
  to authenticated, service_role;
grant execute on function public.inventory_complete_production_order_with_lot(uuid, numeric, jsonb, date, text)
  to authenticated, service_role;

comment on column public.inventory_production_orders.output_lot_number is
  'Mã lô đầu ra tự sinh theo mã lệnh khi bán thành phẩm theo dõi hạn sử dụng.';
comment on column public.inventory_production_orders.output_expires_on is
  'Hạn sử dụng thực tế của bán thành phẩm đầu ra, ghi cùng transaction hoàn thành lệnh.';
comment on function public.inventory_complete_production_order_with_lot(uuid, numeric, jsonb, date, text) is
  'Hoàn thành lệnh nguyên tử và ghi lô/HSD đầu ra khi mã bán thành phẩm có theo dõi hạn sử dụng.';

notify pgrst, 'reload schema';
