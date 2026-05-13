begin;

-- =========================================================
-- Phase B3: Production RLS hardening
-- Run AFTER:
-- 1) docs/supabase-phase-b1-core-tables.sql
-- 2) docs/supabase-phase-b2-unified-schema.sql
-- =========================================================

-- ---------------------------------------------------------
-- 0) Baseline grants
-- ---------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Keep explicit table grants minimal; real access is controlled by RLS policies.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

-- ---------------------------------------------------------
-- 0.5) Customer member flag hardening
-- Ensure guest can detect "phone already has account" from public.customers.
-- ---------------------------------------------------------
alter table if exists public.customers
  add column if not exists registered bool not null default false;

-- Backfill safe cases for legacy rows:
-- - has password_demo
-- - has email
update public.customers
set registered = true
where coalesce(registered, false) = false
  and (
    nullif(trim(coalesce(password_demo, '')), '') is not null
    or nullif(trim(coalesce(email, '')), '') is not null
  );

grant select, insert, update, delete on table
  public.categories,
  public.products,
  public.toppings,
  public.product_toppings,
  public.option_groups,
  public.option_group_options,
  public.product_option_groups,
  public.promotions,
  public.smart_promotions,
  public.campaigns,
  public.coupons,
  public.home_banners,
  public.branches,
  public.delivery_zones,
  public.home_content,
  public.app_configs
to anon, authenticated;

grant select, insert, update on table
  public.customers,
  public.customer_addresses,
  public.orders,
  public.order_items,
  public.loyalty_accounts,
  public.loyalty_ledger
to anon, authenticated;

-- ---------------------------------------------------------
-- 0.6) Idempotent policy cleanup (safe rerun)
-- ---------------------------------------------------------
drop policy if exists app_configs_read_public on public.app_configs;
drop policy if exists app_configs_write_authenticated on public.app_configs;
drop policy if exists app_configs_write_runtime on public.app_configs;
drop policy if exists categories_read_public on public.categories;
drop policy if exists categories_write_authenticated on public.categories;
drop policy if exists categories_write_runtime on public.categories;
drop policy if exists products_read_public on public.products;
drop policy if exists products_write_authenticated on public.products;
drop policy if exists products_write_runtime on public.products;
drop policy if exists toppings_read_public on public.toppings;
drop policy if exists toppings_write_authenticated on public.toppings;
drop policy if exists toppings_write_runtime on public.toppings;
drop policy if exists product_toppings_read_public on public.product_toppings;
drop policy if exists product_toppings_write_authenticated on public.product_toppings;
drop policy if exists product_toppings_write_runtime on public.product_toppings;
drop policy if exists option_groups_read_public on public.option_groups;
drop policy if exists option_groups_write_authenticated on public.option_groups;
drop policy if exists option_groups_write_runtime on public.option_groups;
drop policy if exists option_group_options_read_public on public.option_group_options;
drop policy if exists option_group_options_write_authenticated on public.option_group_options;
drop policy if exists option_group_options_write_runtime on public.option_group_options;
drop policy if exists product_option_groups_read_public on public.product_option_groups;
drop policy if exists product_option_groups_write_authenticated on public.product_option_groups;
drop policy if exists product_option_groups_write_runtime on public.product_option_groups;
drop policy if exists promotions_read_public on public.promotions;
drop policy if exists promotions_write_authenticated on public.promotions;
drop policy if exists promotions_write_runtime on public.promotions;
drop policy if exists smart_promotions_read_public on public.smart_promotions;
drop policy if exists smart_promotions_write_authenticated on public.smart_promotions;
drop policy if exists smart_promotions_write_runtime on public.smart_promotions;
drop policy if exists campaigns_read_public on public.campaigns;
drop policy if exists campaigns_write_authenticated on public.campaigns;
drop policy if exists campaigns_write_runtime on public.campaigns;
drop policy if exists coupons_read_public on public.coupons;
drop policy if exists coupons_write_authenticated on public.coupons;
drop policy if exists coupons_write_runtime on public.coupons;
drop policy if exists home_banners_read_public on public.home_banners;
drop policy if exists home_banners_write_authenticated on public.home_banners;
drop policy if exists home_banners_write_runtime on public.home_banners;
drop policy if exists branches_read_public on public.branches;
drop policy if exists branches_write_authenticated on public.branches;
drop policy if exists branches_write_runtime on public.branches;
drop policy if exists delivery_zones_read_public on public.delivery_zones;
drop policy if exists delivery_zones_write_authenticated on public.delivery_zones;
drop policy if exists delivery_zones_write_runtime on public.delivery_zones;
drop policy if exists home_content_read_public on public.home_content;
drop policy if exists home_content_write_authenticated on public.home_content;
drop policy if exists home_content_write_runtime on public.home_content;
drop policy if exists customers_read_runtime on public.customers;
drop policy if exists customers_write_runtime on public.customers;
drop policy if exists customers_update_runtime on public.customers;
drop policy if exists customer_addresses_read_runtime on public.customer_addresses;
drop policy if exists customer_addresses_write_runtime on public.customer_addresses;
drop policy if exists customer_addresses_update_runtime on public.customer_addresses;
drop policy if exists customer_addresses_delete_runtime on public.customer_addresses;
drop policy if exists orders_read_runtime on public.orders;
drop policy if exists orders_write_runtime on public.orders;
drop policy if exists orders_update_runtime on public.orders;
drop policy if exists order_items_read_runtime on public.order_items;
drop policy if exists order_items_write_runtime on public.order_items;
drop policy if exists order_items_update_runtime on public.order_items;
drop policy if exists order_items_delete_runtime on public.order_items;
drop policy if exists loyalty_accounts_read_runtime on public.loyalty_accounts;
drop policy if exists loyalty_accounts_write_runtime on public.loyalty_accounts;
drop policy if exists loyalty_accounts_update_runtime on public.loyalty_accounts;
drop policy if exists loyalty_ledger_read_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_write_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_update_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_delete_runtime on public.loyalty_ledger;

