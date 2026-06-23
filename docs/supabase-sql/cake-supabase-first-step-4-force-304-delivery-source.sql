-- GHR Cake Supabase-first - Step 4: force cake delivery source to 30/4
-- Run this file in Supabase SQL Editor.
--
-- Goal:
-- Use the existing 30/4 branch from public.branches as the only cake delivery source.
-- This file does not create a new branch.
--
-- Data changed:
-- - public.app_configs value for id = 'ghr_cake_settings'
-- - value.shippingConfig.sourceBranchId
-- - value.cakeFulfillment.deliverySourceBranchId
-- Branch identity:
-- - Prefer public.branches.branch_uuid as the saved source id.
-- - Keep legacy id/code fallback only for older schemas.

do $$
declare
  v_branch_id text;
  v_branch_name text;
  v_branch_address text;
begin
  select
    coalesce(
      nullif(b.branch_uuid::text, ''),
      nullif(b.data->>'id', ''),
      nullif(b.legacy_id::text, ''),
      nullif(b.branch_code, ''),
      b.id::text
    ),
    coalesce(nullif(b.name, ''), b.data->>'name'),
    coalesce(nullif(b.address, ''), b.data->>'address')
  into v_branch_id, v_branch_name, v_branch_address
  from public.branches b
  where
    (
      coalesce(b.name, '') ilike '%30/4%'
      or coalesce(b.address, '') ilike '%30/4%'
      or coalesce(b.slug, '') ilike '%30-4%'
      or coalesce(b.data->>'name', '') ilike '%30/4%'
      or coalesce(b.data->>'address', '') ilike '%30/4%'
      or coalesce(b.data->>'slug', '') ilike '%30-4%'
    )
    and coalesce(b.is_open, true) = true
  order by b.updated_at desc nulls last, b.id desc
  limit 1;

  if v_branch_id is null then
    raise exception 'Khong tim thay chi nhanh 30/4 trong public.branches.';
  end if;

  update public.app_configs
  set
    value = jsonb_set(
      jsonb_set(
        coalesce(value, '{}'::jsonb),
        '{shippingConfig,sourceBranchId}',
        to_jsonb(v_branch_id),
        true
      ),
      '{cakeFulfillment,deliverySourceBranchId}',
      to_jsonb(v_branch_id),
      true
    ),
    updated_at = now()
  where id = 'ghr_cake_settings';

  if not found then
    raise exception 'Khong tim thay app_configs id ghr_cake_settings.';
  end if;

  raise notice 'Cake delivery source set to branch_uuid=%, name=%, address=%', v_branch_id, v_branch_name, v_branch_address;
end $$;

select
  c.id,
  c.value #>> '{shippingConfig,sourceBranchId}' as shipping_source_branch_id,
  c.value #>> '{cakeFulfillment,deliverySourceBranchId}' as cake_delivery_source_branch_id,
  b.name as matched_branch_name,
  b.address as matched_branch_address,
  b.lat as matched_branch_lat,
  b.lng as matched_branch_lng,
  b.data as matched_branch_data
from public.app_configs c
left join public.branches b
  on coalesce(nullif(b.branch_uuid::text, ''), nullif(b.data->>'id', ''), nullif(b.legacy_id::text, ''), nullif(b.branch_code, ''), b.id::text)
     = c.value #>> '{cakeFulfillment,deliverySourceBranchId}'
where c.id = 'ghr_cake_settings';
