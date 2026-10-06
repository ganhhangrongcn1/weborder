begin read only;
set local statement_timeout='3s';
set local role authenticated;
select
(select count(*) from public.get_loyalty_order_rule()) as rule_rows,
(select jsonb_build_object('total_orders',total_orders,'total_spent',total_spent,'claimed_points',claimed_points,'pending_points',pending_points) from public.get_customer_order_count_summary(null)) as empty_summary;
rollback;
select prorows,md5(prosrc) body_hash,proacl::text,prosecdef,provolatile,proconfig
from pg_proc where oid='public.get_loyalty_order_rule()'::regprocedure;
