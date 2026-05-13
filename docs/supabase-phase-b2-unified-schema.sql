begin;

create extension if not exists pgcrypto;
create extension if not exists unaccent;

-- app config key/value
create table if not exists public.app_configs (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- catalog
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

-- option group tables used by catalog sync
create table if not exists public.option_groups (
  id text primary key,
  name text not null,
  required bool not null default false,
  max_select int4 not null default 1,
  active bool not null default true,
  sort_order int4 not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.option_group_options (
  id text primary key,
  group_id text not null references public.option_groups(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  active bool not null default true,
  sort_order int4 not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  group_id text not null references public.option_groups(id) on delete cascade,
  sort_order int4 not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, group_id)
);

-- marketing and home content
create table if not exists public.promotions (
  id bigserial primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.smart_promotions (
  id bigserial primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id bigserial primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id bigserial primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.home_banners (
  id bigserial primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id bigserial primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_zones (
  id bigserial primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.home_content (
  id int4 primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- core customer/order/loyalty
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

-- indexes
create index if not exists idx_customer_addresses_customer_phone on public.customer_addresses(customer_phone);
create index if not exists idx_orders_customer_phone on public.orders(customer_phone);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_loyalty_ledger_customer_phone on public.loyalty_ledger(customer_phone);
create index if not exists idx_loyalty_ledger_created_at on public.loyalty_ledger(created_at desc);
create index if not exists idx_option_group_options_group_id on public.option_group_options(group_id);
create index if not exists idx_product_option_groups_product_id on public.product_option_groups(product_id);
create index if not exists idx_product_option_groups_group_id on public.product_option_groups(group_id);

-- RLS
alter table public.app_configs enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.toppings enable row level security;
alter table public.product_toppings enable row level security;
alter table public.option_groups enable row level security;
alter table public.option_group_options enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.promotions enable row level security;
alter table public.smart_promotions enable row level security;
alter table public.campaigns enable row level security;
alter table public.coupons enable row level security;
alter table public.home_banners enable row level security;
alter table public.branches enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.home_content enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_ledger enable row level security;

-- Policies (pilot: anon full access)
drop policy if exists app_configs_select_all on public.app_configs;
drop policy if exists app_configs_insert_all on public.app_configs;
drop policy if exists app_configs_update_all on public.app_configs;
drop policy if exists app_configs_delete_all on public.app_configs;
create policy app_configs_select_all on public.app_configs for select to anon using (true);
create policy app_configs_insert_all on public.app_configs for insert to anon with check (true);
create policy app_configs_update_all on public.app_configs for update to anon using (true) with check (true);
create policy app_configs_delete_all on public.app_configs for delete to anon using (true);

drop policy if exists categories_select_all on public.categories;
drop policy if exists categories_insert_all on public.categories;
drop policy if exists categories_update_all on public.categories;
drop policy if exists categories_delete_all on public.categories;
create policy categories_select_all on public.categories for select to anon using (true);
create policy categories_insert_all on public.categories for insert to anon with check (true);
create policy categories_update_all on public.categories for update to anon using (true) with check (true);
create policy categories_delete_all on public.categories for delete to anon using (true);

drop policy if exists products_select_all on public.products;
drop policy if exists products_insert_all on public.products;
drop policy if exists products_update_all on public.products;
drop policy if exists products_delete_all on public.products;
create policy products_select_all on public.products for select to anon using (true);
create policy products_insert_all on public.products for insert to anon with check (true);
create policy products_update_all on public.products for update to anon using (true) with check (true);
create policy products_delete_all on public.products for delete to anon using (true);

drop policy if exists toppings_select_all on public.toppings;
drop policy if exists toppings_insert_all on public.toppings;
drop policy if exists toppings_update_all on public.toppings;
drop policy if exists toppings_delete_all on public.toppings;
create policy toppings_select_all on public.toppings for select to anon using (true);
create policy toppings_insert_all on public.toppings for insert to anon with check (true);
create policy toppings_update_all on public.toppings for update to anon using (true) with check (true);
create policy toppings_delete_all on public.toppings for delete to anon using (true);

drop policy if exists product_toppings_select_all on public.product_toppings;
drop policy if exists product_toppings_insert_all on public.product_toppings;
drop policy if exists product_toppings_update_all on public.product_toppings;
drop policy if exists product_toppings_delete_all on public.product_toppings;
create policy product_toppings_select_all on public.product_toppings for select to anon using (true);
create policy product_toppings_insert_all on public.product_toppings for insert to anon with check (true);
create policy product_toppings_update_all on public.product_toppings for update to anon using (true) with check (true);
create policy product_toppings_delete_all on public.product_toppings for delete to anon using (true);

drop policy if exists option_groups_select_all on public.option_groups;
drop policy if exists option_groups_insert_all on public.option_groups;
drop policy if exists option_groups_update_all on public.option_groups;
drop policy if exists option_groups_delete_all on public.option_groups;
create policy option_groups_select_all on public.option_groups for select to anon using (true);
create policy option_groups_insert_all on public.option_groups for insert to anon with check (true);
create policy option_groups_update_all on public.option_groups for update to anon using (true) with check (true);
create policy option_groups_delete_all on public.option_groups for delete to anon using (true);

drop policy if exists option_group_options_select_all on public.option_group_options;
drop policy if exists option_group_options_insert_all on public.option_group_options;
drop policy if exists option_group_options_update_all on public.option_group_options;
drop policy if exists option_group_options_delete_all on public.option_group_options;
create policy option_group_options_select_all on public.option_group_options for select to anon using (true);
create policy option_group_options_insert_all on public.option_group_options for insert to anon with check (true);
create policy option_group_options_update_all on public.option_group_options for update to anon using (true) with check (true);
create policy option_group_options_delete_all on public.option_group_options for delete to anon using (true);

drop policy if exists product_option_groups_select_all on public.product_option_groups;
drop policy if exists product_option_groups_insert_all on public.product_option_groups;
drop policy if exists product_option_groups_update_all on public.product_option_groups;
drop policy if exists product_option_groups_delete_all on public.product_option_groups;
create policy product_option_groups_select_all on public.product_option_groups for select to anon using (true);
create policy product_option_groups_insert_all on public.product_option_groups for insert to anon with check (true);
create policy product_option_groups_update_all on public.product_option_groups for update to anon using (true) with check (true);
create policy product_option_groups_delete_all on public.product_option_groups for delete to anon using (true);

drop policy if exists promotions_select_all on public.promotions;
drop policy if exists promotions_insert_all on public.promotions;
drop policy if exists promotions_update_all on public.promotions;
drop policy if exists promotions_delete_all on public.promotions;
create policy promotions_select_all on public.promotions for select to anon using (true);
create policy promotions_insert_all on public.promotions for insert to anon with check (true);
create policy promotions_update_all on public.promotions for update to anon using (true) with check (true);
create policy promotions_delete_all on public.promotions for delete to anon using (true);

drop policy if exists smart_promotions_select_all on public.smart_promotions;
drop policy if exists smart_promotions_insert_all on public.smart_promotions;
drop policy if exists smart_promotions_update_all on public.smart_promotions;
drop policy if exists smart_promotions_delete_all on public.smart_promotions;
create policy smart_promotions_select_all on public.smart_promotions for select to anon using (true);
create policy smart_promotions_insert_all on public.smart_promotions for insert to anon with check (true);
create policy smart_promotions_update_all on public.smart_promotions for update to anon using (true) with check (true);
create policy smart_promotions_delete_all on public.smart_promotions for delete to anon using (true);

drop policy if exists campaigns_select_all on public.campaigns;
drop policy if exists campaigns_insert_all on public.campaigns;
drop policy if exists campaigns_update_all on public.campaigns;
drop policy if exists campaigns_delete_all on public.campaigns;
create policy campaigns_select_all on public.campaigns for select to anon using (true);
create policy campaigns_insert_all on public.campaigns for insert to anon with check (true);
create policy campaigns_update_all on public.campaigns for update to anon using (true) with check (true);
create policy campaigns_delete_all on public.campaigns for delete to anon using (true);

drop policy if exists coupons_select_all on public.coupons;
drop policy if exists coupons_insert_all on public.coupons;
drop policy if exists coupons_update_all on public.coupons;
drop policy if exists coupons_delete_all on public.coupons;
create policy coupons_select_all on public.coupons for select to anon using (true);
create policy coupons_insert_all on public.coupons for insert to anon with check (true);
create policy coupons_update_all on public.coupons for update to anon using (true) with check (true);
create policy coupons_delete_all on public.coupons for delete to anon using (true);

drop policy if exists home_banners_select_all on public.home_banners;
drop policy if exists home_banners_insert_all on public.home_banners;
drop policy if exists home_banners_update_all on public.home_banners;
drop policy if exists home_banners_delete_all on public.home_banners;
create policy home_banners_select_all on public.home_banners for select to anon using (true);
create policy home_banners_insert_all on public.home_banners for insert to anon with check (true);
create policy home_banners_update_all on public.home_banners for update to anon using (true) with check (true);
create policy home_banners_delete_all on public.home_banners for delete to anon using (true);

drop policy if exists branches_select_all on public.branches;
drop policy if exists branches_insert_all on public.branches;
drop policy if exists branches_update_all on public.branches;
drop policy if exists branches_delete_all on public.branches;
create policy branches_select_all on public.branches for select to anon using (true);
create policy branches_insert_all on public.branches for insert to anon with check (true);
create policy branches_update_all on public.branches for update to anon using (true) with check (true);
create policy branches_delete_all on public.branches for delete to anon using (true);

drop policy if exists delivery_zones_select_all on public.delivery_zones;
drop policy if exists delivery_zones_insert_all on public.delivery_zones;
drop policy if exists delivery_zones_update_all on public.delivery_zones;
drop policy if exists delivery_zones_delete_all on public.delivery_zones;
create policy delivery_zones_select_all on public.delivery_zones for select to anon using (true);
create policy delivery_zones_insert_all on public.delivery_zones for insert to anon with check (true);
create policy delivery_zones_update_all on public.delivery_zones for update to anon using (true) with check (true);
create policy delivery_zones_delete_all on public.delivery_zones for delete to anon using (true);

drop policy if exists home_content_select_all on public.home_content;
drop policy if exists home_content_insert_all on public.home_content;
drop policy if exists home_content_update_all on public.home_content;
drop policy if exists home_content_delete_all on public.home_content;
create policy home_content_select_all on public.home_content for select to anon using (true);
create policy home_content_insert_all on public.home_content for insert to anon with check (true);
create policy home_content_update_all on public.home_content for update to anon using (true) with check (true);
create policy home_content_delete_all on public.home_content for delete to anon using (true);

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

-- Grants for API roles
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

notify pgrst, 'reload schema';

commit;
