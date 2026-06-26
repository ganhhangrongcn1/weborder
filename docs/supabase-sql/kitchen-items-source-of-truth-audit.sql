-- Kitchen item source-of-truth audit
-- Safe to run: read-only checks, no data changes.
-- Goal:
-- 1. Verify website / QR / POS orders use orders + order_items as kitchen source.
-- 2. Verify partner orders use partner_orders + partner_order_items as kitchen source.
-- 3. Detect missing items, duplicated items, and raw_data drift before changing runtime code.

-- ---------------------------------------------------------------------------
-- A. Website / QR / POS order item health
-- ---------------------------------------------------------------------------

with recent_orders as (
  select
    o.id,
    o.order_code,
    o.status,
    o.branch_uuid,
    o.created_at,
    coalesce(
      o.metadata ->> 'source',
      o.metadata ->> 'orderSource',
      o.metadata ->> 'channel',
      o.metadata ->> 'platform',
      'unknown'
    ) as source_name
  from public.orders o
  where o.created_at >= now() - interval '30 days'
),
item_counts as (
  select
    oi.order_id,
    count(*) as item_count,
    count(*) filter (where coalesce(oi.quantity, 0) <= 0) as invalid_quantity_count,
    count(*) filter (where coalesce(oi.product_name, '') = '') as missing_name_count
  from public.order_items oi
  join recent_orders ro on ro.id = oi.order_id
  group by oi.order_id
)
select
  'web_pos_item_count_summary' as check_name,
  count(*) as total_orders,
  count(*) filter (where coalesce(ic.item_count, 0) = 0) as orders_missing_items,
  count(*) filter (where coalesce(ic.invalid_quantity_count, 0) > 0) as orders_with_invalid_quantity,
  count(*) filter (where coalesce(ic.missing_name_count, 0) > 0) as orders_with_missing_item_name,
  min(ro.created_at) as first_order_at,
  max(ro.created_at) as last_order_at
from recent_orders ro
left join item_counts ic on ic.order_id = ro.id;

with recent_orders as (
  select
    o.id,
    o.order_code,
    o.status,
    o.branch_uuid,
    o.created_at,
    coalesce(
      o.metadata ->> 'source',
      o.metadata ->> 'orderSource',
      o.metadata ->> 'channel',
      o.metadata ->> 'platform',
      'unknown'
    ) as source_name
  from public.orders o
  where o.created_at >= now() - interval '30 days'
),
item_counts as (
  select
    oi.order_id,
    count(*) as item_count
  from public.order_items oi
  join recent_orders ro on ro.id = oi.order_id
  group by oi.order_id
)
select
  'web_pos_orders_missing_items_sample' as check_name,
  ro.id,
  ro.order_code,
  ro.source_name,
  ro.status,
  ro.branch_uuid,
  ro.created_at
from recent_orders ro
left join item_counts ic on ic.order_id = ro.id
where coalesce(ic.item_count, 0) = 0
order by ro.created_at desc
limit 50;

-- ---------------------------------------------------------------------------
-- B. Partner order item health
-- ---------------------------------------------------------------------------

