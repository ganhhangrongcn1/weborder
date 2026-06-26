-- Kitchen partner item unique guard
-- Run after duplicate line_index cleanup returns zero remaining duplicates.
-- This prevents partner_order_items from being duplicated again with another item_key.

create unique index if not exists partner_order_items_partner_order_line_index_uidx
  on public.partner_order_items (partner_order_id, line_index)
  where line_index is not null;

notify pgrst, 'reload schema';

select
  'partner_order_line_index_unique_index' as check_name,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'partner_order_items'
  and indexname = 'partner_order_items_partner_order_line_index_uidx';
