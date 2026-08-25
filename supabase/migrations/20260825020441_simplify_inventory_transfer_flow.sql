-- Rút gọn luồng cấp hàng nội bộ:
-- 1) Duyệt yêu cầu -> tự tạo và gửi phiếu chuyển.
-- 2) Nhận đủ hàng -> tự hoàn tất phiếu chuyển và khép yêu cầu liên kết.
-- Các phiếu nhận lệch vẫn dừng lại để owner/admin đối chiếu thủ công.

create or replace function private.inventory_complete_transfer_impl(
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
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_variance_count integer;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để khóa phiếu chuyển kho.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác khóa phiếu chuyển.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found then
    raise exception 'Không tìm thấy phiếu chuyển kho.';
  end if;

  if v_document.document_type <> 'transfer' then
    raise exception 'Phiếu % không phải phiếu chuyển kho.', v_document.document_no;
  end if;

  if not (
    (select private.inventory_is_admin())
    or (
      v_document.destination_warehouse_id is not null
      and (select private.inventory_can_access_warehouse(v_document.destination_warehouse_id))
    )
  ) then
    raise exception 'Bạn không có quyền khóa phiếu của kho đích.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'complete_transfer';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Phiếu đã được khóa bằng một idempotency key khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
      and (operation.document_id <> p_document_id or operation.operation <> 'complete_transfer')
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status not in ('received', 'received_with_variance') then
    raise exception 'Phiếu phải được kho đích xác nhận nhận trước khi khóa. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_document.destination_warehouse_id
          and access.role in ('central_manager', 'branch_manager', 'staff')
        )
      )
  ) then
    raise exception 'Tài khoản không được khóa phiếu tại kho đích.';
  end if;

  select count(*)
  into v_variance_count
  from public.inventory_document_lines line
  where line.document_id = p_document_id
    and line.received_quantity <> line.shipped_quantity;

  if exists (
    select 1
    from public.inventory_document_lines line
    where line.document_id = p_document_id
      and (
        line.shipped_quantity is null
        or line.received_quantity is null
        or (
          line.received_quantity <> line.shipped_quantity
          and nullif(btrim(line.variance_reason), '') is null
        )
        or (
          line.received_quantity > 0
          and not exists (
            select 1
            from public.inventory_stock_movements movement
            where movement.document_line_id = line.id
              and movement.warehouse_id = v_document.destination_warehouse_id
              and movement.direction = 'in'
              and movement.movement_stage = 'receipt'
          )
        )
      )
  ) then
    raise exception 'Phiếu còn dòng chưa nhận đủ dữ liệu hoặc thiếu movement nhận kho.';
  end if;

  if v_variance_count > 0 and not (select private.inventory_is_admin()) then
    raise exception 'Phiếu nhận lệch chỉ owner hoặc admin được khóa sau khi đối chiếu.';
  end if;

  update public.inventory_documents
  set status = 'completed',
      completed_at = now(),
      completed_by = v_actor
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id, event_type, from_status, to_status, event_data, created_by
  )
  values (
    p_document_id,
    'completed',
    v_document.status,
    'completed',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'variance_count', v_variance_count
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'completed',
    'variance_count', v_variance_count,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id, operation, idempotency_key, result, created_by
  )
  values (
    p_document_id,
    'complete_transfer',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_approve_requisition_and_prepare_transfer_impl(
  p_document_id uuid,
  p_idempotency_key text,
  p_source_warehouse_id uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := btrim(p_idempotency_key);
  v_approval jsonb;
  v_transfer jsonb;
  v_submission jsonb;
  v_transfer_id uuid;
begin
  if nullif(v_key, '') is null then
    raise exception 'Thiếu idempotency key cho thao tác duyệt và chuẩn bị giao hàng.';
  end if;

  v_approval := private.inventory_approve_requisition_impl(
    p_document_id,
    v_key || ':approve',
    p_source_warehouse_id,
    p_lines
  );

  v_transfer := private.inventory_create_requisition_transfer_impl(
    p_document_id,
    v_key || ':create-transfer'
  );
  v_transfer_id := (v_transfer ->> 'transfer_document_id')::uuid;

  v_submission := private.inventory_submit_document_impl(
    v_transfer_id,
    v_key || ':submit-transfer'
  );

  return jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', v_approval ->> 'status',
    'transfer_document_id', v_transfer_id,
    'transfer_status', v_submission ->> 'status',
    'idempotent_replay',
      coalesce((v_approval ->> 'idempotent_replay')::boolean, false)
      and coalesce((v_transfer ->> 'idempotent_replay')::boolean, false)
      and coalesce((v_submission ->> 'idempotent_replay')::boolean, false)
  );
end;
$$;

create or replace function private.inventory_receive_and_finalize_transfer_impl(
  p_document_id uuid,
  p_idempotency_key text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := btrim(p_idempotency_key);
  v_receipt jsonb;
  v_completion jsonb;
  v_fulfillment jsonb;
  v_requisition_id uuid;
begin
  if nullif(v_key, '') is null then
    raise exception 'Thiếu idempotency key cho thao tác nhận và hoàn tất chuyển kho.';
  end if;

  v_receipt := private.inventory_receive_transfer_impl(
    p_document_id,
    v_key || ':receive',
    p_lines
  );

  if v_receipt ->> 'status' = 'received_with_variance' then
    return v_receipt || jsonb_build_object(
      'requires_review', true,
      'transfer_status', 'received_with_variance',
      'requisition_status', null
    );
  end if;

  v_completion := private.inventory_complete_transfer_impl(
    p_document_id,
    v_key || ':complete'
  );

  select document.source_document_id
  into v_requisition_id
  from public.inventory_documents document
  where document.id = p_document_id;

  if v_requisition_id is not null then
    v_fulfillment := private.inventory_fulfill_requisition_impl(
      v_requisition_id,
      v_key || ':fulfill-requisition'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', v_completion ->> 'status',
    'transfer_status', v_completion ->> 'status',
    'requisition_document_id', v_requisition_id,
    'requisition_status', v_fulfillment ->> 'status',
    'requires_review', false,
    'idempotent_replay',
      coalesce((v_receipt ->> 'idempotent_replay')::boolean, false)
      and coalesce((v_completion ->> 'idempotent_replay')::boolean, false)
      and (
        v_requisition_id is null
        or coalesce((v_fulfillment ->> 'idempotent_replay')::boolean, false)
      )
  );
end;
$$;

create or replace function public.inventory_approve_requisition_and_prepare_transfer(
  p_document_id uuid,
  p_idempotency_key text,
  p_source_warehouse_id uuid,
  p_lines jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_approve_requisition_and_prepare_transfer_impl(
    p_document_id,
    p_idempotency_key,
    p_source_warehouse_id,
    p_lines
  );
$$;

create or replace function public.inventory_receive_and_finalize_transfer(
  p_document_id uuid,
  p_idempotency_key text,
  p_lines jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_receive_and_finalize_transfer_impl(
    p_document_id,
    p_idempotency_key,
    p_lines
  );
$$;

revoke all on function private.inventory_approve_requisition_and_prepare_transfer_impl(uuid, text, uuid, jsonb) from public, anon;
revoke all on function private.inventory_receive_and_finalize_transfer_impl(uuid, text, jsonb) from public, anon;
revoke all on function public.inventory_approve_requisition_and_prepare_transfer(uuid, text, uuid, jsonb) from public, anon;
revoke all on function public.inventory_receive_and_finalize_transfer(uuid, text, jsonb) from public, anon;

grant execute on function private.inventory_approve_requisition_and_prepare_transfer_impl(uuid, text, uuid, jsonb) to authenticated;
grant execute on function private.inventory_receive_and_finalize_transfer_impl(uuid, text, jsonb) to authenticated;
grant execute on function public.inventory_approve_requisition_and_prepare_transfer(uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.inventory_receive_and_finalize_transfer(uuid, text, jsonb) to authenticated;

comment on function public.inventory_approve_requisition_and_prepare_transfer(uuid, text, uuid, jsonb)
is 'Duyệt yêu cầu, tạo phiếu chuyển liên kết và gửi phiếu để kho nguồn giao hàng trong một giao dịch.';

comment on function public.inventory_receive_and_finalize_transfer(uuid, text, jsonb)
is 'Nhận hàng; nếu đủ thì tự hoàn tất phiếu chuyển và khép yêu cầu liên kết, nếu lệch thì giữ lại để đối chiếu.';

notify pgrst, 'reload schema';
