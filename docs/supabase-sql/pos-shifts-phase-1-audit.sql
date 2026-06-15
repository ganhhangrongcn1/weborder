-- POS shifts - Phase 1 audit
-- Chạy sau file pos-shifts-phase-1.sql.
-- File này chỉ đọc, không thay đổi dữ liệu.

select
  n.nspname as table_schema,
  c.relname as table_name,
  c.relrowsecurity as row_security_enabled,
  c.relforcerowsecurity as row_security_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'pos_shifts'
  and c.relkind = 'r';

select
  column_name,
  data_type,
  is_nullable,
  column_default,
  is_generated,
  generation_expression
from information_schema.columns
where table_schema = 'public'
  and table_name = 'pos_shifts'
order by ordinal_position;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and (
    tablename = 'pos_shifts'
    or (
      tablename in ('orders', 'pos_payment_sessions')
      and indexname like '%shift%'
    )
  )
order by tablename, indexname;

select
  conrelid::regclass as table_name,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid in (
  'public.pos_shifts'::regclass,
  'public.orders'::regclass,
  'public.pos_payment_sessions'::regclass
)
  and (
    conrelid = 'public.pos_shifts'::regclass
    or conname like '%pos_shift%'
  )
order by conrelid::regclass::text, constraint_name;

select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'pos_shifts'
order by policyname;

select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('orders', 'pos_payment_sessions')
  and column_name = 'pos_shift_id'
order by table_name;

select
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'pos_shifts';

select
  status,
  count(*) as total
from public.pos_shifts
group by status
order by status;

select
  branch_uuid,
  register_key,
  count(*) as open_shift_count
from public.pos_shifts
where status = 'open'
group by branch_uuid, register_key
having count(*) > 1;
