-- Kitchen item source-of-truth audit samples
-- Safe to run: read-only checks, compact sample output.

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
  select oi.order_id, count(*) as item_count
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
    ) as raw_item_count
  from recent_partner_orders rpo
  left join lateral jsonb_array_elements(coalesce(rpo.raw_data -> 'dishes', '[]'::jsonb)) as dish(value) on true
  group by rpo.id
),
partner_item_counts as (
  select poi.partner_order_id, count(*) as table_item_count
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
    count(*) as duplicate_count,
    string_agg(coalesce(poi.item_key, ''), ', ' order by poi.item_key) as item_keys
  from public.partner_order_items poi
  join recent_partner_orders rpo on rpo.id = poi.partner_order_id
  group by
    poi.partner_order_id,
    lower(regexp_replace(trim(coalesce(poi.partner_item_name, poi.web_product_name, '')), '\s+', ' ', 'g')),
    poi.quantity,
    coalesce(poi.options::text, ''),
    coalesce(poi.note, '')
  having count(*) > 1
)
select *
from (
  select
    'web_missing_items' as issue,
    ro.order_code as code,
    ro.source_name as source,
    ro.status as status,
    0::bigint as raw_count,
    coalesce(wic.item_count, 0)::bigint as table_count,
    ro.created_at as order_at,
    ro.id::text as row_id,
    null::text as note
  from recent_orders ro
  left join web_item_counts wic on wic.order_id = ro.id
  where coalesce(wic.item_count, 0) = 0
  order by ro.created_at desc
  limit 20
) web_missing

union all

select *
from (
  select
    'partner_missing_table_items' as issue,
    coalesce(rpo.display_order_code, rpo.order_code) as code,
    rpo.partner_source as source,
    rpo.order_status as status,
    coalesce(prc.raw_item_count, 0)::bigint as raw_count,
    coalesce(pic.table_item_count, 0)::bigint as table_count,
    coalesce(rpo.order_time, rpo.created_at) as order_at,
    rpo.id::text as row_id,
    rpo.nexpos_order_id as note
  from recent_partner_orders rpo
  left join partner_raw_counts prc on prc.partner_order_id = rpo.id
  left join partner_item_counts pic on pic.partner_order_id = rpo.id
  where coalesce(pic.table_item_count, 0) = 0
  order by coalesce(rpo.order_time, rpo.created_at) desc
  limit 20
) partner_missing

union all

select *
from (
  select
    'partner_raw_table_diff' as issue,
    coalesce(rpo.display_order_code, rpo.order_code) as code,
    rpo.partner_source as source,
    rpo.order_status as status,
    coalesce(prc.raw_item_count, 0)::bigint as raw_count,
    coalesce(pic.table_item_count, 0)::bigint as table_count,
    coalesce(rpo.order_time, rpo.created_at) as order_at,
    rpo.id::text as row_id,
    rpo.nexpos_order_id as note
  from recent_partner_orders rpo
  left join partner_raw_counts prc on prc.partner_order_id = rpo.id
  left join partner_item_counts pic on pic.partner_order_id = rpo.id
  where coalesce(prc.raw_item_count, 0) <> coalesce(pic.table_item_count, 0)
  order by coalesce(rpo.order_time, rpo.created_at) desc
  limit 20
) partner_diff

union all

select *
from (
  select
    'partner_duplicate_fingerprint' as issue,
    coalesce(rpo.display_order_code, rpo.order_code) as code,
    rpo.partner_source as source,
    rpo.order_status as status,
    pdf.duplicate_count::bigint as raw_count,
    0::bigint as table_count,
    coalesce(rpo.order_time, rpo.created_at) as order_at,
    rpo.id::text as row_id,
    left(concat(pdf.normalized_name, ' | ', pdf.item_keys), 180) as note
  from partner_duplicate_fingerprints pdf
  join recent_partner_orders rpo on rpo.id = pdf.partner_order_id
  order by pdf.duplicate_count desc, coalesce(rpo.order_time, rpo.created_at) desc
  limit 20
) partner_duplicates

order by issue, order_at desc;
