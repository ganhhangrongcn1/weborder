-- CRM voucher audience performance
-- Mục tiêu:
-- 1. Chỉ truy vấn hồ sơ khách đã đăng ký khi lập danh sách nhận voucher.
-- 2. Tránh quét toàn bộ profiles khi số khách vãng lai tăng.
-- 3. An toàn để chạy lại nhiều lần.

create index if not exists profiles_registered_customer_phone_idx
on public.profiles (phone)
where registered = true
  and role = 'customer';

analyze public.profiles;

-- Kiểm tra nhanh số hồ sơ có thể nhận voucher.
select count(*) as registered_voucher_customers
from public.profiles
where registered = true
  and role = 'customer'
  and coalesce(status, 'active') = 'active';