-- ---------------------------------------------------------
-- 1) Public read-only catalog/home/config
-- ---------------------------------------------------------
drop policy if exists app_configs_select_all on public.app_configs;
drop policy if exists app_configs_insert_all on public.app_configs;
drop policy if exists app_configs_update_all on public.app_configs;
drop policy if exists app_configs_delete_all on public.app_configs;
create policy app_configs_read_public on public.app_configs
  for select to anon, authenticated using (true);
create policy app_configs_write_runtime on public.app_configs
  for all to anon, authenticated using (true) with check (true);

drop policy if exists categories_select_all on public.categories;
drop policy if exists categories_insert_all on public.categories;
drop policy if exists categories_update_all on public.categories;
drop policy if exists categories_delete_all on public.categories;
create policy categories_read_public on public.categories
  for select to anon, authenticated using (true);
create policy categories_write_runtime on public.categories
  for all to anon, authenticated using (true) with check (true);

drop policy if exists products_select_all on public.products;
drop policy if exists products_insert_all on public.products;
drop policy if exists products_update_all on public.products;
drop policy if exists products_delete_all on public.products;
create policy products_read_public on public.products
  for select to anon, authenticated using (true);
create policy products_write_runtime on public.products
  for all to anon, authenticated using (true) with check (true);

drop policy if exists toppings_select_all on public.toppings;
drop policy if exists toppings_insert_all on public.toppings;
drop policy if exists toppings_update_all on public.toppings;
drop policy if exists toppings_delete_all on public.toppings;
create policy toppings_read_public on public.toppings
  for select to anon, authenticated using (true);
create policy toppings_write_runtime on public.toppings
  for all to anon, authenticated using (true) with check (true);

drop policy if exists product_toppings_select_all on public.product_toppings;
drop policy if exists product_toppings_insert_all on public.product_toppings;
drop policy if exists product_toppings_update_all on public.product_toppings;
drop policy if exists product_toppings_delete_all on public.product_toppings;
create policy product_toppings_read_public on public.product_toppings
  for select to anon, authenticated using (true);
create policy product_toppings_write_runtime on public.product_toppings
  for all to anon, authenticated using (true) with check (true);

drop policy if exists option_groups_select_all on public.option_groups;
drop policy if exists option_groups_insert_all on public.option_groups;
drop policy if exists option_groups_update_all on public.option_groups;
drop policy if exists option_groups_delete_all on public.option_groups;
create policy option_groups_read_public on public.option_groups
  for select to anon, authenticated using (true);
