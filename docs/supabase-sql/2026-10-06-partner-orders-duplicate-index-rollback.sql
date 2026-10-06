-- Run outside BEGIN/COMMIT. IF NOT EXISTS does not repair an invalid index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS partner_orders_order_time_idx ON public.partner_orders USING btree (order_time DESC);
select c.relname,i.indisvalid,i.indisready,i.indislive,pg_get_indexdef(c.oid) definition
from pg_index i join pg_class c on c.oid=i.indexrelid
where c.oid=to_regclass('public.partner_orders_order_time_idx');
