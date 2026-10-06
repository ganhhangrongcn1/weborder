-- Run outside any BEGIN/COMMIT block. Restores the original definition, not its old OID/stats.
-- Verify the retained orders_created_at_desc_idx and created_at schema first.
-- If a prior attempt left an invalid index, inspect it before retrying; IF NOT EXISTS does not repair it.
create index concurrently if not exists idx_orders_created_at
  on public.orders using btree (created_at desc);
-- Confirm valid/ready/live and the exact definition after restoration.
select c.relname, i.indisvalid, i.indisready, i.indislive, pg_get_indexdef(c.oid) definition
from pg_index i join pg_class c on c.oid=i.indexrelid
where c.oid=to_regclass('public.idx_orders_created_at');
