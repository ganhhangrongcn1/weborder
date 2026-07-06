-- Dọn dữ liệu do các smoke test cũ tạo nhưng anon không có quyền xóa.
-- Chỉ tác động đơn có mã kỹ thuật SMOKE-* và đúng tên thử nghiệm.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local session_replication_role = replica;

delete from public.order_items item
using public.orders smoke_order
where item.order_id = smoke_order.id
  and smoke_order.order_code like 'SMOKE-%'
  and coalesce(smoke_order.customer_name, '') = 'Smoke Test';

delete from public.orders
where order_code like 'SMOKE-%'
  and coalesce(customer_name, '') = 'Smoke Test';

set local session_replication_role = origin;

commit;
