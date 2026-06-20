-- GHR Cake Supabase-first - Step 2: products audit
-- Run this file in Supabase SQL Editor after Step 1.
--
-- Goal:
-- Audit ghr_cake_products content stored in public.app_configs.
--
-- Safe notes:
-- - This file only reads data and writes to pg_temp audit results.
-- - It does not change public data.
-- - It does not DELETE/TRUNCATE/DROP public.* tables.

create temp table if not exists pg_temp.ghr_cake_products_audit_results (
  id bigserial primary key,
  area text not null,
  item text not null,
  status text not null,
  detail text,
  sample jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now()
);

truncate table pg_temp.ghr_cake_products_audit_results;

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

create or replace function pg_temp.ghr_add_products_audit(
  p_area text,
  p_item text,
  p_status text,
  p_detail text default null,
  p_sample jsonb default '[]'::jsonb
)
returns void
language plpgsql
as $$
begin
  insert into pg_temp.ghr_cake_products_audit_results (area, item, status, detail, sample)
  values (p_area, p_item, p_status, p_detail, coalesce(p_sample, '[]'::jsonb));
end;
$$;

do $$
declare
  v_products jsonb;
  v_count bigint := 0;
  v_bad_count bigint := 0;
  v_sample jsonb := '[]'::jsonb;
  v_heart jsonb;
begin
  if not pg_temp.ghr_public_table_exists('app_configs')
    or not pg_temp.ghr_public_column_exists('app_configs', 'id')
    or not pg_temp.ghr_public_column_exists('app_configs', 'value')
  then
    perform pg_temp.ghr_add_products_audit(
      '01_source',
      'app_configs readiness',
      'missing',
      'app_configs/id/value is required before auditing ghr_cake_products.'
    );
    return;
  end if;

  select value into v_products
  from public.app_configs
  where id = 'ghr_cake_products';

  perform pg_temp.ghr_add_products_audit(
    '01_source',
    'ghr_cake_products key',
    case
      when v_products is null then 'missing'
      when jsonb_typeof(v_products) <> 'array' then 'review'
      when jsonb_array_length(v_products) = 0 then 'review'
      else 'ok'
    end,
    case
      when v_products is null then 'Missing key.'
      when jsonb_typeof(v_products) <> 'array' then 'Value is not a JSON array.'
      when jsonb_array_length(v_products) = 0 then 'Product list is empty.'
      else 'Found ' || jsonb_array_length(v_products)::text || ' products.'
    end
  );

  if v_products is null or jsonb_typeof(v_products) <> 'array' then
    return;
  end if;

  v_count := jsonb_array_length(v_products);

  perform pg_temp.ghr_add_products_audit(
    '01_source',
    'product count',
    case when v_count >= 11 then 'ok' else 'review' end,
    'Current count: ' || v_count::text || '.'
  );

  select count(*), coalesce(jsonb_agg(product), '[]'::jsonb)
    into v_bad_count, v_sample
  from (
    select product
    from jsonb_array_elements(v_products) as product
    where coalesce(product->>'id', '') = ''
       or coalesce(product->>'name', '') = ''
       or coalesce(product->>'image', '') = ''
       or coalesce(product->>'price', '') = ''
    limit 5
  ) bad;

  perform pg_temp.ghr_add_products_audit(
    '02_required_fields',
    'id/name/image/price',
    case when v_bad_count = 0 then 'ok' else 'review' end,
    case when v_bad_count = 0 then 'All checked products have required fields.' else v_bad_count::text || ' product(s) are missing required fields.' end,
    v_sample
  );

  select count(*), coalesce(jsonb_agg(product), '[]'::jsonb)
    into v_bad_count, v_sample
  from (
    select product
    from jsonb_array_elements(v_products) as product
    where jsonb_typeof(product->'ingredients') <> 'array'
       or jsonb_typeof(product->'accessories') <> 'array'
    limit 5
  ) bad;

  perform pg_temp.ghr_add_products_audit(
    '02_required_fields',
    'ingredients/accessories arrays',
    case when v_bad_count = 0 then 'ok' else 'review' end,
    case when v_bad_count = 0 then 'All products use arrays for ingredients/accessories.' else v_bad_count::text || ' product(s) need array cleanup.' end,
    v_sample
  );

  select count(*), coalesce(jsonb_agg(product), '[]'::jsonb)
    into v_bad_count, v_sample
  from (
    select product
    from jsonb_array_elements(v_products) as product
    where coalesce(product->>'addonMode', '') not in ('paid', 'included_set', 'chibi_only', 'none')
    limit 5
  ) bad;

  perform pg_temp.ghr_add_products_audit(
    '03_addon_logic',
    'addonMode values',
    case when v_bad_count = 0 then 'ok' else 'review' end,
    case
      when v_bad_count = 0 then 'All products have valid addonMode.'
      else v_bad_count::text || ' product(s) are missing or using invalid addonMode. App can fallback, but Supabase-first should store it explicitly.'
    end,
    v_sample
  );

  select product into v_heart
  from jsonb_array_elements(v_products) as product
  where product->>'id' = 'set-trai-tim-2-tang'
  limit 1;

  perform pg_temp.ghr_add_products_audit(
    '03_addon_logic',
    'set-trai-tim-2-tang exists',
    case when v_heart is null then 'missing' else 'ok' end,
    case when v_heart is null then 'Heart 2-tier product is missing.' else 'Heart 2-tier product exists.' end,
    coalesce(jsonb_build_array(v_heart), '[]'::jsonb)
  );

  if v_heart is not null then
    perform pg_temp.ghr_add_products_audit(
      '03_addon_logic',
      'set-trai-tim-2-tang addonMode',
      case when v_heart->>'addonMode' = 'included_set' then 'ok' else 'review' end,
      'Expected addonMode: included_set. Current: ' || coalesce(v_heart->>'addonMode', '(missing)') || '.',
      jsonb_build_array(v_heart)
    );
  end if;

  select count(*), coalesce(jsonb_agg(product), '[]'::jsonb)
    into v_bad_count, v_sample
  from (
    select product
    from jsonb_array_elements(v_products) as product
    where coalesce(product->>'active', '') = ''
    limit 5
  ) bad;

  perform pg_temp.ghr_add_products_audit(
    '04_admin_readiness',
    'active flag',
    case when v_bad_count = 0 then 'ok' else 'review' end,
    case
      when v_bad_count = 0 then 'All products have explicit active flag.'
      else v_bad_count::text || ' product(s) do not have active flag. App fallback treats them as active.'
    end,
    v_sample
  );
end $$;

select
  area,
  item,
  status,
  detail,
  sample,
  checked_at
from pg_temp.ghr_cake_products_audit_results
order by
  case status
    when 'missing' then 1
    when 'review' then 2
    when 'ok' then 3
    else 4
  end,
  area,
  item;
