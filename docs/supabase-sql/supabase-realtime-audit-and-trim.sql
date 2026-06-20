-- Audit and trim Supabase Realtime publication.
-- Goal:
-- 1. See which tables are currently enabled for Supabase Realtime.
-- 2. Keep only order workflow tables needed by the kitchen board.
-- 3. Reduce realtime traffic without deleting data or changing table rows.
--
-- Safe note:
-- - This only changes the `supabase_realtime` publication.
-- - It does not delete, update, or truncate any app data.
-- - If catalog/menu tables are removed from realtime, admin/menu changes still load by normal reads/refresh,
--   but they will not live-update instantly across open tabs.

-- 1) Current realtime tables.
select
  p.pubname as publication_name,
  n.nspname as schema_name,
  c.relname as table_name
from pg_publication p
join pg_publication_rel pr on pr.prpubid = p.oid
join pg_class c on c.oid = pr.prrelid
join pg_namespace n on n.oid = c.relnamespace
where p.pubname = 'supabase_realtime'
order by n.nspname, c.relname;

-- 2) Recommended kitchen realtime tables.
-- Keep these enabled:
-- - public.orders
-- - public.order_items
-- - public.partner_orders
-- - public.partner_order_items

-- 3) Generate SQL commands to remove extra realtime tables.
-- Run this SELECT first, review the generated commands, then copy/run only the DROP TABLE lines you agree with.
select
  format('alter publication supabase_realtime drop table %I.%I;', n.nspname, c.relname) as sql_to_remove_extra_realtime_table
from pg_publication p
join pg_publication_rel pr on pr.prpubid = p.oid
join pg_class c on c.oid = pr.prrelid
join pg_namespace n on n.oid = c.relnamespace
where p.pubname = 'supabase_realtime'
  and n.nspname = 'public'
  and c.relname not in (
    'orders',
    'order_items',
    'partner_orders',
    'partner_order_items'
  )
order by c.relname;

-- 4) Add required tables if any are missing.
do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'orders',
    'order_items',
    'partner_orders',
    'partner_order_items'
  ]
  loop
    if not exists (
      select 1
      from pg_publication p
      join pg_publication_rel pr on pr.prpubid = p.oid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = required_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', required_table);
    end if;
  end loop;
end $$;

-- 5) Verify again after trimming.
select
  p.pubname as publication_name,
  n.nspname as schema_name,
  c.relname as table_name
from pg_publication p
join pg_publication_rel pr on pr.prpubid = p.oid
join pg_class c on c.oid = pr.prrelid
join pg_namespace n on n.oid = c.relnamespace
where p.pubname = 'supabase_realtime'
order by n.nspname, c.relname;
