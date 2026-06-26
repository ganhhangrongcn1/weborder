-- Kitchen partner item line index contract
-- Purpose:
-- - Add a stable per-order item position for partner_order_items.
-- - Keep kitchen source-of-truth on partner_order_items, not raw_data.dishes.
-- - Prepare n8n to upsert by partner_order_id + line_index later.
--
-- Safe notes:
-- - This file is additive and backfills missing line_index values.
-- - It does not delete rows.
-- - It does not add a unique constraint yet because existing production data may
--   already contain duplicated rows from fallback repair.

alter table public.partner_order_items
  add column if not exists line_index integer;

comment on column public.partner_order_items.line_index is
  'Zero-based item position from the partner/NexPOS dish list. Used as stable kitchen item identity per partner_order_id.';

-- First pass: derive line_index from an item_key suffix like GF-060-3 or 123456-3.
update public.partner_order_items
set line_index = substring(item_key from '-([0-9]+)$')::integer
where line_index is null
  and coalesce(item_key, '') ~ '-[0-9]+$';

-- Second pass: assign deterministic positions to older rows with no parseable key.
with ranked_items as (
  select
    id,
    row_number() over (
      partition by partner_order_id
      order by id
    ) - 1 as fallback_line_index
  from public.partner_order_items
  where line_index is null
)
update public.partner_order_items poi
set line_index = ranked_items.fallback_line_index
from ranked_items
where poi.id = ranked_items.id
  and poi.line_index is null;

create index if not exists partner_order_items_partner_order_line_index_idx
  on public.partner_order_items (partner_order_id, line_index);

create index if not exists partner_order_items_partner_order_status_idx
  on public.partner_order_items (partner_order_id, kitchen_item_status);

notify pgrst, 'reload schema';

-- Verification 1: line_index should be filled for all partner item rows.
select
  'partner_items_missing_line_index' as check_name,
  count(*) as missing_line_index_count
from public.partner_order_items
where line_index is null;

-- Verification 2: these duplicates must be cleaned before adding a unique constraint.
select
  'partner_items_duplicate_line_index' as check_name,
  partner_order_id,
  line_index,
  count(*) as duplicate_count,
  array_agg(id order by id) as item_ids,
  array_agg(item_key order by id) as item_keys
from public.partner_order_items
where line_index is not null
group by partner_order_id, line_index
having count(*) > 1
order by duplicate_count desc, partner_order_id, line_index
limit 100;

-- Future hardening step, only after duplicate_line_index returns zero rows:
--
-- create unique index concurrently if not exists partner_order_items_partner_order_line_index_uidx
--   on public.partner_order_items (partner_order_id, line_index)
--   where line_index is not null;
