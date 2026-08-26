-- Cho phép người dùng Kho thử xử lý lại sự kiện bán hàng đang treo mà không
-- mở quyền UPDATE trực tiếp trên bảng hàng chờ.

create or replace function private.inventory_retry_sales_order_event(
  p_event_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.inventory_sales_order_events%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Bạn cần đăng nhập để thử xử lý lại.';
  end if;

  select *
  into v_event
  from public.inventory_sales_order_events
  where id = p_event_id
  for update;

  if not found
    or not (select private.inventory_can_view_sales_branch(v_event.branch_uuid)) then
    raise exception 'Không tìm thấy sự kiện hoặc tài khoản không có quyền.';
  end if;

  if v_event.processing_status not in ('blocked', 'ignored') then
    raise exception 'Chỉ sự kiện đang treo mới được thử lại.';
  end if;

  update public.inventory_sales_order_events
  set
    processing_status = 'pending',
    issue_code = null,
    issue_message = null,
    available_at = now(),
    processed_at = null,
    updated_at = now()
  where id = p_event_id;

  return p_event_id;
end;
$$;

revoke all on function private.inventory_retry_sales_order_event(uuid) from public;
revoke all on function private.inventory_retry_sales_order_event(uuid) from anon;
grant execute on function private.inventory_retry_sales_order_event(uuid) to authenticated;

-- Giữ RPC public là SECURITY INVOKER. Hàm này chỉ chuyển tiếp sang cổng riêng
-- đã tự kiểm tra đăng nhập, phạm vi chi nhánh và trạng thái sự kiện.
create or replace function public.inventory_retry_sales_order_event(
  p_event_id uuid
)
returns uuid
language sql
set search_path = ''
as $$
  select private.inventory_retry_sales_order_event(p_event_id);
$$;

revoke all on function public.inventory_retry_sales_order_event(uuid) from public;
revoke all on function public.inventory_retry_sales_order_event(uuid) from anon;
grant execute on function public.inventory_retry_sales_order_event(uuid) to authenticated;

comment on function private.inventory_retry_sales_order_event(uuid) is
  'Đưa sự kiện trừ kho đang treo về pending sau khi kiểm tra quyền theo chi nhánh.';

comment on function public.inventory_retry_sales_order_event(uuid) is
  'RPC cho người dùng Kho thử xử lý lại sự kiện bán hàng đang treo.';

notify pgrst, 'reload schema';
