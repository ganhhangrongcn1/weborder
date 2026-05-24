-- Allow partner order codes like GF-406 to repeat on different days.
-- Root cause fixed:
-- - Do not use order_code as the database/upsert identity.
-- - Use the stable NexPOS/platform id instead: partner_source + nexpos_order_id.
-- - Keep order_code only as a display/search code.
--
-- Safe to run multiple times.

create extension if not exists pgcrypto;

alter table public.partner_orders
add column if not exists nexpos_order_id text not null default '';

alter table public.partner_orders
add column if not exists partner_source text not null default 'partner';

-- If older imports left nexpos_order_id empty, copy the raw NexPOS id when available.
update public.partner_orders
set nexpos_order_id = nullif(trim(coalesce(raw_data ->> 'id', '')), '')
where nullif(trim(coalesce(nexpos_order_id, '')), '') is null
  and nullif(trim(coalesce(raw_data ->> 'id', '')), '') is not null;

-- PostgREST/Supabase REST upsert needs a normal unique target.
-- Fill legacy blanks so (partner_source, nexpos_order_id) can be unique for every row.
update public.partner_orders
set nexpos_order_id = 'legacy-' || id::text
where nullif(trim(coalesce(nexpos_order_id, '')), '') is null;

-- Remove old unique constraints that force one row per display order_code.
do $$
declare
  item record;
begin
  for item in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'partner_orders'
      and con.contype = 'u'
      and pg_get_constraintdef(con.oid) like '%(order_code)%'
  loop
    execute format('alter table public.partner_orders drop constraint if exists %I', item.conname);
  end loop;

  for item in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'partner_orders'
      and indexdef ilike 'create unique index%'
      and indexdef like '%(order_code)%'
      and indexdef not like '%nexpos_order_id%'
  loop
    execute format('drop index if exists public.%I', item.indexname);
  end loop;
end $$;

-- One NexPOS/platform order id should update the same row.
-- A repeated display code with another NexPOS id will create a new row.
-- Use a named unique constraint because Supabase REST/PostgREST reads constraints
-- for on_conflict matching.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_orders_source_nexpos_order_id_key'
      and conrelid = 'public.partner_orders'::regclass
  ) then
    alter table public.partner_orders
    add constraint partner_orders_source_nexpos_order_id_key
    unique (partner_source, nexpos_order_id);
  end if;
end $$;

create index if not exists partner_orders_order_code_idx
on public.partner_orders (order_code);

create index if not exists partner_orders_display_order_code_idx
on public.partner_orders (display_order_code);

-- Item rows should be rebuilt or upserted inside each partner_order_id, not by order_code alone.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_order_items_order_item_key_key'
      and conrelid = 'public.partner_order_items'::regclass
  ) then
    alter table public.partner_order_items
    add constraint partner_order_items_order_item_key_key
    unique (partner_order_id, item_key);
  end if;
end $$;

-- Reload Supabase REST schema cache so n8n can use the new on_conflict target immediately.
notify pgrst, 'reload schema';

-- Verification: this should return zero rows before creating the unique index above.
select
  partner_source,
  nexpos_order_id,
  count(*) as total
from public.partner_orders
where nullif(trim(nexpos_order_id), '') is not null
group by partner_source, nexpos_order_id
having count(*) > 1
order by total desc, partner_source, nexpos_order_id;
