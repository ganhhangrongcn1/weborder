-- Run the canary stage first. No order writes or schedule changes in this file.
insert into public.app_configs(id,value)
values ('ghr_nexpos_preorder_window',jsonb_build_object(
  'enabled',true,'hubIds',jsonb_build_array('69e18c814673b293b04be1ab'),
  'lookbackDays',7,'lookaheadDays',7))
on conflict(id) do update set value=excluded.value;

-- After live canary acceptance, run this statement separately, never together
-- with initial enrollment. Restrict to the four currently enabled HUBs.
-- update public.app_configs
-- set value=jsonb_build_object('enabled',true,
--   'hubIds',(select jsonb_agg(nexpos_hub_id order by nexpos_hub_id)
--             from public.nexpos_shadow_hubs where enabled),
--   'lookbackDays',7,'lookaheadDays',7)
-- where id='ghr_nexpos_preorder_window'
--   and (select count(*) from public.nexpos_shadow_hubs where enabled)=4;

-- Rollback: set this config's enabled property to false. Polling keeps running.
