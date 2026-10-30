do $$
declare oid uuid:=gen_random_uuid(); oid2 uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
  worker uuid:=gen_random_uuid(); payload jsonb; r jsonb; job uuid; task jsonb;
begin
  insert into partner_bill_test.partner_auto_bill_scopes(hub_id,branch_uuid,enabled,activated_at)
    values('test-hub',b,true,now()-interval '1 minute');
  insert into partner_bill_test.partner_orders(id,order_code,partner_source,nexpos_order_id,nexpos_hub_id,
    branch_uuid,nexpos_status,nexpos_enrichment_hash,raw_data)
    values(oid,'SYNTHETIC','grabfood','source-test','test-hub',b,'DOING','hash','{"dishes":[{}]}');
  insert into partner_bill_test.partner_order_items(partner_order_id,order_code,partner_item_name)
    values(oid,'SYNTHETIC','Synthetic item');
  task:=partner_bill_test.partner_auto_bill_claim(worker);
  if jsonb_array_length(task)<>1 then raise exception 'test_claim'; end if;
  payload:=jsonb_build_object('type','customer_bill','text','Synthetic only',
    'order',jsonb_build_object('id',oid,'items',jsonb_build_array(jsonb_build_object('name','Synthetic'))));
  r:=partner_bill_test.partner_auto_bill_commit(worker,oid,'hash',payload);
  if not (r->>'enqueued')::boolean then raise exception 'test_commit'; end if;
  job:=(r->>'job_id')::uuid;
  update partner_bill_test.print_jobs set status='printed' where id=job;
  begin
    insert into partner_bill_test.print_jobs(branch_uuid,printer_key,job_type,status,order_id,source_type,requested_by)
      values(b::text,'cashier-80mm','customer_bill','pending',oid::text,'partner','auto-kitchen:synthetic');
    raise exception 'test_duplicate_not_blocked';
  exception when unique_violation then null; end;
  insert into partner_bill_test.print_jobs(branch_uuid,printer_key,job_type,status,order_id,source_type,requested_by)
    values(b::text,'cashier-80mm','customer_bill','pending',oid::text,'partner','manual-test');
  if (select count(*) from partner_bill_test.print_jobs where order_id=oid::text)<>2 then raise exception 'test_manual'; end if;
  insert into partner_bill_test.partner_orders(id,order_code,nexpos_order_id,nexpos_hub_id,branch_uuid,nexpos_status)
    values(oid2,'PRE','pre-source','test-hub',b,'PRE_ORDER');
  if exists(select 1 from partner_bill_test.partner_auto_bill_intents where order_id=oid2) then raise exception 'test_preorder'; end if;
  update partner_bill_test.partner_orders set nexpos_status='DOING' where id=oid2;
  if not exists(select 1 from partner_bill_test.partner_auto_bill_intents where order_id=oid2) then raise exception 'test_transition'; end if;
  update partner_bill_test.partner_orders set nexpos_status='CANCEL' where id=oid2;
  perform partner_bill_test.partner_auto_bill_claim(worker);
  if (select status from partner_bill_test.partner_auto_bill_intents where order_id=oid2)<>'skipped' then raise exception 'test_cancel'; end if;
  if has_function_privilege('anon','partner_bill_test.partner_auto_bill_claim(uuid)','execute') then raise exception 'test_anon'; end if;
  -- A new source snapshot must not be committed using an old rendered bill.
  update partner_bill_test.partner_auto_bill_intents set status='pending',owner=null where order_id=oid;
  perform partner_bill_test.partner_auto_bill_claim(worker);
  update partner_bill_test.partner_orders set nexpos_enrichment_hash='new-hash' where id=oid;
  begin
    perform partner_bill_test.partner_auto_bill_commit(worker,oid,'hash',payload);
    raise exception 'test_stale_not_rejected';
  exception when others then
    if sqlerrm<>'auto_bill_snapshot_changed' then raise; end if;
  end;
  -- Revoking the scope between claim and commit cannot emit a bill.
  update partner_bill_test.partner_auto_bill_scopes set enabled=false;
  r:=partner_bill_test.partner_auto_bill_commit(worker,oid,'new-hash',payload);
  if (r->>'enqueued')::boolean then raise exception 'test_revoked'; end if;
  -- Rollback still protects an already printed automatic job from old clients.
  begin
    insert into partner_bill_test.print_jobs(branch_uuid,printer_key,job_type,status,order_id,source_type,requested_by)
      values(b::text,'cashier-80mm','customer_bill','pending',oid::text,'partner','auto-kitchen:synthetic');
    raise exception 'test_rollback_duplicate';
  exception when unique_violation then null; end;
end $$;
