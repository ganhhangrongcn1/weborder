-- Read-only post-deployment checks. No customer details are returned.
select to_regclass('public.idx_orders_created_at') is null duplicate_removed,
c.oid retained_oid,i.indisvalid,i.indisready,i.indislive,
pg_get_indexdef(c.oid) retained_definition
from pg_class c join pg_index i on i.indexrelid=c.oid
where c.oid=to_regclass('public.orders_created_at_desc_idx');

explain (format json)
select id from public.orders
where created_at>='2026-10-05 17:00:00+00'::timestamptz
and created_at<'2026-10-06 17:00:00+00'::timestamptz
order by created_at desc limit 20;

begin transaction read only;
set local statement_timeout='3s';
select count(*) returned_rows
from public.get_admin_dashboard_summary(
'2026-10-05 17:00:00+00'::timestamptz,
'2026-10-06 17:00:00+00'::timestamptz,null::text,null::text);
commit;
