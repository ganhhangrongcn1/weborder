-- Run in ONE transaction after the candidate migration, then ROLLBACK.
-- No test row, point, print job or program change may be committed.
create temporary table receipt_test_results (scenario text, passed boolean);
update receipt_private.activation set enabled=true where singleton;
do $$
declare o public.orders%rowtype; po public.partner_orders%rowtype;
  test_order_id text:='RECEIPT-ROLLBACK-'||gen_random_uuid(); partner_id uuid:=gen_random_uuid();
  url text; token_value text; view_value jsonb; n integer; before_balance integer; after_balance integer;
begin
  select * into o from public.orders where branch_uuid is not null order by created_at desc limit 1;
  if o.id is null then raise exception 'No order fixture available'; end if;
  o.id:=test_order_id; o.order_code:=test_order_id; o.customer_phone:=null; o.customer_name:='Rollback test';
  o.status:='confirmed'; o.kitchen_status:='pending'; o.created_at:=clock_timestamp(); o.updated_at:=o.created_at;
  o.metadata:=jsonb_build_object('source','pos_mobile','paymentStatus','unpaid');
  o.total_amount:=100000; o.subtotal:=100000; o.promo_discount:=0; o.points_discount:=0;
  o.points_spent:=0; o.points_earned:=0; o.expected_earn_points:=1000;
  insert into public.orders select o.*;
  if exists(select 1 from receipt_private.receipts where source_id=test_order_id) then raise exception 'Unpaid bill issued a token'; end if;
  insert into receipt_test_results values('unpaid_bill_blocked',true);

  update public.orders set metadata=metadata||jsonb_build_object('paymentStatus','paid') where id=test_order_id;
  select token into token_value from receipt_private.receipts where source_type='ORDER' and source_id=test_order_id;
  if token_value is null then raise exception 'Paid bill did not issue a token'; end if;
  view_value:=public.get_receipt_loyalty(token_value);
  if view_value->>'status'<>'available' then raise exception 'Expected available bill, got %',view_value; end if;
  if view_value ? 'customerPhone' or view_value ? 'customerName' or view_value ? 'address' then raise exception 'Private identity leaked'; end if;
  insert into receipt_test_results values('paid_before_completion_available',true);

  execute 'set local role anon';
  update public.orders set expected_earn_points=999999 where id=test_order_id;
  view_value:=public.claim_receipt_loyalty(token_value,'0999999901');
  execute 'reset role';
  if (view_value->>'points')::integer=999999 then raise exception 'Claim trusted client-writable points'; end if;
  insert into receipt_test_results values('anonymous_order_tampering_cannot_inflate_points',true);
  if view_value->>'status'<>'claimed' or view_value->>'maskedPhone'<>'•••••••901' then raise exception 'Claim failed: %',view_value; end if;
  perform public.claim_receipt_loyalty(token_value,'0999999902');
  perform receipt_private.issue('ORDER',test_order_id);
  update public.orders set status='done' where id=test_order_id;
  select count(*) into n from public.loyalty_ledger where source_type='ORDER' and source_order_id=test_order_id and action='SETTLE_EARN';
  if n<>1 then raise exception 'Duplicate award: %',n; end if;
  insert into receipt_test_results values('repeat_different_phone_reprint_completion_once',true);
  update public.orders set status='cancelled' where id=test_order_id;
  select count(*) into n from public.loyalty_ledger where source_order_id=test_order_id and action='REVERSE_EARN';
  if n<>1 then raise exception 'Missing cancellation reversal'; end if;
  if (public.get_receipt_loyalty(token_value)->>'status')<>'cancelled' then raise exception 'Cancelled receipt claimable'; end if;
  insert into receipt_test_results values('cancel_reverses_once_and_blocks_claim',true);

  -- Partner orders arrive paid by merchant contract, even while preparing.
  select * into po from public.partner_orders where branch_uuid is not null order by created_at desc limit 1;
  if po.id is null then raise exception 'No partner fixture available'; end if;
  po.id:=partner_id; po.nexpos_order_id:='RECEIPT-ROLLBACK-'||partner_id;
  po.order_code:='RECEIPT-ROLLBACK-'||partner_id; po.display_order_code:=po.order_code;
  po.customer_phone:='0999999902'; po.customer_phone_key:='0999999902';
  po.claimed_at:=null; po.claimed_customer_phone:=''; po.claimed_by_profile_id:=null; po.point_status:='pending';
  po.created_at:=clock_timestamp(); po.order_time:=po.created_at; po.updated_at:=po.created_at;
  po.order_status:='preparing'; po.kitchen_status:='pending';
  po.net_received_amount:=100000; po.total_amount:=100000;
  po.raw_data:=jsonb_build_object('finance_data',jsonb_build_object('real_received',100000));
  insert into public.partner_orders select po.*;
  select token into token_value from receipt_private.receipts where source_type='PARTNER_ORDER' and source_id=partner_id::text;
  if token_value is null then raise exception 'Partner token missing: %',(select error_message from receipt_private.failures where source_id=partner_id::text); end if;
  view_value:=public.get_receipt_loyalty(token_value);
  if view_value->>'status'<>'claimed' then raise exception 'Partner auto earn failed: % / %',view_value,(select error_message from receipt_private.failures where source_id=partner_id::text); end if;
  perform public.claim_receipt_loyalty(token_value,'0999999901');
  select count(*) into n from public.loyalty_ledger where source_type='PARTNER_ORDER' and source_order_id=partner_id::text and action='CLAIM_PARTNER_EARN';
  if n<>1 then raise exception 'Partner duplicate award'; end if;
  insert into receipt_test_results values('partner_auto_paid_phone_before_completion_once',true);

  -- Use a second bill to test no-phone capability, expiry and data reconciliation.
  partner_id:=gen_random_uuid(); po.id:=partner_id; po.nexpos_order_id:='RECEIPT-ROLLBACK-'||partner_id;
  po.order_code:=po.nexpos_order_id; po.display_order_code:=po.order_code;
  po.customer_phone:=''; po.customer_phone_key:='';
  po.net_received_amount:=null; po.raw_data:='{}'::jsonb;
  insert into public.partner_orders select po.*;
  select token into token_value from receipt_private.receipts where source_type='PARTNER_ORDER' and source_id=partner_id::text;
  view_value:=public.get_receipt_loyalty(token_value);
  if view_value->>'status'<>'waiting_data' then raise exception 'Missing reconciliation not held: %',view_value; end if;
  update public.partner_orders set net_received_amount=100000,
    raw_data=jsonb_build_object('finance_data',jsonb_build_object('real_received',100000)) where id=partner_id;
  view_value:=public.claim_receipt_loyalty(token_value,'0999999901');
  if view_value->>'status'<>'claimed' then raise exception 'No-phone partner claim failed: %',view_value; end if;
  insert into receipt_test_results values('partner_no_phone_waiting_data_then_qr_claim',true);
  update receipt_private.receipts set expires_at=now()-interval '1 second' where token=token_value;
  -- Already claimed must remain claimed, not become claimable after expiry.
  if public.get_receipt_loyalty(token_value)->>'status'<>'claimed' then raise exception 'Claim state changed after expiry'; end if;
  insert into receipt_test_results values('claimed_state_survives_expiry',true);

  partner_id:=gen_random_uuid(); po.id:=partner_id; po.nexpos_order_id:='RECEIPT-ROLLBACK-'||partner_id;
  po.order_code:=po.nexpos_order_id; po.display_order_code:=po.order_code;
  po.net_received_amount:=100000;
  po.raw_data:=jsonb_build_object('finance_data',jsonb_build_object('real_received',100000));
  insert into public.partner_orders select po.*;
  select token into token_value from receipt_private.receipts where source_type='PARTNER_ORDER' and source_id=partner_id::text;
  update receipt_private.receipts set expires_at=now()-interval '1 second' where token=token_value;
  if public.get_receipt_loyalty(token_value)->>'status'<>'expired' then raise exception 'Expired bill still available'; end if;
  begin
    perform public.claim_receipt_loyalty(token_value,'0999999901');
    raise exception 'Expired claim incorrectly succeeded';
  exception when others then
    if sqlerrm='Expired claim incorrectly succeeded' then raise; end if;
  end;
  insert into receipt_test_results values('unclaimed_expired_bill_blocked',true);
  begin
    perform public.get_receipt_loyalty(repeat('b',64));
    raise exception 'Unknown token incorrectly succeeded';
  exception when others then
    if sqlerrm='Unknown token incorrectly succeeded' then raise; end if;
  end;
  insert into receipt_test_results values('unknown_token_blocked',true);

  partner_id:=gen_random_uuid(); po.id:=partner_id; po.nexpos_order_id:='RECEIPT-ROLLBACK-'||partner_id;
  po.order_code:=po.nexpos_order_id; po.display_order_code:=po.order_code;
  execute 'set local role anon';
  insert into public.partner_orders select po.*;
  execute 'reset role';
  if exists(select 1 from receipt_private.receipts where source_id=partner_id::text) then
    raise exception 'Untrusted partner insert obtained a receipt';
  end if;
  insert into receipt_test_results values('anonymous_partner_insert_cannot_auto_award',true);
end;
$$;
select jsonb_agg(jsonb_build_object('scenario',scenario,'passed',passed)) as test_results from receipt_test_results;
