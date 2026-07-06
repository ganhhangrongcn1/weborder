-- Source-of-truth SQL:
-- 1. supabase/migrations/20260706060204_harden_customer_profile_access.sql
-- 2. supabase/migrations/20260706061433_harden_customer_profile_rls.sql
--
-- Mục tiêu:
-- 1. Chặn anon đọc/ghi trực tiếp toàn bộ public.profiles.
-- 2. Customer đã đăng nhập chỉ đọc profile gắn với auth.uid().
-- 3. Admin/staff/kitchen/CRM hợp lệ vẫn đọc được danh sách customer.
-- 4. Loại password_demo khỏi quyền SELECT frontend.
-- 5. Giữ đăng nhập bằng số điện thoại qua RPC tối thiểu.
-- 6. Customer stub được tạo sau khi order được ghi, không mở quyền profiles cho anon.
--
-- Thứ tự rollout an toàn:
-- 1. Áp dụng migration 20260706060204 để tạo RPC/trigger nhưng chưa thu hồi quyền cũ.
-- 2. Deploy frontend dùng truy vấn theo số điện thoại và RPC mới.
-- 3. Áp dụng migration 20260706061433 để thu hồi quyền rộng và bật RLS mới.
--
-- Áp dụng migration bằng Supabase CLI/deployment tooling. Không chạy riêng file
-- tài liệu này để tránh lệch migration history.

select
  'migration_source_rpc' as check_name,
  'supabase/migrations/20260706060204_harden_customer_profile_access.sql' as value;

select
  'migration_source_rls' as check_name,
  'supabase/migrations/20260706061433_harden_customer_profile_rls.sql' as value;

select
  'anon_profiles_table_access' as check_name,
  has_table_privilege('anon', 'public.profiles', 'SELECT')
    or has_table_privilege('anon', 'public.profiles', 'INSERT')
    or has_table_privilege('anon', 'public.profiles', 'UPDATE')
    or has_table_privilege('anon', 'public.profiles', 'DELETE') as should_be_false;

select
  'authenticated_password_demo_select' as check_name,
  has_column_privilege(
    'authenticated',
    'public.profiles',
    'password_demo',
    'SELECT'
  ) as should_be_false;

select
  'customer_profile_login_hint_rpc' as check_name,
  to_regprocedure('public.get_customer_profile_login_hint(text)') is not null as should_be_true;

select
  'customer_profile_owner_sync_rpc' as check_name,
  to_regprocedure('public.sync_own_customer_profile(text,text,text)') is not null as should_be_true;

select
  'web_order_customer_stub_trigger' as check_name,
  exists (
    select 1
    from pg_trigger
    where tgname = 'trg_sync_web_order_customer_stub'
      and tgrelid = 'public.orders'::regclass
      and not tgisinternal
  ) as should_be_true;
