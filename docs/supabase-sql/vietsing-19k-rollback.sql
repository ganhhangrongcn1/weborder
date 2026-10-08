-- Roll back only this draft/program. Do not restore the whole promotion snapshot.
begin;
do $rollback$
declare target_id text := 'promo-flash-sale-vietsing-19k-20261009';
begin
  perform pg_advisory_xact_lock(hashtext('ghr-vietsing-19k-20261009'));
  perform 1 from public.app_configs where id='ghr_smart_promotions' for update;
  delete from public.smart_promotions where data->>'id'=target_id;
  update public.app_configs
    set value=(select coalesce(jsonb_agg(p order by n),'[]'::jsonb)
      from jsonb_array_elements(value) with ordinality as x(p,n)
      where p->>'id'<>target_id), updated_at=now()
    where id='ghr_smart_promotions';
end $rollback$;
commit;
-- Keep the branch-read policies so any other branch-scoped program remains protected.
