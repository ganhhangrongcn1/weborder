-- Hoàn thành phiếu nhập mua và cập nhật tồn kho trong cùng một giao dịch.
-- An toàn khi chạy lại nhiều lần.

create or replace function public.create_inventory_purchase_receipt(
  p_destination_warehouse_id uuid,
  p_supplier_id uuid default null,
  p_reference_no text default null,
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_document_id uuid := gen_random_uuid();
  new_document_no text := 'NK-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  line_data jsonb;
  new_line_id uuid;
  line_item_id uuid;
  line_unit_id uuid;
  line_quantity numeric(18,6);
  line_unit_price numeric(18,2);
  document_total numeric(18,2) := 0;
begin
  if current_user_id is null then
    raise exception 'Bạn cần đăng nhập để tạo phiếu nhập.';
  end if;
  if not (select private.inventory_can_manage_purchasing()) then
    raise exception 'Bạn không có quyền tạo phiếu nhập.';
  end if;
  if not (select private.inventory_can_access_warehouse(p_destination_warehouse_id)) then
    raise exception 'Bạn không có quyền nhập hàng vào kho này.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Phiếu nhập cần ít nhất một dòng hàng hóa.';
  end if;

  for line_data in select value from jsonb_array_elements(p_lines)
  loop
    line_item_id := (line_data->>'item_id')::uuid;
    line_unit_id := (line_data->>'unit_id')::uuid;
    line_quantity := (line_data->>'quantity')::numeric;
    line_unit_price := coalesce((line_data->>'unit_price')::numeric, 0);
    if line_quantity <= 0 or line_unit_price < 0 then
      raise exception 'Số lượng phải lớn hơn 0 và đơn giá không được âm.';
    end if;
    if not exists (
      select 1 from public.inventory_items item
      where item.id = line_item_id
        and item.base_unit_id = line_unit_id
        and item.is_active
        and item.tracks_inventory
    ) then
      raise exception 'Hàng hóa hoặc đơn vị tính không hợp lệ.';
    end if;
    document_total := document_total + line_quantity * line_unit_price;
  end loop;

  insert into public.inventory_documents (
    id, document_no, document_type, status, destination_warehouse_id,
    supplier_id, reference_no, notes, total_amount, created_by,
    submitted_at, submitted_by, completed_at, completed_by
  ) values (
    new_document_id, new_document_no, 'purchase_receipt', 'completed', p_destination_warehouse_id,
    p_supplier_id, nullif(trim(p_reference_no), ''), nullif(trim(p_notes), ''), document_total, current_user_id,
    now(), current_user_id, now(), current_user_id
  );

  for line_data in select value from jsonb_array_elements(p_lines)
  loop
    line_item_id := (line_data->>'item_id')::uuid;
    line_unit_id := (line_data->>'unit_id')::uuid;
    line_quantity := (line_data->>'quantity')::numeric;
    line_unit_price := coalesce((line_data->>'unit_price')::numeric, 0);
    insert into public.inventory_document_lines (
      document_id, item_id, unit_id, expected_quantity, actual_quantity,
      base_quantity, unit_price
    ) values (
      new_document_id, line_item_id, line_unit_id, line_quantity, line_quantity,
      line_quantity, line_unit_price
    ) returning id into new_line_id;

    insert into public.inventory_stock_movements (
      warehouse_id, item_id, document_id, document_line_id, direction,
      quantity, unit_cost, occurred_at, created_by
    ) values (
      p_destination_warehouse_id, line_item_id, new_document_id, new_line_id, 'in',
      line_quantity, line_unit_price, now(), current_user_id
    );

    insert into public.inventory_stock_balances as balance (
      warehouse_id, item_id, quantity, average_cost, updated_at
    ) values (
      p_destination_warehouse_id, line_item_id, line_quantity, line_unit_price, now()
    )
    on conflict (warehouse_id, item_id) do update
    set average_cost = case
          when balance.quantity + excluded.quantity > 0
          then ((balance.quantity * balance.average_cost) + (excluded.quantity * excluded.average_cost))
            / (balance.quantity + excluded.quantity)
          else 0
        end,
        quantity = balance.quantity + excluded.quantity,
        updated_at = now();
  end loop;

  return jsonb_build_object('id', new_document_id, 'document_no', new_document_no, 'status', 'completed');
end;
$$;

revoke all on function public.create_inventory_purchase_receipt(uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_inventory_purchase_receipt(uuid, uuid, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
