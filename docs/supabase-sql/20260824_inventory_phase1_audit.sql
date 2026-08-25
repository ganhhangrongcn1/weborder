-- Ganh Hang Rong Inventory Phase 1 - read-only audit
-- Created: 2026-08-24
-- This file must not create, alter, update, insert, delete or drop anything.

-- 1. Inventory tables and RLS state.
select
  table_schema,
  table_name,
  c.relrowsecurity as row_security_enabled,
  c.relforcerowsecurity as row_security_forced
from information_schema.tables t
join pg_namespace n
  on n.nspname = t.table_schema
join pg_class c
  on c.relnamespace = n.oid
 and c.relname = t.table_name
where t.table_schema = 'public'
  and t.table_name like 'inventory\_%' escape '\'
order by t.table_name;

-- 2. Real columns and defaults.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name like 'inventory\_%' escape '\'
order by table_name, ordinal_position;

-- 3. Constraints.
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  pg_get_constraintdef(pc.oid) as definition
from information_schema.table_constraints tc
join pg_namespace pn
  on pn.nspname = tc.constraint_schema
join pg_constraint pc
  on pc.connamespace = pn.oid
 and pc.conname = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name like 'inventory\_%' escape '\'
order by tc.table_name, tc.constraint_name;

-- 4. Indexes.
select
  tablename as table_name,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename like 'inventory\_%' escape '\'
order by tablename, indexname;

-- 5. RLS policies.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename like 'inventory\_%' escape '\'
order by tablename, policyname;

-- 6. Inventory functions in public/private schemas.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proacl as execute_acl,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.proname like 'inventory\_%' escape '\'
order by n.nspname, p.proname, arguments;

-- 7. Triggers.
select
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table like 'inventory\_%' escape '\'
order by event_object_table, trigger_name, event_manipulation;

-- 8. Table privileges exposed to API roles.
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'inventory\_%' escape '\'
  and grantee in ('anon', 'authenticated', 'service_role')
group by table_name, grantee
order by table_name, grantee;

-- 9. Approximate row counts without scanning full tables.
select
  c.relname as table_name,
  c.reltuples::bigint as estimated_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'inventory\_%' escape '\'
order by c.relname;
