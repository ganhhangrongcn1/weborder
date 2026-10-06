begin transaction read only;
set local statement_timeout='3s';
with cases(existing_name,incoming_name) as (values
(null::text,null::text),('',''),('','   '),('','Nguyễn An'),('Khách','Nguyễn An'),
('Nguyễn Bình',null),('Nguyễn Bình','Nguyễn An'),('Nguyễn Bình',''),('Nguyễn Bình','   ')),
normalized as(select *,nullif(trim(coalesce(incoming_name,'')),'') v_name from cases),
safe as(select *,coalesce(nullif(trim(coalesce(existing_name,'')),''),v_name) initial_safe from normalized),
chosen as(select *,case when lower(trim(coalesce(initial_safe,''))) in ('','khach','khach hang','khach vang lai','khách','khách hàng','khách vãng lai') and v_name is not null then v_name else initial_safe end v_safe_name from safe),
outputs as(select *,coalesce(v_name,'') inserted_name,coalesce(nullif(trim(coalesce(v_safe_name,'')),''),'') updated_name from chosen)
select count(*) cases,bool_and(inserted_name is not null and updated_name is not null) non_null,
bool_and(case when existing_name='Nguyễn Bình' then updated_name=existing_name else true end) preserve_real_name,
bool_and(case when v_safe_name is not null and trim(v_safe_name)<>'' then updated_name=nullif(trim(coalesce(v_safe_name,'')),'') else true end) named_outputs_unchanged from outputs;
commit;
-- Invalid phone exits before the profile read/write path; never test a real phone here.
begin transaction read only;
set local statement_timeout='3s';
select ok,created_new from public.upsert_customer_stub_profile(null,null,null,null);
commit;
-- Deployment fingerprint and unchanged access attributes.
select p.oid,md5(pg_get_functiondef(p.oid)) definition_hash,
pg_get_userbyid(p.proowner) owner,p.prosecdef,p.provolatile,p.proconfig,p.proacl::text acl
from pg_proc p where p.oid='public.upsert_customer_stub_profile(text,text,text,text)'::regprocedure;