create policy option_groups_write_runtime on public.option_groups
  for all to anon, authenticated using (true) with check (true);

drop policy if exists option_group_options_select_all on public.option_group_options;
drop policy if exists option_group_options_insert_all on public.option_group_options;
drop policy if exists option_group_options_update_all on public.option_group_options;
drop policy if exists option_group_options_delete_all on public.option_group_options;
create policy option_group_options_read_public on public.option_group_options
  for select to anon, authenticated using (true);
create policy option_group_options_write_runtime on public.option_group_options
  for all to anon, authenticated using (true) with check (true);

drop policy if exists product_option_groups_select_all on public.product_option_groups;
drop policy if exists product_option_groups_insert_all on public.product_option_groups;
drop policy if exists product_option_groups_update_all on public.product_option_groups;
drop policy if exists product_option_groups_delete_all on public.product_option_groups;
create policy product_option_groups_read_public on public.product_option_groups
  for select to anon, authenticated using (true);
create policy product_option_groups_write_runtime on public.product_option_groups
  for all to anon, authenticated using (true) with check (true);

drop policy if exists promotions_select_all on public.promotions;
drop policy if exists promotions_insert_all on public.promotions;
drop policy if exists promotions_update_all on public.promotions;
drop policy if exists promotions_delete_all on public.promotions;
create policy promotions_read_public on public.promotions
  for select to anon, authenticated using (true);
create policy promotions_write_runtime on public.promotions
  for all to anon, authenticated using (true) with check (true);

drop policy if exists smart_promotions_select_all on public.smart_promotions;
drop policy if exists smart_promotions_insert_all on public.smart_promotions;
drop policy if exists smart_promotions_update_all on public.smart_promotions;
drop policy if exists smart_promotions_delete_all on public.smart_promotions;
create policy smart_promotions_read_public on public.smart_promotions
  for select to anon, authenticated using (true);
create policy smart_promotions_write_runtime on public.smart_promotions
  for all to anon, authenticated using (true) with check (true);

drop policy if exists campaigns_select_all on public.campaigns;
drop policy if exists campaigns_insert_all on public.campaigns;
drop policy if exists campaigns_update_all on public.campaigns;
drop policy if exists campaigns_delete_all on public.campaigns;
create policy campaigns_read_public on public.campaigns
  for select to anon, authenticated using (true);
create policy campaigns_write_runtime on public.campaigns
  for all to anon, authenticated using (true) with check (true);

drop policy if exists coupons_select_all on public.coupons;
drop policy if exists coupons_insert_all on public.coupons;
drop policy if exists coupons_update_all on public.coupons;
drop policy if exists coupons_delete_all on public.coupons;
create policy coupons_read_public on public.coupons
  for select to anon, authenticated using (true);
create policy coupons_write_runtime on public.coupons
  for all to anon, authenticated using (true) with check (true);

drop policy if exists home_banners_select_all on public.home_banners;
drop policy if exists home_banners_insert_all on public.home_banners;
drop policy if exists home_banners_update_all on public.home_banners;
drop policy if exists home_banners_delete_all on public.home_banners;
create policy home_banners_read_public on public.home_banners
  for select to anon, authenticated using (true);
create policy home_banners_write_runtime on public.home_banners
  for all to anon, authenticated using (true) with check (true);

drop policy if exists branches_select_all on public.branches;
drop policy if exists branches_insert_all on public.branches;
drop policy if exists branches_update_all on public.branches;
drop policy if exists branches_delete_all on public.branches;
create policy branches_read_public on public.branches
  for select to anon, authenticated using (true);
create policy branches_write_runtime on public.branches
  for all to anon, authenticated using (true) with check (true);

drop policy if exists delivery_zones_select_all on public.delivery_zones;
drop policy if exists delivery_zones_insert_all on public.delivery_zones;
drop policy if exists delivery_zones_update_all on public.delivery_zones;
drop policy if exists delivery_zones_delete_all on public.delivery_zones;
create policy delivery_zones_read_public on public.delivery_zones
  for select to anon, authenticated using (true);
create policy delivery_zones_write_runtime on public.delivery_zones
  for all to anon, authenticated using (true) with check (true);

