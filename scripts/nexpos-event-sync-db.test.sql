-- Run ONLY against the isolated schema created by the test harness, never public.
do $$
declare owner_a uuid:=gen_random_uuid(); owner_b uuid:=gen_random_uuid();
  result jsonb; oid uuid; caught boolean:=false;
begin
  insert into nexpos_wss_test.nexpos_shadow_hubs(nexpos_hub_id,enabled) values('test-hub',true);
  insert into nexpos_wss_test.nexpos_shadow_sync_control(control_key,mode) values('nexpos_partner_orders','dual_write');
  if not nexpos_wss_test.nexpos_sync_lease(owner_a,'acquire') then raise exception 'acquire failed'; end if;
  if nexpos_wss_test.nexpos_sync_lease(owner_b,'acquire') then raise exception 'parallel owner'; end if;
  if nexpos_wss_test.nexpos_sync_lease(owner_b,'release') then raise exception 'foreign release'; end if;
  if not nexpos_wss_test.nexpos_sync_lease(owner_a,'renew') then raise exception 'renew failed'; end if;
  begin
    perform nexpos_wss_test.nexpos_commit_order(owner_a,
      '{"order_code":"fake","partner_source":"grabfood","nexpos_order_id":"fake-atomic","nexpos_hub_id":"test-hub","nexpos_status":"DOING","order_status":"preparing","nexpos_enrichment_hash":"hash-a"}',
      '[{"order_code":"fake"}]','[]',null,null,clock_timestamp(),null);
  exception when not_null_violation then caught:=true;
  end;
  if not caught or exists(select 1 from nexpos_wss_test.partner_orders) then raise exception 'atomic rollback failed'; end if;
  result:=nexpos_wss_test.nexpos_commit_order(owner_a,
    '{"order_code":"fake","partner_source":"grabfood","nexpos_order_id":"fake-atomic","nexpos_hub_id":"test-hub","nexpos_status":"DOING","order_status":"preparing","nexpos_enrichment_hash":"hash-a"}',
    '[{"order_code":"fake","partner_item_name":"synthetic","quantity":2,"unit_price":10000,"line_total":20000}]','[]',null,null,clock_timestamp(),null);
  oid:=(result->'row'->>'id')::uuid;
  if not (result->>'created')::boolean or (select count(*) from nexpos_wss_test.partner_order_items where partner_order_id=oid)<>1 then raise exception 'create failed'; end if;
  result:=nexpos_wss_test.nexpos_commit_order(owner_a,
    '{"nexpos_status":"CANCEL","order_status":"cancelled","nexpos_enrichment_hash":"hash-b"}',
    '[]','[]',oid,'hash-a',clock_timestamp(),null);
  if result->'row'->>'nexpos_status'<>'CANCEL' then raise exception 'cancel failed'; end if;
  result:=nexpos_wss_test.nexpos_commit_order(owner_a,
    '{"nexpos_status":"DOING","nexpos_enrichment_hash":"old"}',
    '[]','[]',oid,'hash-a',clock_timestamp(),null);
  if not (result->>'stale')::boolean or result->'row'->>'nexpos_status'<>'CANCEL' then raise exception 'stale overwrite'; end if;
  insert into nexpos_wss_test.nexpos_event_workers(worker_id,token_sha256,hub_ids,enabled,sync_enabled,expires_at)
    values('test-worker',repeat('a',64),array['test-hub'],true,true,now()+interval '1 hour');
  update nexpos_wss_test.nexpos_event_workers set last_report='{"events":{"test-hub":{"saas_notifications":1}}}' where worker_id='test-worker';
  update nexpos_wss_test.nexpos_event_workers set last_report='{"events":{"test-hub":{"saas_notifications":1}}}' where worker_id='test-worker';
  if (select generation from nexpos_wss_test.nexpos_event_pending where hub_id='test-hub')<>1 then raise exception 'duplicate invalidation'; end if;
  update nexpos_wss_test.nexpos_event_pending set completed_generation=1 where hub_id='test-hub';
  update nexpos_wss_test.nexpos_event_workers set last_report='{"events":{"test-hub":{"saas_notifications":2}}}' where worker_id='test-worker';
  if not exists(select 1 from nexpos_wss_test.nexpos_event_pending where generation=2 and completed_generation=1) then raise exception 'lost generation'; end if;
  update nexpos_wss_test.nexpos_shadow_sync_control set locked_until=now()-interval '1 second';
  if nexpos_wss_test.nexpos_sync_lease(owner_a,'renew') then raise exception 'expired owner revived'; end if;
  if not nexpos_wss_test.nexpos_sync_lease(owner_b,'acquire') then raise exception 'takeover failed'; end if;
  if nexpos_wss_test.nexpos_sync_lease(owner_a,'release') then raise exception 'old owner release'; end if;
  if has_function_privilege('authenticated','nexpos_wss_test.nexpos_commit_order(uuid,jsonb,jsonb,jsonb,uuid,text,timestamptz,bigint)','execute')
    then raise exception 'public commit privilege'; end if;
end $$;
