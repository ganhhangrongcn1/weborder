set local lock_timeout='2s';
set local statement_timeout='5s';
do $migration$
declare v_definition text;
begin
select pg_get_functiondef('public.upsert_customer_stub_profile(text,text,text,text)'::regprocedure) into v_definition;
if md5(v_definition)='8a9027cc8e3e3e9aabc6873b22b5bc5e' then return; end if;
if md5(v_definition)<>'fe0b53f8a2ef1bf6a1de19ded3724a82' then raise exception 'Unexpected stub profile version; aborting'; end if;
v_definition := replace(v_definition,$old$name = nullif(trim(coalesce(v_safe_name, '')), ''),$old$,$new$name = coalesce(nullif(trim(coalesce(v_safe_name, '')), ''), ''),$new$);
v_definition := replace(v_definition,$old$      v_name,$old$,$new$      coalesce(v_name, ''),$new$);
execute v_definition;
if md5(pg_get_functiondef('public.upsert_customer_stub_profile(text,text,text,text)'::regprocedure))<>'8a9027cc8e3e3e9aabc6873b22b5bc5e' then raise exception 'Unexpected result definition; aborting'; end if;
end;
$migration$;
