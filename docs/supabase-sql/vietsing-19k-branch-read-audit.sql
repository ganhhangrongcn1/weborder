-- Read-only verification using actual operational profiles and simulated request identity.
begin;
set local role anon;
do $audit$ begin
  if exists (select 1 from public.smart_promotions where data->>'id' = 'promo-flash-sale-vietsing-19k-20261009') then
    raise exception 'Anonymous clients can read branch-scoped promotion';
  end if;
  if (select count(*) from public.smart_promotions) <> 7 then
    raise exception 'Legacy promotion visibility changed for anonymous clients';
  end if;
end $audit$;
reset role;
do $identity$
declare user_id uuid;
begin
  select auth_user_id into user_id from public.profiles
    where branch_uuid = 'b108f000-02dc-4f04-8a97-996bbfc27fb8'::uuid
      and role in ('staff','kitchen') and status = 'active' and auth_user_id is not null limit 1;
  if user_id is null then raise exception 'No linked Viet Sing operational profile'; end if;
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',user_id,'role','authenticated')::text, true);
end $identity$;
set local role authenticated;
do $audit$ begin
  if not exists (select 1 from public.smart_promotions where data->>'id' = 'promo-flash-sale-vietsing-19k-20261009') then
    raise exception 'Viet Sing cannot read its promotion';
  end if;
  if (select count(*) from public.smart_promotions) <> 8 then
    raise exception 'Legacy promotion visibility changed for Viet Sing';
  end if;
end $audit$;
reset role;
do $identity$
declare user_id uuid;
begin
  select auth_user_id into user_id from public.profiles
    where branch_uuid = 'c0d35bd0-e614-4973-9eb2-17e78fb9a245'::uuid
      and role in ('staff','kitchen') and status = 'active' and auth_user_id is not null limit 1;
  if user_id is null then raise exception 'No linked other-branch operational profile'; end if;
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',user_id,'role','authenticated')::text, true);
end $identity$;
set local role authenticated;
do $audit$ begin
  if exists (select 1 from public.smart_promotions where data->>'id' = 'promo-flash-sale-vietsing-19k-20261009') then
    raise exception 'Other branch can read Viet Sing promotion';
  end if;
  if (select count(*) from public.smart_promotions) <> 7 then
    raise exception 'Legacy promotion visibility changed for other branch';
  end if;
end $audit$;
reset role;
do $identity$
declare user_id uuid;
begin
  select auth_user_id into user_id from public.profiles
    where role = 'admin' and status = 'active' and auth_user_id is not null limit 1;
  if user_id is null then raise exception 'No linked active admin'; end if;
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',user_id,'role','authenticated')::text, true);
end $identity$;
set local role authenticated;
do $audit$ begin
  if (select count(*) from public.smart_promotions) <> 8 then
    raise exception 'Admin cannot read all promotion rows';
  end if;
end $audit$;
reset role;
rollback;
select 'Passed: anon and other branch excluded; Viet Sing and admin allowed; legacy programs unchanged' as result;
