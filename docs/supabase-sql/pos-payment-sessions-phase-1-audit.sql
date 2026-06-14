-- POS payment sessions - Phase 1 audit
-- Chạy file này sau migration để kiểm tra cấu trúc, RLS và index.
-- File này chỉ đọc dữ liệu, không thay đổi database.

select
  n.nspname as table_schema,
  c.relname as table_name,
  c.relrowsecurity as row_security_enabled,
  c.relforcerowsecurity as row_security_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'pos_payment_sessions'
  and c.relkind = 'r';

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'pos_payment_sessions'
order by ordinal_position;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'pos_payment_sessions'
order by indexname;

select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'pos_payment_sessions'
order by policyname;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sepay_webhook_logs'
  and column_name = 'matched_payment_session_id';

select
  status,
  count(*) as total
from public.pos_payment_sessions
group by status
order by status;

select
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'pos_payment_sessions';
