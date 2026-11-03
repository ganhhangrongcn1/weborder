-- All fixtures, orders, loyalty and claims are rolled back.
begin;
do $setup$
begin
  insert into public.pos_shifts(branch_uuid,register_key,status,opened_by_auth_user_id,opened_by_profile_id)
    select branch_uuid,'qr038-test','open',auth_user_id,id from public.profiles
    where branch_uuid is not null and auth_user_id is not null and role in ('staff','kitchen','admin') and status='active' limit 1;
  if exists(select 1 from public.profiles where phone in ('0990000088','0990000087'))
    or exists(select 1 from public.loyalty_accounts where customer_phone in ('0990000088','0990000087')) then
    raise exception 'Test phone already exists'; end if;
  insert into public.profiles(phone,name,role,status,registered) values('0990000088','QR rollback test','customer','active',true);
  insert into public.profiles(phone,name,role,status,registered) values('0990000087','QR expired points test','customer','active',true);
  insert into public.loyalty_ledger(id,customer_phone,points,entry_type,source_type,source_order_id,action,action_version,idempotency_key)
    values('QR038-ROLLBACK-CREDIT','0990000088',9000,'ADMIN_ADJUST','ADMIN','QR038-ROLLBACK','ADMIN_ADJUST',1,'test:qr038:credit');
  insert into public.loyalty_ledger(id,customer_phone,points,entry_type,source_type,source_order_id,action,action_version,idempotency_key,created_at)
    values('QR038-EXPIRED-CREDIT','0990000087',9000,'ADMIN_ADJUST','ADMIN','QR038-EXPIRED','ADMIN_ADJUST',1,'test:qr038:expired',now()-interval '61 days');
  update public.loyalty_accounts set total_points=9000 where customer_phone='0990000087';
  insert into public.loyalty_accounts(customer_phone,total_points,vouchers,metadata)
    values('0990000088',9000,'[{"id":"QR038-LOYALTY","code":"QR038LOYALTY","value":5000,"discountType":"fixed","used":false}]','{}')
    on conflict(customer_phone) do update set total_points=9000,vouchers=excluded.vouchers,metadata='{}';
  update public.loyalty_accounts set vouchers=(select jsonb_agg(jsonb_build_object('id','QR038-OLD-'||n,
    'code','QR038OLD'||n,'value',5000,'expiredAt','2000-01-01','used',false)) from generate_series(1,8) n)||vouchers
    where customer_phone='0990000088';
  insert into public.coupons(code,active,discount_type,value,data) values('QR038TEST',true,'fixed',5000,
    '{"id":"QR038-TEST","code":"QR038TEST","active":true,"voucherType":"checkout","discountType":"fixed","value":5000,"salesChannels":["pos"]}');
  insert into public.coupons(code,active,discount_type,value,data) values('QR038WEB',true,'fixed',5000,
    '{"id":"QR038-WEB","code":"QR038WEB","active":true,"voucherType":"checkout","discountType":"fixed","value":5000,"salesChannels":["web"]}');
end $setup$;
set local role service_role;
do $test$
declare actor uuid; branch uuid; shift_id uuid; provider text; body jsonb; o jsonb; items jsonb; intent jsonb; result jsonb;
  saved_body jsonb; saved_order jsonb; saved_items jsonb; saved_intent jsonb;
