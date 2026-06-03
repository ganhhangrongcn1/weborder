-- GHR Cake Supabase-first - Step 1
-- Run this file in Supabase SQL Editor.
--
-- Goal:
-- 1) Audit the Supabase foundation for the cake module.
-- 2) Seed ghr_cake_settings only when the key is missing.
--
-- Safe notes:
-- - This file does not delete public data.
-- - It does not DELETE/TRUNCATE/DROP public.* tables.
-- - Vietnamese text inside JSON uses unicode escapes to avoid copy/paste encoding issues.

create temp table if not exists pg_temp.ghr_cake_supabase_audit_results (
  id bigserial primary key,
  area text not null,
  item text not null,
  status text not null,
  detail text,
  checked_at timestamptz not null default now()
);

truncate table pg_temp.ghr_cake_supabase_audit_results;

create or replace function pg_temp.ghr_public_table_exists(p_table text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = p_table
  );
$$;

create or replace function pg_temp.ghr_public_column_exists(p_table text, p_column text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table
      and column_name = p_column
  );
$$;

create or replace function pg_temp.ghr_add_cake_audit(
  p_area text,
  p_item text,
  p_status text,
  p_detail text default null
)
returns void
language plpgsql
as $$
begin
  insert into pg_temp.ghr_cake_supabase_audit_results (area, item, status, detail)
  values (p_area, p_item, p_status, p_detail);
end;
$$;

do $$
declare
  v_app_configs_exists boolean := pg_temp.ghr_public_table_exists('app_configs');
  v_cake_orders_exists boolean := pg_temp.ghr_public_table_exists('cake_orders');
  v_settings jsonb;
  v_products jsonb;
  v_policy_count bigint;
  v_rls_enabled boolean;
  v_min_lead_text text;