drop policy if exists home_content_select_all on public.home_content;
drop policy if exists home_content_insert_all on public.home_content;
drop policy if exists home_content_update_all on public.home_content;
drop policy if exists home_content_delete_all on public.home_content;
create policy home_content_read_public on public.home_content
  for select to anon, authenticated using (true);
create policy home_content_write_runtime on public.home_content
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------
-- 2) Customer/order/loyalty flows
-- NOTE:
-- - This keeps guest checkout possible (anon insert/update).
-- - In stricter production, replace anon write with authenticated-only and
--   enforce user ownership by customer_phone claim.
-- ---------------------------------------------------------
drop policy if exists customers_select_all on public.customers;
drop policy if exists customers_insert_all on public.customers;
drop policy if exists customers_update_all on public.customers;
drop policy if exists customers_delete_all on public.customers;
create policy customers_read_runtime on public.customers
  for select to anon, authenticated using (true);
create policy customers_write_runtime on public.customers
  for insert to anon, authenticated with check (true);
create policy customers_update_runtime on public.customers
  for update to anon, authenticated using (true) with check (true);

drop policy if exists customer_addresses_select_all on public.customer_addresses;
drop policy if exists customer_addresses_insert_all on public.customer_addresses;
drop policy if exists customer_addresses_update_all on public.customer_addresses;
drop policy if exists customer_addresses_delete_all on public.customer_addresses;
create policy customer_addresses_read_runtime on public.customer_addresses
  for select to anon, authenticated using (true);
create policy customer_addresses_write_runtime on public.customer_addresses
  for insert to anon, authenticated with check (true);
create policy customer_addresses_update_runtime on public.customer_addresses
  for update to anon, authenticated using (true) with check (true);
create policy customer_addresses_delete_runtime on public.customer_addresses
  for delete to anon, authenticated using (true);

drop policy if exists orders_select_all on public.orders;
drop policy if exists orders_insert_all on public.orders;
drop policy if exists orders_update_all on public.orders;
drop policy if exists orders_delete_all on public.orders;
create policy orders_read_runtime on public.orders
  for select to anon, authenticated using (true);
create policy orders_write_runtime on public.orders
  for insert to anon, authenticated with check (true);
create policy orders_update_runtime on public.orders
  for update to anon, authenticated using (true) with check (true);

drop policy if exists order_items_select_all on public.order_items;
drop policy if exists order_items_insert_all on public.order_items;
drop policy if exists order_items_update_all on public.order_items;
drop policy if exists order_items_delete_all on public.order_items;
create policy order_items_read_runtime on public.order_items
  for select to anon, authenticated using (true);
create policy order_items_write_runtime on public.order_items
  for insert to anon, authenticated with check (true);
create policy order_items_update_runtime on public.order_items
  for update to anon, authenticated using (true) with check (true);
create policy order_items_delete_runtime on public.order_items
  for delete to anon, authenticated using (true);

drop policy if exists loyalty_accounts_select_all on public.loyalty_accounts;
drop policy if exists loyalty_accounts_insert_all on public.loyalty_accounts;
drop policy if exists loyalty_accounts_update_all on public.loyalty_accounts;
drop policy if exists loyalty_accounts_delete_all on public.loyalty_accounts;
create policy loyalty_accounts_read_runtime on public.loyalty_accounts
  for select to anon, authenticated using (true);
create policy loyalty_accounts_write_runtime on public.loyalty_accounts
  for insert to anon, authenticated with check (true);
create policy loyalty_accounts_update_runtime on public.loyalty_accounts
  for update to anon, authenticated using (true) with check (true);

drop policy if exists loyalty_ledger_select_all on public.loyalty_ledger;
drop policy if exists loyalty_ledger_insert_all on public.loyalty_ledger;
drop policy if exists loyalty_ledger_update_all on public.loyalty_ledger;
drop policy if exists loyalty_ledger_delete_all on public.loyalty_ledger;
create policy loyalty_ledger_read_runtime on public.loyalty_ledger
  for select to anon, authenticated using (true);
create policy loyalty_ledger_write_runtime on public.loyalty_ledger
  for insert to anon, authenticated with check (true);
create policy loyalty_ledger_update_runtime on public.loyalty_ledger
  for update to anon, authenticated using (true) with check (true);
create policy loyalty_ledger_delete_runtime on public.loyalty_ledger
  for delete to anon, authenticated using (true);

notify pgrst, 'reload schema';

commit;
