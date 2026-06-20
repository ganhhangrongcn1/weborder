-- POS walk-in orders
-- Mục tiêu:
-- 1. Cho phép đơn POS khách lẻ không cần số điện thoại thật.
-- 2. Giữ nguyên loyalty/CRM cho khách có số điện thoại.
-- 3. Không cần dùng số điện thoại giả như 0900000000 nữa.
--
-- Cách chạy:
-- Supabase Dashboard -> SQL Editor -> paste toàn bộ file này -> Run.

begin;

alter table if exists public.orders
  alter column customer_phone drop not null;

comment on column public.orders.customer_phone is
  'Số điện thoại khách hàng. Có thể null với đơn walk-in/POS khách lẻ.';

commit;

-- Kiểm tra nhanh sau khi chạy migration.
select
  column_name,
  is_nullable,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
  and column_name = 'customer_phone';
