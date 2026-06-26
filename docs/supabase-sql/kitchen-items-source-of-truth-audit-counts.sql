-- Kitchen item source-of-truth audit counts
-- Safe to run: read-only checks, compact output for Supabase CLI.

with
recent_orders as (
  select id, order_code, status, branch_uuid, created_at, metadata
  from public.orders
  where created_at >= now() - interval '30 days'
),
web_item_counts as (
  select
    oi.order_id,
    count(*) as item_count,
    count(*) filter (where coalesce(oi.quantity, 0) <= 0) as invalid_quantity_count,
    count(*) filter (where coalesce(oi.product_name, '') = '') as missing_name_count
  from public.order_items oi
  join recent_orders ro on ro.id = oi.order_id
  group by oi.order_id
),
recent_partner_orders as (
  select id, partner_source, nexpos_order_id, display_order_code, order_code, branch_uuid, order_time, created_at, raw_data
  from public.partner_orders
  where coalesce(order_time, created_at) >= now() - interval '30 days'
),
partner_raw_counts as (
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
partner_item_counts as (
  select
    poi.partner_order_id,
    count(*) as table_item_count,
    count(distinct poi.item_key) filter (where coalesce(poi.item_key, '') <> '') as distinct_item_key_count,
    count(*) filter (where coalesce(poi.quantity, 0) <= 0) as invalid_quantity_count,
    count(*) filter (where coalesce(poi.partner_item_name, poi.web_product_name, '') = '') as missing_name_count
  from public.partner_order_items poi
  join recent_partner_orders rpo on rpo.id = poi.partner_order_id
  group by poi.partner_order_id
),
partner_duplicate_fingerprints as (
  select
    poi.partner_order_id,
    lower(regexp_replace(trim(coalesce(poi.partner_item_name, poi.web_product_name, '')), '\s+', ' ', 'g')) as normalized_name,
    poi.quantity,
    coalesce(poi.options::text, '') as options_signature,
    coalesce(poi.note, '') as note,
    count(*) as duplicate_count
  from public.partner_order_items poi
  join recent_partner_orders rpo on rpo.id = poi.partner_order_id
  group by
    poi.partner_order_id,
    lower(regexp_replace(trim(coalesce(poi.partner_item_name, poi.web_product_name, '')), '\s+', ' ', 'g')),
    poi.quantity,
    coalesce(poi.options::text, ''),
    coalesce(poi.note, '')
  having count(*) > 1
),
partner_duplicate_item_keys as (
  select poi.partner_order_id, poi.item_key, count(*) as duplicate_count
  from public.partner_order_items poi
  join recent_partner_orders rpo on rpo.id = poi.partner_order_id
  where coalesce(poi.item_key, '') <> ''
  group by poi.partner_order_id, poi.item_key
  having count(*) > 1
),
partner_branch_mismatches as (
  select poi.partner_order_id, count(*) as item_count
  from public.partner_order_items poi
  join recent_partner_orders rpo on rpo.id = poi.partner_order_id
  where poi.branch_uuid is not null
    and rpo.branch_uuid is not null
    and poi.branch_uuid <> rpo.branch_uuid
  group by poi.partner_order_id
)
select 'web_pos_total_orders_30d' as metric, count(*)::text as value
from recent_orders

union all

select 'web_pos_orders_missing_items_30d', count(*) filter (where coalesce(wic.item_count, 0) = 0)::text
from recent_orders ro
left join web_item_counts wic on wic.order_id = ro.id

union all

select 'web_pos_orders_with_invalid_item_data_30d', count(*) filter (
  where coalesce(wic.invalid_quantity_count, 0) > 0
    or coalesce(wic.missing_name_count, 0) > 0
)::text
from recent_orders ro
left join web_item_counts wic on wic.order_id = ro.id

union all

select 'partner_total_orders_30d', count(*)::text
from recent_partner_orders

union all

select 'partner_orders_missing_table_items_30d', count(*) filter (where coalesce(pic.table_item_count, 0) = 0)::text
from recent_partner_orders rpo
left join partner_item_counts pic on pic.partner_order_id = rpo.id

union all

select 'partner_orders_raw_vs_table_diff_30d', count(*) filter (
  where coalesce(prc.raw_item_count, 0) <> coalesce(pic.table_item_count, 0)
)::text
from recent_partner_orders rpo
left join partner_raw_counts prc on prc.partner_order_id = rpo.id
left join partner_item_counts pic on pic.partner_order_id = rpo.id

union all

select 'partner_orders_duplicate_fingerprint_30d', count(distinct partner_order_id)::text
from partner_duplicate_fingerprints

union all

select 'partner_duplicate_fingerprint_groups_30d', count(*)::text
from partner_duplicate_fingerprints

union all

select 'partner_duplicate_item_key_groups_30d', count(*)::text
from partner_duplicate_item_keys

union all

select 'partner_orders_branch_mismatch_30d', count(*)::text
from partner_branch_mismatches

union all

select 'partner_pending_items_30d', count(*)::text
from public.partner_order_items poi
join recent_partner_orders rpo on rpo.id = poi.partner_order_id
where coalesce(poi.kitchen_item_status, 'pending') = 'pending'

union all

select 'partner_done_items_30d', count(*)::text
from public.partner_order_items poi
join recent_partner_orders rpo on rpo.id = poi.partner_order_id
where poi.kitchen_item_status = 'done'

order by metric;
