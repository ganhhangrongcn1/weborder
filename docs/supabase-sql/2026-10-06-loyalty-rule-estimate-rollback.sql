begin;
set local lock_timeout='2s';
set local statement_timeout='5s';
do $rollback$
begin
if not exists(select 1 from pg_proc where oid='public.get_loyalty_order_rule()'::regprocedure and md5(prosrc)='1d54b15c0f6571f71193397405eadf73' and prorows in (1,1000)) then raise exception 'Unexpected rule version; aborting rollback'; end if;
alter function public.get_loyalty_order_rule() rows 1000;
end;
$rollback$;
commit;