begin
  select id,branch_uuid into shift_id,branch from public.pos_shifts where status='open' and register_key='qr038-test' limit 1;
  select auth_user_id into actor from public.profiles where status='active' and auth_user_id is not null
    and ((role='admin' and branch_uuid is null) or (role in ('staff','kitchen','admin') and branch_uuid=branch)) limit 1;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  foreach provider in array array['sepay','pay2s'] loop
    body:=jsonb_build_object('payment_reference','POS-SERVER038-'||upper(provider),'request_key','test:server038:'||provider,
      'provider',provider,'source','pos','bank_account_snapshot',true,'branch_uuid',branch,'pos_shift_id',shift_id,
      'customer_phone','0990000088','branch_name','Test rollback','pager_number','TEST-S038-'||provider,'amount_expected',100000,
      'cart_snapshot','[{"id":"test-item","quantity":1}]'::jsonb,'checkout_snapshot','{"pointsDiscount":0}'::jsonb);
    o:=jsonb_build_object('id',body->>'payment_reference','order_code',body->>'payment_reference',
      'customer_phone','0990000088','branch_uuid',branch,'pos_shift_id',shift_id,'status','pending_payment','payment_method','bank_qr',
      'fulfillment_type','pickup','subtotal',100000,'total_amount',100000,'points_discount',0,
      'metadata',jsonb_build_object('source','pos_mobile','paymentStatus','pending_payment','pointsSpent',0,'pointsDiscountAmount',0,
        'requestKey',body->>'request_key','pagerNumber',body->>'pager_number'));
    items:=jsonb_build_array(jsonb_build_object('order_id',o->>'id','product_id','test-item','product_name','Test rollback',
      'quantity',1,'unit_price',100000,'line_total',100000));
    intent:='{"pointsRequested":50000}';
    result:=public.create_pos_bank_checkout_v2(actor,body,o,items,intent);
    if result->>'needs_confirmation'<>'true' or (result#>>'{quote,pointsSpent}')::numeric<>9000 then
      raise exception 'Must reconfirm reduced points, got %',result; end if;
    if jsonb_array_length(result#>'{quote,customer,availableVouchers}')<>1
      or result#>>'{quote,customer,availableVouchers,0,id}'<>'QR038-LOYALTY' then raise exception 'Expired wallet entries hide active voucher'; end if;
    if exists(select 1 from public.pos_payment_sessions where payment_reference=o->>'id')
      or exists(select 1 from public.orders where id=o->>'id') then raise exception 'Quote leaked a session/order'; end if;
    if auth.role()<>'service_role' then raise exception 'Actor claims leaked'; end if;
    intent:='{"pointsRequested":0}';
    result:=public.create_pos_bank_checkout_v2(actor,body,o,items,intent);
    if result->'session'->>'source'<>'qr_order' then raise exception 'Missing atomic order'; end if;
    result:=public.create_pos_bank_checkout_v2(actor,body,o,items,intent);
    if result->>'reused'<>'true' or (select count(*) from public.order_items where order_id=o->>'id')<>1 then raise exception 'Retry duplicated'; end if;
    update public.pos_payment_sessions set status='cancelled' where id=(result#>>'{session,id}')::uuid;
    update public.orders set status='cancelled',metadata=metadata||'{"paymentStatus":"cancelled"}' where id=o->>'id';
    begin
      perform public.create_pos_bank_checkout_v2(actor,body,o,items,intent);
      raise exception 'ASSERT: cancelled session reused';
    exception when others then if sqlerrm like 'ASSERT:%' then raise; end if; end;
  end loop;
  -- Fresh request using points and a checkout voucher, both recalculated server-side.
  body:=body||'{"payment_reference":"POS-SERVER038-BENEFIT","request_key":"test:server038:benefit","pager_number":"TEST-S038-BENEFIT","amount_expected":86000}';
  body:=jsonb_set(body,'{checkout_snapshot,pointsDiscount}','9000');
  o:=o||'{"id":"POS-SERVER038-BENEFIT","order_code":"POS-SERVER038-BENEFIT","total_amount":86000,"points_discount":9000,"promo_discount":5000,"promo_code":"QR038TEST"}';
  o:=jsonb_set(o,'{metadata}',o->'metadata'||'{"requestKey":"test:server038:benefit","pagerNumber":"TEST-S038-BENEFIT","pointsSpent":9000,"pointsDiscountAmount":9000,"promoSource":"checkout","promoVoucherId":"QR038-TEST"}');
  items:=jsonb_set(items,'{0,order_id}','"POS-SERVER038-BENEFIT"');
  intent:='{"pointsRequested":9000,"promoCode":"QR038TEST","promoSource":"checkout","promoVoucherId":"QR038-TEST"}';
  result:=public.create_pos_bank_checkout_v2(actor,body,o,items,intent);
  if (result#>>'{session,amount_expected}')::numeric<>86000 then raise exception 'Wrong benefit amount: %',result; end if;
  saved_body:=body; saved_order:=o; saved_items:=items; saved_intent:=intent;
  -- Wallet voucher: a pending order reserves its use through the existing evaluator.
  body:=body||'{"payment_reference":"POS-SERVER038-LOYALTY","request_key":"test:server038:loyalty","pager_number":"TEST-S038-LOYALTY","amount_expected":95000}';
  body:=jsonb_set(body,'{checkout_snapshot,pointsDiscount}','0');
  o:=o||'{"id":"POS-SERVER038-LOYALTY","order_code":"POS-SERVER038-LOYALTY","total_amount":95000,"points_discount":0,"promo_code":"QR038LOYALTY"}';
  o:=jsonb_set(o,'{metadata}',o->'metadata'||'{"requestKey":"test:server038:loyalty","pagerNumber":"TEST-S038-LOYALTY","pointsSpent":0,"pointsDiscountAmount":0,"promoSource":"loyalty","promoVoucherId":"QR038-LOYALTY"}');
  items:=jsonb_set(items,'{0,order_id}','"POS-SERVER038-LOYALTY"');
  intent:='{"pointsRequested":0,"promoCode":"QR038LOYALTY","promoSource":"loyalty","promoVoucherId":"QR038-LOYALTY"}';
  result:=public.create_pos_bank_checkout_v2(actor,body,o,items,intent);
  if (result#>>'{session,amount_expected}')::numeric<>95000 then raise exception 'Wallet voucher rejected: %',result; end if;
  body:=body||'{"payment_reference":"POS-SERVER038-REUSED","request_key":"test:server038:reused","pager_number":"TEST-S038-REUSED"}';
  o:=o||'{"id":"POS-SERVER038-REUSED","order_code":"POS-SERVER038-REUSED"}';
  o:=jsonb_set(o,'{metadata}',o->'metadata'||'{"requestKey":"test:server038:reused","pagerNumber":"TEST-S038-REUSED"}');
  items:=jsonb_set(items,'{0,order_id}','"POS-SERVER038-REUSED"');
  result:=public.create_pos_bank_checkout_v2(actor,body,o,items,intent);
  if result->>'needs_confirmation'<>'true' or result#>>'{quote,voucherValid}'<>'false' then raise exception 'Voucher reused'; end if;
  if exists(select 1 from public.pos_payment_sessions where payment_reference=o->>'id') then raise exception 'Rejected voucher persisted'; end if;
  -- A web-only voucher cannot be used at POS.
  o:=o||'{"promo_code":"QR038WEB"}';
  o:=jsonb_set(o,'{metadata}',o->'metadata'||'{"promoSource":"checkout","promoVoucherId":"QR038-WEB"}');
  intent:='{"pointsRequested":0,"promoCode":"QR038WEB","promoSource":"checkout","promoVoucherId":"QR038-WEB"}';
  result:=public.create_pos_bank_checkout_v2(actor,body,o,items,intent);
  if result#>>'{quote,reason}'<>'voucher_scope_changed' then raise exception 'Web voucher allowed: %',result; end if;
  -- Full transaction rollback when a late item validation fails after quoting.
  body:=body||'{"amount_expected":100000}';
  o:=o||'{"promo_code":"","promo_discount":0,"total_amount":100000}';
  o:=jsonb_set(o,'{metadata}',o->'metadata'||'{"promoSource":"","promoVoucherId":""}');
  begin
    perform public.create_pos_bank_checkout_v2(actor,body,o,jsonb_set(items,'{0,quantity}','0'),'{"pointsRequested":0}');
    raise exception 'ASSERT: invalid item accepted';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if; end;
  if exists(select 1 from public.pos_payment_sessions where payment_reference=o->>'id') then raise exception 'Late validation leaked session'; end if;
  if auth.role()<>'service_role' then raise exception 'Claims leaked after item failure'; end if;
  -- Expired points cannot reduce the payable amount even if a cached balance exists.
  body:=body||'{"payment_reference":"POS-SERVER038-EXPIREDPOINTS","request_key":"test:server038:expiredpoints","pager_number":"TEST-S038-EXPIREDPOINTS","customer_phone":"0990000087","amount_expected":91000}';
  body:=jsonb_set(body,'{checkout_snapshot,pointsDiscount}','9000');
  o:=o||'{"id":"POS-SERVER038-EXPIREDPOINTS","order_code":"POS-SERVER038-EXPIREDPOINTS","customer_phone":"0990000087","total_amount":91000,"points_discount":9000}';
  o:=jsonb_set(o,'{metadata}',o->'metadata'||'{"requestKey":"test:server038:expiredpoints","pagerNumber":"TEST-S038-EXPIREDPOINTS","pointsSpent":9000,"pointsDiscountAmount":9000}');
  items:=jsonb_set(items,'{0,order_id}','"POS-SERVER038-EXPIREDPOINTS"');
  result:=public.create_pos_bank_checkout_v2(actor,body,o,items,'{"pointsRequested":9000}');
  if result->>'needs_confirmation'<>'true' or (result#>>'{quote,pointsSpent}')::numeric<>0 then raise exception 'Expired points accepted'; end if;
  update public.pos_payment_sessions set expires_at=now()-interval '1 second' where payment_reference=saved_order->>'id';
  begin
    perform public.create_pos_bank_checkout_v2(actor,saved_body,saved_order,saved_items,saved_intent);
    raise exception 'ASSERT: expired QR reused';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if; end;
  if has_function_privilege('authenticated','public.create_pos_bank_checkout_v2(uuid,jsonb,jsonb,jsonb,jsonb)','execute')
    or has_function_privilege('anon','public.create_pos_bank_checkout_v2(uuid,jsonb,jsonb,jsonb,jsonb)','execute') then raise exception 'Client can call service RPC'; end if;
end $test$;
select 'server quote + points/voucher + no partial writes + SePay/Pay2S + retry/cancel + service ACL passed' as result;
rollback;
