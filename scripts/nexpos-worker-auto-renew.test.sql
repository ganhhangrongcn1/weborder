-- Run in a rollback-only clone with the migration rewritten to this schema.
do $$
declare initial_expiry timestamptz; renewed_expiry timestamptz; scenario text;
begin
  insert into nexpos_renew_test.nexpos_event_workers
    (worker_id,token_sha256,hub_ids,enabled,sync_enabled,id_sync_enabled,
     expires_at,auto_renew_enabled,last_seen_at,last_report)
  values('synthetic',repeat('a',64),array['synthetic-hub'],true,true,true,
    clock_timestamp()+interval '3 days',true,clock_timestamp()-interval '1 minute','{"connected":true}');
  select expires_at into initial_expiry from nexpos_renew_test.nexpos_event_workers;
  update nexpos_renew_test.nexpos_event_workers set last_seen_at=clock_timestamp();
  select expires_at into renewed_expiry from nexpos_renew_test.nexpos_event_workers;
  if renewed_expiry <= initial_expiry or renewed_expiry < clock_timestamp()+interval '6 days 23 hours'
    or not exists(select 1 from nexpos_renew_test.nexpos_event_workers where auto_renewed_at is not null)
    then raise exception 'healthy report did not renew'; end if;
  update nexpos_renew_test.nexpos_event_workers set last_seen_at=clock_timestamp();
  if (select expires_at from nexpos_renew_test.nexpos_event_workers) <> renewed_expiry
    then raise exception 'renewed on every heartbeat'; end if;

  foreach scenario in array array['expired','disabled','optout','sync_off','id_off','disconnected','stale','token_change','hub_change','manual_expiry'] loop
    update nexpos_renew_test.nexpos_event_workers set
      enabled=true,sync_enabled=true,id_sync_enabled=true,auto_renew_enabled=true,
      token_sha256=repeat('a',64),hub_ids=array['synthetic-hub'],
      expires_at=clock_timestamp()+interval '3 days',last_report='{"connected":true}',auto_renewed_at=null;
    -- Prepare the scenario without firing the last_seen_at trigger.
    update nexpos_renew_test.nexpos_event_workers set
      enabled=(scenario<>'disabled'),auto_renew_enabled=(scenario<>'optout'),
      sync_enabled=(scenario<>'sync_off'),id_sync_enabled=(scenario<>'id_off'),
      expires_at=case when scenario='expired' then clock_timestamp()-interval '1 second' else expires_at end,
      last_report=case when scenario='disconnected' then '{"connected":false}'::jsonb else last_report end;
    select expires_at into initial_expiry from nexpos_renew_test.nexpos_event_workers;
    update nexpos_renew_test.nexpos_event_workers set
      last_seen_at=case when scenario='stale' then last_seen_at else clock_timestamp() end,
      token_sha256=case when scenario='token_change' then repeat('b',64) else token_sha256 end,
      hub_ids=case when scenario='hub_change' then array['other'] else hub_ids end,
      expires_at=case when scenario='manual_expiry' then initial_expiry-interval '1 hour' else expires_at end;
    if exists(select 1 from nexpos_renew_test.nexpos_event_workers where auto_renewed_at is not null)
      then raise exception 'unsafe renewal: %',scenario; end if;
  end loop;
end $$;
