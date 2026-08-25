create or replace function private.inventory_complete_simple_document_authorized(
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
  v_document_type text;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để hoàn tất phiếu kho.';
  end if;

  select document.document_type
  into v_document_type
  from public.inventory_documents document
  where document.id = p_document_id;

  if not found then
    raise exception 'Không tìm thấy phiếu kho hoặc bạn không có quyền truy cập.';
  end if;

  if v_document_type = 'waste' and not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and access.role in ('owner', 'admin', 'central_manager')
  ) then
    raise exception 'Chỉ Admin hoặc Quản lý kho được duyệt và hoàn tất phiếu hủy.';
  end if;

  return private.inventory_complete_simple_document_impl(p_document_id, p_idempotency_key);
end;
$$;

revoke all on function private.inventory_complete_simple_document_authorized(uuid, text) from public;
revoke all on function private.inventory_complete_simple_document_authorized(uuid, text) from anon;
grant execute on function private.inventory_complete_simple_document_authorized(uuid, text) to authenticated;

create or replace function public.inventory_complete_simple_document(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_complete_simple_document_authorized(p_document_id, p_idempotency_key);
$$;

revoke all on function public.inventory_complete_simple_document(uuid, text) from public;
revoke all on function public.inventory_complete_simple_document(uuid, text) from anon;
grant execute on function public.inventory_complete_simple_document(uuid, text) to authenticated;

revoke all on function private.inventory_complete_simple_document_impl(uuid, text) from public;
revoke all on function private.inventory_complete_simple_document_impl(uuid, text) from anon;
revoke all on function private.inventory_complete_simple_document_impl(uuid, text) from authenticated;

comment on function public.inventory_complete_simple_document(uuid, text) is
  'Hoàn tất chứng từ kho; phiếu hủy chỉ owner, admin hoặc central_manager được duyệt.';

notify pgrst, 'reload schema';
