set local lock_timeout='2s';
set local statement_timeout='5s';
do $migration$
declare v_rows real; v_hash text;
begin
select prorows,md5(prosrc) into v_rows,v_hash from pg_proc where oid='public.get_loyalty_order_rule()'::regprocedure;
if v_hash <> '1d54b15c0f6571f71193397405eadf73' then raise exception 'Loyalty rule body changed; aborting'; end if;
if v_rows=1 then return; end if;
if v_rows<>1000 then raise exception 'Unexpected row estimate; aborting'; end if;
alter function public.get_loyalty_order_rule() rows 1;
end;
$migration$;