with recent_partner_orders as (
  select
    po.id,
    po.partner_source,
    po.nexpos_order_id,
    po.display_order_code,
    po.order_code,
    po.order_status,
    po.branch_uuid,
    po.order_time,
    po.created_at,
    po.raw_data
  from public.partner_orders po
  where coalesce(po.order_time, po.created_at) >= now() - interval '30 days'
),
raw_counts as (
  select
    rpo.id as partner_order_id,
    count(*) filter (
      where dish.value is not null
        and lower(coalesce(dish.value ->> 'is_gift', 'false')) not in ('true', '1', 'yes')
    ) as raw_item_count,
    count(*) filter (
      where dish.value is not null
        and lower(coalesce(dish.value ->> 'is_gift', 'false')) in ('true', '1', 'yes')
    ) as raw_gift_count
  from recent_partner_orders rpo
  left join lateral jsonb_array_elements(coalesce(rpo.raw_data -> 'dishes', '[]'::jsonb)) as dish(value) on true
  group by rpo.id
),
item_counts as (
  select
    poi.partner_order_id,
    count(*) as table_item_count,
    count(distinct poi.item_key) filter (where coalesce(poi.item_key, '') <> '') as distinct_item_key_count,
    count(*) filter (where coalesce(poi.quantity, 0) <= 0) as invalid_quantity_count,
    count(*) filter (
      where coalesce(poi.partner_item_name, poi.web_product_name, '') = ''
    ) as missing_name_count
  from public.partner_order_items poi
  join recent_partner_orders rpo on rpo.id = poi.partner_order_id
  group by poi.partner_order_id
)
select
  'partner_item_count_summary' as check_name,
  count(*) as total_partner_orders,
  count(*) filter (where coalesce(ic.table_item_count, 0) = 0) as orders_missing_table_items,
  count(*) filter (where coalesce(rc.raw_item_count, 0) <> coalesce(ic.table_item_count, 0)) as orders_raw_count_differs,
  count(*) filter (where coalesce(ic.table_item_count, 0) <> coalesce(ic.distinct_item_key_count, 0)) as orders_with_duplicate_item_key,
  count(*) filter (where coalesce(ic.invalid_quantity_count, 0) > 0) as orders_with_invalid_quantity,
  count(*) filter (where coalesce(ic.missing_name_count, 0) > 0) as orders_with_missing_item_name,
  min(coalesce(rpo.order_time, rpo.created_at)) as first_order_at,
  max(coalesce(rpo.order_time, rpo.created_at)) as last_order_at
from recent_partner_orders rpo
left join raw_counts rc on rc.partner_order_id = rpo.id
left join item_counts ic on ic.partner_order_id = rpo.id;

with recent_partner_orders as (
  select
    po.id,
    po.partner_source,
    po.nexpos_order_id,
    po.display_order_code,
    po.order_code,
    po.order_status,
    po.branch_uuid,
    po.order_time,
    po.created_at,
    po.raw_data
  from public.partner_orders po
  where coalesce(po.order_time, po.created_at) >= now() - interval '30 days'
),
raw_counts as (
  select
    rpo.id as partner_order_id,
    count(*) filter (
      where dish.value is not null
        and lower(coalesce(dish.value ->> 'is_gift', 'false')) not in ('true', '1', 'yes')
    ) as raw_item_count
  from recent_partner_orders rpo
  left join lateral jsonb_array_elements(coalesce(rpo.raw_data -> 'dishes', '[]'::jsonb)) as dish(value) on true
  group by rpo.id
),
item_counts as (
  select
    poi.partner_order_id,
    count(*) as table_item_count
  from public.partner_order_items poi
  join recent_partner_orders rpo on rpo.id = poi.partner_order_id
  group by poi.partner_order_id
)
select
  'partner_orders_raw_vs_table_diff_sample' as check_name,
  rpo.id,
  rpo.partner_source,
  rpo.nexpos_order_id,
  rpo.display_order_code,
  rpo.order_code,
  rpo.order_status,
  rpo.branch_uuid,
  coalesce(rc.raw_item_count, 0) as raw_item_count,
  coalesce(ic.table_item_count, 0) as table_item_count,
  coalesce(rpo.order_time, rpo.created_at) as order_at
from recent_partner_orders rpo
left join raw_counts rc on rc.partner_order_id = rpo.id
left join item_counts ic on ic.partner_order_id = rpo.id
where coalesce(rc.raw_item_count, 0) <> coalesce(ic.table_item_count, 0)
order by coalesce(rpo.order_time, rpo.created_at) desc
limit 100;

-- ---------------------------------------------------------------------------
-- C. Partner duplicate diagnostics
-- ---------------------------------------------------------------------------

