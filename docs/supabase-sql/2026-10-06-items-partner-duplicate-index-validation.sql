-- Read-only checks; return metadata or row counts, not order/customer details.
select c.relname,i.indisvalid,i.indisready,i.indislive,pg_get_indexdef(c.oid) definition
from pg_class c join pg_index i on i.indexrelid=c.oid
where c.oid in (to_regclass('public.order_items_order_id_idx'),to_regclass('public.partner_orders_order_time_desc_idx'));
select to_regclass('public.idx_order_items_order_id') is null items_duplicate_removed,
to_regclass('public.partner_orders_order_time_idx') is null partner_duplicate_removed;
explain (format json) select id from public.order_items where order_id='fixture-index-plan-only'::text;
explain (format json) select id from public.partner_orders
where order_time>='2026-10-05 17:00:00+00'::timestamptz
and order_time<'2026-10-06 17:00:00+00'::timestamptz
order by order_time desc limit 20;
begin transaction read only;
set local statement_timeout='3s';
select count(*) returned_rows from public.get_admin_business_analytics(
'1900-01-01 00:00:00+00'::timestamptz,'1900-01-02 00:00:00+00'::timestamptz,null::text,null::text);
commit;
begin transaction read only;
set local statement_timeout='3s';
select count(*) returned_rows from public.get_admin_dashboard_summary(
'2026-10-05 17:00:00+00'::timestamptz,'2026-10-06 17:00:00+00'::timestamptz,null::text,null::text);
commit;
