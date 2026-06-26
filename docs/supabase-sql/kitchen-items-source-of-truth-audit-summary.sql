-- Kitchen item source-of-truth audit summary
-- Safe to run: read-only checks, one output table for Supabase CLI.

with
recent_orders as (
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
partner_raw_counts as (
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
partner_item_counts as (
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
),
partner_normalized_items as (
  select
    poi.id,
    poi.partner_order_id,
    poi.item_key,
    poi.quantity,
    lower(regexp_replace(trim(coalesce(poi.partner_item_name, poi.web_product_name, '')), '\s+', ' ', 'g')) as normalized_name,
    coalesce(poi.options::text, '') as options_signature,
    coalesce(poi.note, '') as note
  from public.partner_order_items poi
  join recent_partner_orders rpo on rpo.id = poi.partner_order_id
),
partner_duplicate_fingerprints as (
  select
    partner_order_id,
    normalized_name,
    quantity,
    options_signature,
    note,
    count(*) as duplicate_count
  from partner_normalized_items
  group by partner_order_id, normalized_name, quantity, options_signature, note
  having count(*) > 1
),
partner_duplicate_item_keys as (
  select
    partner_order_id,
    item_key,
    count(*) as duplicate_count
  from public.partner_order_items
  where coalesce(item_key, '') <> ''
  group by partner_order_id, item_key
  having count(*) > 1
),
partner_branch_mismatches as (
  select
    poi.partner_order_id,
    count(*) as item_count
  from public.partner_order_items poi
  join recent_partner_orders rpo on rpo.id = poi.partner_order_id
  where poi.branch_uuid is not null
    and rpo.branch_uuid is not null
    and poi.branch_uuid <> rpo.branch_uuid
  group by poi.partner_order_id
)
select
  'web_pos_total_orders_30d' as metric,
  count(*)::text as value,
  null::text as detail
from recent_orders

union all

select
  'web_pos_orders_missing_items_30d' as metric,
  count(*) filter (where coalesce(wic.item_count, 0) = 0)::text as value,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ro.id,
        'order_code', ro.order_code,
        'source', ro.source_name,
        'status', ro.status,
        'created_at', ro.created_at
      )
      order by ro.created_at desc
    ) filter (where coalesce(wic.item_count, 0) = 0),
    '[]'::jsonb
  )::text as detail
from recent_orders ro
left join web_item_counts wic on wic.order_id = ro.id

union all

select
  'web_pos_orders_with_invalid_item_data_30d' as metric,
  count(*) filter (
    where coalesce(wic.invalid_quantity_count, 0) > 0
      or coalesce(wic.missing_name_count, 0) > 0
  )::text as value,
  null::text as detail
from recent_orders ro
left join web_item_counts wic on wic.order_id = ro.id

union all

select
  'partner_total_orders_30d' as metric,
  count(*)::text as value,
  null::text as detail
from recent_partner_orders

union all

select
  'partner_orders_missing_table_items_30d' as metric,
  count(*) filter (where coalesce(pic.table_item_count, 0) = 0)::text as value,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rpo.id,
        'source', rpo.partner_source,
        'display_order_code', rpo.display_order_code,
        'order_code', rpo.order_code,
        'nexpos_order_id', rpo.nexpos_order_id,
        'order_at', coalesce(rpo.order_time, rpo.created_at)
      )
      order by coalesce(rpo.order_time, rpo.created_at) desc
    ) filter (where coalesce(pic.table_item_count, 0) = 0),
    '[]'::jsonb
  )::text as detail
from recent_partner_orders rpo
left join partner_item_counts pic on pic.partner_order_id = rpo.id

union all

select
  'partner_orders_raw_vs_table_diff_30d' as metric,
  count(*) filter (
    where coalesce(prc.raw_item_count, 0) <> coalesce(pic.table_item_count, 0)
  )::text as value,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rpo.id,
        'source', rpo.partner_source,
        'display_order_code', rpo.display_order_code,
        'order_code', rpo.order_code,
        'nexpos_order_id', rpo.nexpos_order_id,
        'raw_item_count', coalesce(prc.raw_item_count, 0),
        'table_item_count', coalesce(pic.table_item_count, 0),
        'order_at', coalesce(rpo.order_time, rpo.created_at)
      )
      order by coalesce(rpo.order_time, rpo.created_at) desc
    ) filter (where coalesce(prc.raw_item_count, 0) <> coalesce(pic.table_item_count, 0)),
    '[]'::jsonb
  )::text as detail
from recent_partner_orders rpo
left join partner_raw_counts prc on prc.partner_order_id = rpo.id
left join partner_item_counts pic on pic.partner_order_id = rpo.id

union all

select
  'partner_orders_duplicate_fingerprint_30d' as metric,
  count(distinct partner_order_id)::text as value,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'partner_order_id', partner_order_id,
        'normalized_name', normalized_name,
        'quantity', quantity,
        'duplicate_count', duplicate_count
      )
      order by duplicate_count desc
    ),
    '[]'::jsonb
  )::text as detail
from partner_duplicate_fingerprints

union all

select
  'partner_duplicate_item_key_groups_30d' as metric,
  count(*)::text as value,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'partner_order_id', partner_order_id,
        'item_key', item_key,
        'duplicate_count', duplicate_count
      )
      order by duplicate_count desc
    ),
    '[]'::jsonb
  )::text as detail
from partner_duplicate_item_keys

union all

select
  'partner_orders_branch_mismatch_30d' as metric,
  count(*)::text as value,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'partner_order_id', partner_order_id,
        'item_count', item_count
      )
    ),
    '[]'::jsonb
  )::text as detail
from partner_branch_mismatches

union all

select
  'partner_item_status_counts_30d' as metric,
  count(*)::text as value,
  coalesce(
    jsonb_object_agg(status_name, item_count order by status_name),
    '{}'::jsonb
  )::text as detail
from (
  select
    coalesce(poi.kitchen_item_status, 'null') as status_name,
    count(*) as item_count
  from public.partner_order_items poi
  join recent_partner_orders rpo on rpo.id = poi.partner_order_id
  group by coalesce(poi.kitchen_item_status, 'null')
) status_counts
order by metric;
