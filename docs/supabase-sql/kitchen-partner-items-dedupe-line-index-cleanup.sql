-- Kitchen partner item duplicate cleanup by line_index
-- This script deletes only safe duplicate rows:
-- - same partner_order_id
-- - same line_index
-- - same normalized item fingerprint in the duplicate group
--
-- It keeps the best row by:
-- 1. done kitchen item status first
-- 2. latest kitchen_done_at first
-- 3. display-code item_key first
-- 4. lowest id as final tie-breaker
--
-- Deleted rows are backed up in maintenance.partner_order_items_cleanup_backup.

create schema if not exists maintenance;

create table if not exists maintenance.partner_order_items_cleanup_backup (
  cleanup_batch_id text not null,
  cleanup_at timestamptz not null default now(),
  reason text not null,
  kept_item_id uuid,
  duplicate_group_key text not null,
  row_data jsonb not null
);

drop table if exists tmp_kitchen_partner_items_to_delete;

create temp table tmp_kitchen_partner_items_to_delete on commit drop as
with base_rows as (
  select
    poi.*,
    po.display_order_code as parent_display_order_code,
    po.order_code as parent_order_code,
    concat_ws(
      '|',
      lower(regexp_replace(trim(coalesce(poi.partner_item_name, poi.web_product_name, '')), '\s+', ' ', 'g')),
      coalesce(poi.quantity::text, ''),
      coalesce(poi.note, '')
    ) as item_fingerprint
  from public.partner_order_items poi
  join public.partner_orders po on po.id = poi.partner_order_id
  where poi.line_index is not null
),
safe_groups as (
  select
    partner_order_id,
    line_index,
    count(*) as row_count,
    count(distinct item_fingerprint) as fingerprint_count
  from base_rows
  group by partner_order_id, line_index
  having count(*) > 1
    and count(distinct item_fingerprint) = 1
),
ranked_rows as (
  select
    br.id,
    br.partner_order_id,
    br.line_index,
    br.item_key,
    row_number() over (
      partition by br.partner_order_id, br.line_index
      order by
        case when br.kitchen_item_status = 'done' then 0 else 1 end,
        br.kitchen_done_at desc nulls last,
        case when br.item_key like coalesce(br.parent_display_order_code, br.parent_order_code) || '-%' then 0 else 1 end,
        br.id
    ) as keep_rank,
    first_value(br.id) over (
      partition by br.partner_order_id, br.line_index
      order by
        case when br.kitchen_item_status = 'done' then 0 else 1 end,
        br.kitchen_done_at desc nulls last,
        case when br.item_key like coalesce(br.parent_display_order_code, br.parent_order_code) || '-%' then 0 else 1 end,
        br.id
    ) as kept_item_id
  from base_rows br
  join safe_groups sg
    on sg.partner_order_id = br.partner_order_id
   and sg.line_index = br.line_index
)
select
  id,
  kept_item_id,
  partner_order_id,
  line_index,
  concat(partner_order_id::text, ':', line_index::text) as duplicate_group_key
from ranked_rows
where keep_rank > 1;

insert into maintenance.partner_order_items_cleanup_backup (
  cleanup_batch_id,
  cleanup_at,
  reason,
  kept_item_id,
  duplicate_group_key,
  row_data
)
select
  'kitchen_partner_line_index_dedupe_20260626',
  now(),
  'duplicate partner_order_items row with same partner_order_id and line_index',
  td.kept_item_id,
  td.duplicate_group_key,
  to_jsonb(poi)
from tmp_kitchen_partner_items_to_delete td
join public.partner_order_items poi on poi.id = td.id;

drop table if exists tmp_kitchen_partner_items_deleted;

create temp table tmp_kitchen_partner_items_deleted on commit drop as
with deleted_rows as (
  delete from public.partner_order_items poi
  using tmp_kitchen_partner_items_to_delete td
  where poi.id = td.id
  returning poi.id
)
select * from deleted_rows;

with remaining_duplicate_groups as (
  select partner_order_id, line_index
  from public.partner_order_items
  where line_index is not null
  group by partner_order_id, line_index
  having count(*) > 1
),
missing_line_index as (
  select id
  from public.partner_order_items
  where line_index is null
)
select
  'backed_up_rows' as metric,
  count(*)::text as value
from tmp_kitchen_partner_items_to_delete

union all

select
  'deleted_rows',
  count(*)::text
from tmp_kitchen_partner_items_deleted

union all

select
  'remaining_duplicate_line_index_groups',
  count(*)::text
from remaining_duplicate_groups

union all

select
  'missing_line_index_rows',
  count(*)::text
from missing_line_index

order by metric;
