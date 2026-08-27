-- Các RPC Kho trong public gọi hàm triển khai/quyền ở schema private.
-- Chỉ mở quyền phân giải schema và gọi đúng các hàm kiểm tra đã được bảo vệ;
-- quyền nghiệp vụ vẫn được xác thực bằng auth.uid(), inventory_user_access và RLS.
grant usage on schema private to authenticated;

grant execute on function private.inventory_is_admin() to authenticated;
grant execute on function private.inventory_can_manage_boms() to authenticated;
grant execute on function private.inventory_can_view_sales_branch(uuid) to authenticated;

notify pgrst, 'reload schema';