begin
  perform pg_temp.ghr_add_cake_audit(
    '01_app_configs',
    'public.app_configs table',
    case when v_app_configs_exists then 'ok' else 'missing' end,
    case
      when v_app_configs_exists then 'Used for ghr_cake_settings and ghr_cake_products.'
      else 'Create app_configs before going Supabase-first.'
    end
  );

  if v_app_configs_exists then
    perform pg_temp.ghr_add_cake_audit(
      '01_app_configs',
      'app_configs.id column',
      case when pg_temp.ghr_public_column_exists('app_configs', 'id') then 'ok' else 'missing' end,
      'The service uses id as the config key.'
    );

    perform pg_temp.ghr_add_cake_audit(
      '01_app_configs',
      'app_configs.value column',
      case when pg_temp.ghr_public_column_exists('app_configs', 'value') then 'ok' else 'missing' end,
      'The service uses value to store JSON config.'
    );

    perform pg_temp.ghr_add_cake_audit(
      '01_app_configs',
      'app_configs.updated_at column',
      case when pg_temp.ghr_public_column_exists('app_configs', 'updated_at') then 'ok' else 'missing' end,
      'Used to track config updates.'
    );

    if pg_temp.ghr_public_column_exists('app_configs', 'id')
      and pg_temp.ghr_public_column_exists('app_configs', 'value')
    then
      select value into v_settings
      from public.app_configs
      where id = 'ghr_cake_settings';

      select value into v_products
      from public.app_configs
      where id = 'ghr_cake_products';
    end if;

    perform pg_temp.ghr_add_cake_audit(
      '01_app_configs',
      'ghr_cake_settings key',
      case when v_settings is null then 'missing' else 'ok' end,
      case
        when v_settings is null then 'Missing cake settings on Supabase. This file will seed the default key if possible.'
        else 'Cake settings already exist on Supabase.'
      end
    );

    perform pg_temp.ghr_add_cake_audit(
      '01_app_configs',
      'ghr_cake_products key',
      case
        when v_products is null then 'missing'
        when jsonb_typeof(v_products) <> 'array' then 'review'
        when jsonb_array_length(v_products) = 0 then 'review'
        else 'ok'
      end,
      case
        when v_products is null then 'Missing cake products on Supabase. Next step: seed products or save from Admin Cakes.'
        when jsonb_typeof(v_products) <> 'array' then 'Value is not a JSON array.'
        when jsonb_array_length(v_products) = 0 then 'Cake product list is empty.'
        else 'Found ' || jsonb_array_length(v_products)::text || ' cake products on Supabase.'
      end
    );

    if v_settings is not null then
      v_min_lead_text := v_settings #>> '{cakeFulfillment,minPickupLeadMinutes}';

      perform pg_temp.ghr_add_cake_audit(
        '02_cake_settings',
        'settings.shippingConfig',
        case when v_settings ? 'shippingConfig' then 'ok' else 'missing' end,
        'Cake shipping fee config.'
      );

      perform pg_temp.ghr_add_cake_audit(
        '02_cake_settings',
        'settings.cakeFulfillment',
        case when v_settings ? 'cakeFulfillment' then 'ok' else 'missing' end,
        'Pickup/delivery toggles, branch rules, delivery source branch, prep time.'
      );

      perform pg_temp.ghr_add_cake_audit(
        '02_cake_settings',
        'settings.addonCatalog',
        case when v_settings ? 'addonCatalog' then 'ok' else 'missing' end,
        'Chibi and decoration accessory library.'
      );

      perform pg_temp.ghr_add_cake_audit(
        '02_cake_settings',
        'minPickupLeadMinutes',
        case
          when v_min_lead_text is null then 'missing'
          when v_min_lead_text !~ '^[0-9]+$' then 'review'
          when v_min_lead_text::int >= 120 then 'ok'
          else 'review'
        end,
        coalesce(
          'Current value: ' || v_min_lead_text || ' minutes.',
          'Missing. App fallback is 120 minutes, but Supabase-first should store it explicitly.'
        )
      );
    end if;
  end if;

  perform pg_temp.ghr_add_cake_audit(
    '03_cake_orders',
    'public.cake_orders table',
    case when v_cake_orders_exists then 'ok' else 'missing' end,
    case
      when v_cake_orders_exists then 'Used to store cake orders.'
      else 'Run docs/cake-orders-and-config.sql or the equivalent migration.'
    end
  );

  if v_cake_orders_exists then
    perform pg_temp.ghr_add_cake_audit(
      '03_cake_orders',
      'cake_orders.order_code column',
      case when pg_temp.ghr_public_column_exists('cake_orders', 'order_code') then 'ok' else 'missing' end,
      'Cake order code.'
    );

    perform pg_temp.ghr_add_cake_audit(
      '03_cake_orders',
      'cake_orders.metadata column',
      case when pg_temp.ghr_public_column_exists('cake_orders', 'metadata') then 'ok' else 'missing' end,
      'Stores add-ons, pickup branch, and extra delivery details.'
    );

    perform pg_temp.ghr_add_cake_audit(
      '03_cake_orders',
      'cake_orders.fulfillment_type column',
      case when pg_temp.ghr_public_column_exists('cake_orders', 'fulfillment_type') then 'ok' else 'missing' end,
      'Separates pickup and delivery.'
    );

    select c.relrowsecurity into v_rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'cake_orders';

    perform pg_temp.ghr_add_cake_audit(
      '03_cake_orders',
      'cake_orders RLS',
      case when v_rls_enabled then 'ok' else 'review' end,
      'Recommended: enable RLS so public users insert only, admin/staff can read/update.'
    );

    select count(*) into v_policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cake_orders';

    perform pg_temp.ghr_add_cake_audit(
      '03_cake_orders',
      'cake_orders policies',
      case when v_policy_count >= 3 then 'ok' else 'review' end,
      'Current policies: ' || v_policy_count::text || '. Expected: public insert, admin/staff select, admin/staff update.'
    );
  end if;
end $$;

