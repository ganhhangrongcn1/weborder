-- Do not run until the user confirms ALL Viet Sing POS devices installed 0.4.23+.
-- Caller must first SET LOCAL ghr.confirm_vietsing_pos_0423 = 'installed' in this transaction.
begin;
do $activate$
declare
  target_id text := 'promo-flash-sale-vietsing-19k-20261009';
  promo jsonb;
  config jsonb;
begin
  if current_setting('ghr.confirm_vietsing_pos_0423', true) is distinct from 'installed' then
    raise exception 'Confirm Viet Sing POS installation before activation';
  end if;
  perform pg_advisory_xact_lock(hashtext('ghr-vietsing-19k-20261009'));
  select value into config from public.app_configs where id='ghr_smart_promotions' for update;
  select data into strict promo from public.smart_promotions where data->>'id'=target_id for update;
  if jsonb_typeof(config) is distinct from 'array' or not config @> jsonb_build_array(promo) then raise exception 'Promotion layers do not match'; end if;
  if promo->'salesChannels' is distinct from '["pos"]'::jsonb
    or promo #> '{condition,branchIds}' is distinct from '["b108f000-02dc-4f04-8a97-996bbfc27fb8"]'::jsonb
    or promo #>> '{condition,applyScope}' is distinct from 'all'
    or promo #>> '{condition,exactFixedPrice}' is distinct from 'true'
    or promo #>> '{reward,type}' is distinct from 'fixed_price'
    or promo #>> '{reward,value}' is distinct from '19000'
    or promo->>'startAt' is distinct from '2026-10-09'
    or promo->>'endAt' is distinct from '2026-10-11'
  then raise exception 'Program differs from approved scope'; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='smart_promotions'
    and policyname='smart_promotions_branch_scope_authenticated' and permissive='RESTRICTIVE')
    or not exists (select 1 from pg_policies where schemaname='public' and tablename='smart_promotions'
    and policyname='smart_promotions_branch_scope_anon' and permissive='RESTRICTIVE')
  then raise exception 'Missing branch read protection'; end if;
  update public.smart_promotions set data=jsonb_set(data,'{active}','true'::jsonb),updated_at=now()
    where data->>'id'=target_id;
  update public.app_configs set value=(
    select jsonb_agg(case when p->>'id'=target_id then jsonb_set(p,'{active}','true'::jsonb) else p end order by n)
    from jsonb_array_elements(value) with ordinality as x(p,n)
  ),updated_at=now() where id='ghr_smart_promotions';
end $activate$;
commit;
