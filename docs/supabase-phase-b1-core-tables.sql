begin;

-- =========================================================
-- Phase B1: Core business tables for Customer/Order/Loyalty
-- Run once in Supabase SQL Editor
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- customers ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null default '',
  email text not null default '',
  avatar_url text not null default '',
  password_demo text not null default '',
  registered bool not null default false,
  total_orders int4 not null default 0,
  total_spent numeric not null default 0,
  member_rank text not null default 'Member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- customer_addresses ----------
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null references public.customers(phone) on update cascade on delete cascade,
  label text not null default '',
  receiver_name text not null default '',
  phone text not null default '',
  address text not null default '',
  lat numeric null,
  lng numeric null,
  distance_km numeric null,
  delivery_fee numeric null,
  is_default bool not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_addresses_customer_phone on public.customer_addresses(customer_phone);

-- ---------- orders ----------
create table if not exists public.orders (
  id text primary key,
  order_code text not null unique,
  customer_phone text not null references public.customers(phone) on update cascade on delete restrict,
  customer_name text not null default '',
  fulfillment_type text not null default 'delivery',
  payment_method text not null default 'cash',
  status text not null default 'pending_zalo',
  subtotal numeric not null default 0,
  shipping_fee numeric not null default 0,
  original_shipping_fee numeric not null default 0,
  shipping_support_discount numeric not null default 0,
  promo_discount numeric not null default 0,
  promo_code text not null default '',
  points_discount numeric not null default 0,
  points_earned int4 not null default 0,
  total_amount numeric not null default 0,
  distance_km numeric null,
  lat numeric null,
  lng numeric null,
  branch_name text not null default '',
  branch_address text not null default '',
  pickup_time_text text not null default '',
  delivery_address text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_customer_phone on public.orders(customer_phone);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

-- ---------- order_items ----------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  product_id text not null default '',
  product_name text not null default '',
  quantity int4 not null default 1,
  unit_price numeric not null default 0,
  line_total numeric not null default 0,
  spice text not null default '',
  note text not null default '',
  toppings jsonb not null default '[]'::jsonb,
  option_groups jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on public.order_items(order_id);

-- ---------- loyalty_accounts ----------
create table if not exists public.loyalty_accounts (
  customer_phone text primary key references public.customers(phone) on update cascade on delete cascade,
  total_points int4 not null default 0,
  checkin_streak int4 not null default 0,
  last_checkin_date text null,
  last_missed_streak int4 not null default 0,
  comeback_used_date text null,
  vouchers jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- loyalty_ledger ----------
create table if not exists public.loyalty_ledger (
  id text primary key,
  customer_phone text not null references public.customers(phone) on update cascade on delete cascade,
  entry_type text not null default 'ORDER_EARN',
  order_id text null references public.orders(id) on update cascade on delete set null,
  points int4 not null default 0,
  amount numeric not null default 0,
  title text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_loyalty_ledger_customer_phone on public.loyalty_ledger(customer_phone);
create index if not exists idx_loyalty_ledger_created_at on public.loyalty_ledger(created_at desc);

-- ---------- RLS ----------
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_ledger enable row level security;

-- ---------- Policies (pilot: anon full access) ----------
drop policy if exists customers_select_all on public.customers;
drop policy if exists customers_insert_all on public.customers;
drop policy if exists customers_update_all on public.customers;
drop policy if exists customers_delete_all on public.customers;

create policy customers_select_all on public.customers for select to anon using (true);
create policy customers_insert_all on public.customers for insert to anon with check (true);
create policy customers_update_all on public.customers for update to anon using (true) with check (true);
create policy customers_delete_all on public.customers for delete to anon using (true);

drop policy if exists customer_addresses_select_all on public.customer_addresses;
drop policy if exists customer_addresses_insert_all on public.customer_addresses;
drop policy if exists customer_addresses_update_all on public.customer_addresses;
drop policy if exists customer_addresses_delete_all on public.customer_addresses;

create policy customer_addresses_select_all on public.customer_addresses for select to anon using (true);
create policy customer_addresses_insert_all on public.customer_addresses for insert to anon with check (true);
create policy customer_addresses_update_all on public.customer_addresses for update to anon using (true) with check (true);
create policy customer_addresses_delete_all on public.customer_addresses for delete to anon using (true);

drop policy if exists orders_select_all on public.orders;
drop policy if exists orders_insert_all on public.orders;
drop policy if exists orders_update_all on public.orders;
drop policy if exists orders_delete_all on public.orders;

create policy orders_select_all on public.orders for select to anon using (true);
create policy orders_insert_all on public.orders for insert to anon with check (true);
create policy orders_update_all on public.orders for update to anon using (true) with check (true);
create policy orders_delete_all on public.orders for delete to anon using (true);

drop policy if exists order_items_select_all on public.order_items;
drop policy if exists order_items_insert_all on public.order_items;
drop policy if exists order_items_update_all on public.order_items;
drop policy if exists order_items_delete_all on public.order_items;

create policy order_items_select_all on public.order_items for select to anon using (true);
create policy order_items_insert_all on public.order_items for insert to anon with check (true);
create policy order_items_update_all on public.order_items for update to anon using (true) with check (true);
create policy order_items_delete_all on public.order_items for delete to anon using (true);

drop policy if exists loyalty_accounts_select_all on public.loyalty_accounts;
drop policy if exists loyalty_accounts_insert_all on public.loyalty_accounts;
drop policy if exists loyalty_accounts_update_all on public.loyalty_accounts;
drop policy if exists loyalty_accounts_delete_all on public.loyalty_accounts;

create policy loyalty_accounts_select_all on public.loyalty_accounts for select to anon using (true);
create policy loyalty_accounts_insert_all on public.loyalty_accounts for insert to anon with check (true);
create policy loyalty_accounts_update_all on public.loyalty_accounts for update to anon using (true) with check (true);
create policy loyalty_accounts_delete_all on public.loyalty_accounts for delete to anon using (true);

drop policy if exists loyalty_ledger_select_all on public.loyalty_ledger;
drop policy if exists loyalty_ledger_insert_all on public.loyalty_ledger;
drop policy if exists loyalty_ledger_update_all on public.loyalty_ledger;
drop policy if exists loyalty_ledger_delete_all on public.loyalty_ledger;

create policy loyalty_ledger_select_all on public.loyalty_ledger for select to anon using (true);
create policy loyalty_ledger_insert_all on public.loyalty_ledger for insert to anon with check (true);
create policy loyalty_ledger_update_all on public.loyalty_ledger for update to anon using (true) with check (true);
create policy loyalty_ledger_delete_all on public.loyalty_ledger for delete to anon using (true);

notify pgrst, 'reload schema';

commit;