-- Seed settings only if missing. Existing values are kept unchanged.
do $$
begin
  if pg_temp.ghr_public_table_exists('app_configs')
    and pg_temp.ghr_public_column_exists('app_configs', 'id')
    and pg_temp.ghr_public_column_exists('app_configs', 'value')
    and pg_temp.ghr_public_column_exists('app_configs', 'updated_at')
  then
    execute $seed$
      insert into public.app_configs (id, value, updated_at)
      select
        'ghr_cake_settings',
        '{
          "zaloPhone": "0788422424",
          "pickupAddress": "G\u00e1nh H\u00e0ng Rong",
          "orderNotice": "\u0110\u1eb7t tr\u01b0\u1edbc t\u1ed1i thi\u1ec3u 2 - 4 ti\u1ebfng \u0111\u1ec3 shop chu\u1ea9n b\u1ecb b\u00e1nh \u0111\u1eb9p nh\u1ea5t.",
          "featuredProductIds": [
            "set-trai-tim-couple",
            "set-banh-trang-cuon-bo-18cm",
            "set-cuon-bo-mix-ps-muoi-tac-18cm",
            "set-banh-trang-cuon-tron-mix-topping-18cm"
          ],
          "shippingConfig": {
            "baseFeeFirst3Km": 25000,
            "feePerNextKm": 8000,
            "freeShipThreshold": 0,
            "supportShippingEnabled": false,
            "maxSupportShipFee": 0,
            "customerNote": "B\u00e1nh sinh nh\u1eadt c\u1ea7n giao c\u1ea9n th\u1eadn n\u00ean ph\u00ed ship s\u1ebd \u0111\u01b0\u1ee3c t\u00ednh ri\u00eang.",
            "maxRadiusKm": 12,
            "sourceBranchId": ""
          },
          "cakeFulfillment": {
            "pickupEnabled": true,
            "pickupBranchIds": [],
            "deliveryEnabled": true,
            "deliverySourceBranchId": "",
            "minPickupLeadMinutes": 120
          },
          "addonCatalog": {
            "chibi": {
              "enabled": true,
              "name": "H\u00ecnh chibi c\u00e1 nh\u00e2n h\u00f3a",
              "price": 20000,
              "image": "/cake-addons/chibi.jpg",
              "description": "H\u00ecnh chibi l\u00e0m theo y\u00eau c\u1ea7u ri\u00eang."
            },
            "decoration": {
              "enabled": true,
              "name": "Ph\u1ee5 ki\u1ec7n trang tr\u00ed theo y\u00eau c\u1ea7u",
              "price": 20000,
              "description": "C\u00f3 3 m\u1eabu ph\u1ee5 ki\u1ec7n \u0111i k\u00e8m \u0111\u1ec3 kh\u00e1ch ch\u1ecdn.",
              "referenceImages": [
                "/cake-addons/phu-kien-thuc-te-1.jpg",
                "/cake-addons/phu-kien-thuc-te-2.jpg",
                "/cake-addons/phu-kien-thuc-te-3.jpg",
                "/cake-addons/phu-kien-thuc-te-4.jpg"
              ],
              "options": [
                { "id": "pk-1", "name": "M\u1eabu ph\u1ee5 ki\u1ec7n 1", "price": 20000, "image": "/cake-addons/phu-kien-mau-1.jpg" },
                { "id": "pk-2", "name": "M\u1eabu ph\u1ee5 ki\u1ec7n 2", "price": 20000, "image": "/cake-addons/phu-kien-mau-2.jpg" },
                { "id": "pk-3", "name": "M\u1eabu ph\u1ee5 ki\u1ec7n 3", "price": 20000, "image": "/cake-addons/phu-kien-mau-3.jpg" }
              ]
            }
          }
        }'::jsonb,
        now()
      where not exists (
        select 1
        from public.app_configs
        where id = 'ghr_cake_settings'
      )
    $seed$;
  end if;
end $$;

select
  area,
  item,
  status,
  detail,
  checked_at
from pg_temp.ghr_cake_supabase_audit_results
order by
  case status
    when 'missing' then 1
    when 'review' then 2
    when 'ok' then 3
    else 4
  end,
  area,
  item;
