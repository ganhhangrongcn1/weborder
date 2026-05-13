begin;

-- =========================================================
-- One-time setup for Weborder Supabase runtime
-- Run this script once in Supabase SQL Editor.
-- =========================================================

create extension if not exists pgcrypto;
create extension if not exists unaccent;

-- ---------- Tables ----------
create table if not exists public.app_configs (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  name text not null,
  sort_order int4 not null default 0,
  active bool not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null default '',
  image text not null default '',
  price numeric not null default 0,
  original_price numeric null,
  badge text not null default '',
  category_id text references public.categories(id) on update cascade on delete set null,
  visible bool not null default true,
  active bool not null default true,
  sort_order int4 not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.toppings (
  id text primary key,
  name text not null,
  price numeric not null default 0,
  active bool not null default true,
  sort_order int4 not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_toppings (
  product_id text not null references public.products(id) on delete cascade,
  topping_id text not null references public.toppings(id) on delete cascade,
  is_default bool not null default false,
  extra_price numeric not null default 0,
  sort_order int4 not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, topping_id)
);

create table if not exists public.promotions (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.app_configs enable row level security;
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.toppings enable row level security;
alter table public.product_toppings enable row level security;
alter table public.promotions enable row level security;
alter table public.branches enable row level security;

-- ---------- Policies (idempotent) ----------
drop policy if exists app_configs_select_all on public.app_configs;
drop policy if exists app_configs_insert_all on public.app_configs;
drop policy if exists app_configs_update_all on public.app_configs;
drop policy if exists app_configs_delete_all on public.app_configs;

drop policy if exists products_select_all on public.products;
drop policy if exists products_insert_all on public.products;
drop policy if exists products_update_all on public.products;
drop policy if exists products_delete_all on public.products;

drop policy if exists categories_select_all on public.categories;
drop policy if exists categories_insert_all on public.categories;
drop policy if exists categories_update_all on public.categories;
drop policy if exists categories_delete_all on public.categories;

drop policy if exists toppings_select_all on public.toppings;
drop policy if exists toppings_insert_all on public.toppings;
drop policy if exists toppings_update_all on public.toppings;
drop policy if exists toppings_delete_all on public.toppings;

drop policy if exists product_toppings_select_all on public.product_toppings;
drop policy if exists product_toppings_insert_all on public.product_toppings;
drop policy if exists product_toppings_update_all on public.product_toppings;
drop policy if exists product_toppings_delete_all on public.product_toppings;

drop policy if exists promotions_select_all on public.promotions;
drop policy if exists promotions_insert_all on public.promotions;
drop policy if exists promotions_update_all on public.promotions;
drop policy if exists promotions_delete_all on public.promotions;

drop policy if exists branches_select_all on public.branches;
drop policy if exists branches_insert_all on public.branches;
drop policy if exists branches_update_all on public.branches;
drop policy if exists branches_delete_all on public.branches;

create policy app_configs_select_all on public.app_configs for select to anon using (true);
create policy app_configs_insert_all on public.app_configs for insert to anon with check (true);
create policy app_configs_update_all on public.app_configs for update to anon using (true) with check (true);
create policy app_configs_delete_all on public.app_configs for delete to anon using (true);

create policy products_select_all on public.products for select to anon using (true);
create policy products_insert_all on public.products for insert to anon with check (true);
create policy products_update_all on public.products for update to anon using (true) with check (true);
create policy products_delete_all on public.products for delete to anon using (true);

create policy categories_select_all on public.categories for select to anon using (true);
create policy categories_insert_all on public.categories for insert to anon with check (true);
create policy categories_update_all on public.categories for update to anon using (true) with check (true);
create policy categories_delete_all on public.categories for delete to anon using (true);

create policy toppings_select_all on public.toppings for select to anon using (true);
create policy toppings_insert_all on public.toppings for insert to anon with check (true);
create policy toppings_update_all on public.toppings for update to anon using (true) with check (true);
create policy toppings_delete_all on public.toppings for delete to anon using (true);

create policy product_toppings_select_all on public.product_toppings for select to anon using (true);
create policy product_toppings_insert_all on public.product_toppings for insert to anon with check (true);
create policy product_toppings_update_all on public.product_toppings for update to anon using (true) with check (true);
create policy product_toppings_delete_all on public.product_toppings for delete to anon using (true);

create policy promotions_select_all on public.promotions for select to anon using (true);
create policy promotions_insert_all on public.promotions for insert to anon with check (true);
create policy promotions_update_all on public.promotions for update to anon using (true) with check (true);
create policy promotions_delete_all on public.promotions for delete to anon using (true);

create policy branches_select_all on public.branches for select to anon using (true);
create policy branches_insert_all on public.branches for insert to anon with check (true);
create policy branches_update_all on public.branches for update to anon using (true) with check (true);
create policy branches_delete_all on public.branches for delete to anon using (true);

-- ---------- Seed fallback categories ----------
insert into public.categories (id, name, sort_order, active)
select 'khac', 'Khác', 9999, true
where not exists (select 1 from public.categories where id = 'khac');

-- ---------- Normalize invalid category references ----------
update public.products p
set category_id = c.id
from (
  select id
  from public.categories
  where id <> 'Tất cả'
  order by sort_order asc nulls last, id asc
  limit 1
) c
where p.category_id = 'Tất cả';

-- ---------- Reload PostgREST cache ----------
notify pgrst, 'reload schema';

commit;
