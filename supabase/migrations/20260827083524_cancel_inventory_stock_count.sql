create or replace function private.inventory_cancel_stock_count_impl(
  p_document_id uuid,
  p_idempotency_key text,
  p_cancellation_reason text
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
  v_reason text := nullif(btrim(coalesce(p_cancellation_reason, '')), '');
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để hủy đợt kiểm kê.';
  end if;

  if p_document_id is null or nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'Thiếu phiếu hoặc khóa chống trùng khi hủy kiểm kê.';
  end if;

  if v_reason is null then
    raise exception 'Vui lòng nhập lý do hủy đợt kiểm kê.';
  end if;

  if not (select private.inventory_is_admin()) then
    raise exception 'Chỉ Admin hoặc quản lý Tổng kho được hủy đợt kiểm kê.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found or v_document.document_type <> 'stock_count' then
    raise exception 'Không tìm thấy phiếu kiểm kê hợp lệ.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'cancel_stock_count';

  if found then
    if v_existing_key <> btrim(p_idempotency_key)
       or coalesce(v_existing_result ->> 'cancellation_reason', '') <> v_reason then
      raise exception 'Phiếu đã được hủy bằng khóa hoặc lý do khác.';
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

  if v_document.status <> 'counting' then
    raise exception 'Chỉ phiếu đang kiểm mới được hủy. Trạng thái hiện tại: %.', v_document.status;
  end if;

  update public.inventory_documents
  set status = 'cancelled',
      cancelled_at = clock_timestamp(),
      cancelled_by = v_actor,
      cancellation_reason = v_reason
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id,
    event_type,
    from_status,
    to_status,
    event_data,
    created_by
  ) values (
    p_document_id,
    'stock_count_cancelled',
    'counting',
    'cancelled',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'cancellation_reason', v_reason
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'cancelled',
    'cancellation_reason', v_reason,
    'stock_changed', false,
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
    'cancel_stock_count',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$function$;

create or replace function public.inventory_cancel_stock_count(
  p_document_id uuid,
  p_idempotency_key text,
  p_cancellation_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.inventory_cancel_stock_count_impl(
    p_document_id,
    p_idempotency_key,
    p_cancellation_reason
  );
$function$;

revoke all on function private.inventory_cancel_stock_count_impl(uuid, text, text)
from public, anon;
revoke all on function public.inventory_cancel_stock_count(uuid, text, text)
from public, anon;

grant execute on function private.inventory_cancel_stock_count_impl(uuid, text, text)
to authenticated, service_role;
grant execute on function public.inventory_cancel_stock_count(uuid, text, text)
to authenticated, service_role;

comment on function public.inventory_cancel_stock_count(uuid, text, text) is
  'Hủy phiếu kiểm kê đang ở trạng thái counting, lưu lịch sử và không thay đổi tồn kho.';

notify pgrst, 'reload schema';
