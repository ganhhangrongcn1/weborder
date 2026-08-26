-- Nguồn triển khai: supabase/migrations/20260826082612_inventory_phase7_stock_flow_report.sql
-- Báo cáo Phase 7 tổng hợp ở PostgreSQL, không tải toàn bộ movement về trình duyệt.
-- Trước khi triển khai, kiểm tra migration bằng Supabase local và chạy postcheck đi kèm.

select
  p.proname,
  p.prosecdef as security_definer,
  p.provolatile,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'inventory_get_stock_flow_report';
