-- Edge Function branch-account-api dùng service_role để tìm kho và cấp quyền kho.
-- Chỉ cấp đúng các quyền mà luồng tạo tài khoản cần dùng.
grant select on table public.inventory_warehouses to service_role;
grant select, insert, update, delete on table public.inventory_user_access to service_role;
