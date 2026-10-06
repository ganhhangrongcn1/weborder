-- Run outside BEGIN/COMMIT. IF NOT EXISTS does not repair an invalid index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id ON public.order_items USING btree (order_id);
select c.relname,i.indisvalid,i.indisready,i.indislive,pg_get_indexdef(c.oid) definition
from pg_index i join pg_class c on c.oid=i.indexrelid
where c.oid=to_regclass('public.idx_order_items_order_id');
