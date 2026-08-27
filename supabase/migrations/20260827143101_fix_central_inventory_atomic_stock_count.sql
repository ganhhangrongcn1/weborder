-- Tài khoản Tổng kho hiện tại có toàn quyền trong phân hệ Kho. Một access role
-- admin bổ sung giữ tương thích với các RPC Kho cũ đang kiểm tra owner/admin trực tiếp.
insert into public.inventory_user_access (
  auth_user_id,
  warehouse_id,
  role,
  is_active,
  created_by,
  updated_at
)
select
  access.auth_user_id,
  access.warehouse_id,
  'admin',
  true,
  access.created_by,
  now()
from public.inventory_user_access access
where access.role = 'central_manager'
  and access.is_active
  and access.auth_user_id = 'a8862cb4-0f1f-47e4-83af-dfd4020fbc60'::uuid
on conflict (auth_user_id, warehouse_id, role) do update
set is_active = true,
    updated_at = excluded.updated_at;

create or replace function public.inventory_create_and_start_stock_count(
  p_document_no text,
  p_idempotency_key text,
  p_warehouse_id uuid,
  p_occurred_at timestamptz,
  p_notes text,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_document_id uuid;
  v_input_count integer;
  v_inserted_count integer;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để tạo đợt kiểm kê.';
  end if;

  if p_warehouse_id is null then
    raise exception 'Vui lòng chọn kho kiểm kê.';
  end if;

  if nullif(btrim(coalesce(p_document_no, '')), '') is null
     or nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'Thiếu mã phiếu hoặc khóa chống trùng kiểm kê.';
  end if;

  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then
    raise exception 'Danh sách nguyên vật liệu kiểm kê không hợp lệ.';
  end if;

  v_input_count := jsonb_array_length(coalesce(p_lines, '[]'::jsonb));
  if v_input_count = 0 then
    raise exception 'Kho chưa có nguyên vật liệu để kiểm kê.';
  end if;

  insert into public.inventory_documents (
    document_no,
    idempotency_key,
    document_type,
    status,
    source_warehouse_id,
    occurred_at,
    notes,
    metadata,
    created_by
  ) values (
    btrim(p_document_no),
    btrim(p_idempotency_key),
    'stock_count',
    'draft',
    p_warehouse_id,
    coalesce(p_occurred_at, now()),
    nullif(btrim(coalesce(p_notes, '')), ''),
    jsonb_build_object('count_scope', 'all_active_items'),
    v_actor
  )
  returning id into v_document_id;

  insert into public.inventory_document_lines (
    document_id,
    item_id,
    unit_id,
    conversion_to_base,
    expected_quantity
  )
  select
    v_document_id,
    nullif(line.value ->> 'itemId', '')::uuid,
    nullif(line.value ->> 'unitId', '')::uuid,
    coalesce(nullif(line.value ->> 'conversionToBase', '')::numeric, 0),
    0
  from jsonb_array_elements(p_lines) line
  where nullif(line.value ->> 'itemId', '') is not null
    and nullif(line.value ->> 'unitId', '') is not null
    and coalesce(nullif(line.value ->> 'conversionToBase', '')::numeric, 0) > 0;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_input_count then
    raise exception 'Có nguyên vật liệu hoặc đơn vị tính không hợp lệ trong phiếu kiểm kê.';
  end if;

  perform public.inventory_start_stock_count(
    v_document_id,
    'count-start-' || v_document_id::text
  );

  return v_document_id;
end;
$function$;

revoke all on function public.inventory_create_and_start_stock_count(text,text,uuid,timestamptz,text,jsonb)
from public, anon;

grant execute on function public.inventory_create_and_start_stock_count(text,text,uuid,timestamptz,text,jsonb)
to authenticated, service_role;

comment on function public.inventory_create_and_start_stock_count(text,text,uuid,timestamptz,text,jsonb) is
  'Tạo đầu phiếu, dòng kiểm kê và bắt đầu kiểm trong một giao dịch; lỗi ở bất kỳ bước nào sẽ hoàn tác toàn bộ.';

notify pgrst, 'reload schema';