with normalized_items as (
  select
    poi.id,
    poi.partner_order_id,
    poi.item_key,
    poi.quantity,
    lower(regexp_replace(trim(coalesce(poi.partner_item_name, poi.web_product_name, '')), '\s+', ' ', 'g')) as normalized_name,
    coalesce(poi.options::text, '') as options_signature,
    coalesce(poi.note, '') as note
  from public.partner_order_items poi
  join public.partner_orders po on po.id = poi.partner_order_id
  where coalesce(po.order_time, po.created_at) >= now() - interval '30 days'
)
select
  'partner_duplicate_fingerprint_sample' as check_name,
  ni.partner_order_id,
  po.partner_source,
  po.nexpos_order_id,
  po.display_order_code,
  po.order_code,
  ni.normalized_name,
  ni.quantity,
  ni.options_signature,
  ni.note,
  count(*) as duplicate_count,
  array_agg(ni.id order by ni.id) as item_ids,
  array_agg(ni.item_key order by ni.id) as item_keys
from normalized_items ni
join public.partner_orders po on po.id = ni.partner_order_id
group by
  ni.partner_order_id,
  po.partner_source,
  po.nexpos_order_id,
  po.display_order_code,
  po.order_code,
  ni.normalized_name,
  ni.quantity,
  ni.options_signature,
  ni.note
having count(*) > 1
order by duplicate_count desc, max(po.created_at) desc
limit 100;

select
  'partner_duplicate_item_key_sample' as check_name,
  poi.partner_order_id,
  po.partner_source,
  po.nexpos_order_id,
  po.display_order_code,
  po.order_code,
  poi.item_key,
  count(*) as duplicate_count,
  array_agg(poi.id order by poi.id) as item_ids
from public.partner_order_items poi
join public.partner_orders po on po.id = poi.partner_order_id
where coalesce(po.order_time, po.created_at) >= now() - interval '30 days'
  and coalesce(poi.item_key, '') <> ''
group by
  poi.partner_order_id,
  po.partner_source,
  po.nexpos_order_id,
  po.display_order_code,
  po.order_code,
  poi.item_key
having count(*) > 1
order by duplicate_count desc, max(po.created_at) desc
limit 100;

-- ---------------------------------------------------------------------------
-- D. Branch and kitchen status diagnostics
-- ---------------------------------------------------------------------------

select
  'partner_item_branch_mismatch_sample' as check_name,
  poi.partner_order_id,
  po.partner_source,
  po.nexpos_order_id,
  po.display_order_code,
  po.branch_uuid as order_branch_uuid,
  poi.branch_uuid as item_branch_uuid,
  count(*) as item_count
from public.partner_order_items poi
join public.partner_orders po on po.id = poi.partner_order_id
where coalesce(po.order_time, po.created_at) >= now() - interval '30 days'
  and poi.branch_uuid is not null
  and po.branch_uuid is not null
  and poi.branch_uuid <> po.branch_uuid
group by
  poi.partner_order_id,
  po.partner_source,
  po.nexpos_order_id,
  po.display_order_code,
  po.branch_uuid,
  poi.branch_uuid
order by count(*) desc
limit 100;

select
  'web_pos_kitchen_status_counts' as check_name,
  coalesce(oi.kitchen_item_status, 'null') as kitchen_item_status,
  count(*) as item_count
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.created_at >= now() - interval '30 days'
group by coalesce(oi.kitchen_item_status, 'null')
order by item_count desc;

select
  'partner_kitchen_status_counts' as check_name,
  coalesce(poi.kitchen_item_status, 'null') as kitchen_item_status,
  count(*) as item_count
from public.partner_order_items poi
join public.partner_orders po on po.id = poi.partner_order_id
where coalesce(po.order_time, po.created_at) >= now() - interval '30 days'
group by coalesce(poi.kitchen_item_status, 'null')
order by item_count desc;
