-- Only use the isolated nexpos_wss_test schema in the rollback test harness.
do $$
declare owner_id uuid:=gen_random_uuid(); result jsonb; oid uuid; caught boolean:=false;
begin
  insert into nexpos_wss_test.nexpos_shadow_hubs(nexpos_hub_id,enabled) values('canary',true),('disabled',false);
  insert into nexpos_wss_test.nexpos_shadow_sync_control(control_key,mode) values('nexpos_partner_orders','dual_write');
  insert into nexpos_wss_test.nexpos_event_workers(worker_id,token_sha256,hub_ids,enabled,sync_enabled,id_sync_enabled,expires_at)
    values('worker',repeat('a',64),array['canary'],true,true,true,now()+interval '1 hour');
  if not nexpos_wss_test.nexpos_enqueue_signals('worker',jsonb_build_array(jsonb_build_object(
    'hub_id','canary','topic','saas_order_status_change','order_ids',jsonb_build_array('opaque-id-15xyz'),'received_at',now())))
    then raise exception 'enqueue failed'; end if;
  if not exists(select 1 from nexpos_wss_test.nexpos_order_event_pending where hub_id='canary' and order_id='opaque-id-15xyz' and pending and generation=1)
    then raise exception 'ID missing'; end if;
  if nexpos_wss_test.nexpos_enqueue_signals('worker','[]') then raise exception 'cooldown failed'; end if;
  update nexpos_wss_test.nexpos_event_workers set last_signal_at=null;
  begin
    perform nexpos_wss_test.nexpos_enqueue_signals('worker',jsonb_build_array(jsonb_build_object(
      'hub_id','disabled','topic','saas_order_status_change','order_ids',jsonb_build_array('x'),'received_at',now())));
  exception when others then caught:=true;
  end;
  if not caught then raise exception 'cross-HUB accepted'; end if;
  if not nexpos_wss_test.nexpos_sync_lease(owner_id,'acquire') then raise exception 'lease'; end if;
  result:=nexpos_wss_test.nexpos_commit_id_order(owner_id,
    '{"order_code":"synthetic","partner_source":"grabfood","nexpos_order_id":"opaque-id-15xyz","nexpos_hub_id":"canary","nexpos_status":"DOING","order_status":"preparing","nexpos_enrichment_hash":"a"}',
    '[{"order_code":"synthetic","partner_item_name":"synthetic","quantity":1,"unit_price":10,"line_total":10}]','[]',null,null,now(),1,'canary','opaque-id-15xyz');
  oid:=(result->'row'->>'id')::uuid;
  if not exists(select 1 from nexpos_wss_test.nexpos_order_event_receipts where partner_order_id=oid and generation=1) then raise exception 'receipt missing'; end if;
  update nexpos_wss_test.nexpos_event_workers set last_signal_at=null;
  perform nexpos_wss_test.nexpos_enqueue_signals('worker',jsonb_build_array(jsonb_build_object(
    'hub_id','canary','topic','saas_order_status_change','order_ids',jsonb_build_array('opaque-id-15xyz'),'received_at',now())));
  update nexpos_wss_test.nexpos_order_event_pending set pending=false,completed_generation=1 where hub_id='canary' and order_id='opaque-id-15xyz' and generation=1;
  if not exists(select 1 from nexpos_wss_test.nexpos_order_event_pending where pending and generation=2) then raise exception 'new generation lost'; end if;
  update nexpos_wss_test.nexpos_event_workers set id_sync_enabled=false;
  caught:=false;
  begin
    perform nexpos_wss_test.nexpos_commit_id_order(owner_id,'{"nexpos_status":"CANCEL"}','[]','[]',oid,'a',now(),2,'canary','opaque-id-15xyz');
  exception when others then caught:=true;
  end;
  if not caught then raise exception 'revoked scope accepted'; end if;
  if has_function_privilege('anon','nexpos_wss_test.nexpos_enqueue_signals(text,jsonb)','execute') then raise exception 'public enqueue'; end if;
end $$;
