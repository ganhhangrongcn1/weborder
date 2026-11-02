-- All fixtures, orders, stamps, loyalty and jobs are rolled back.
begin;
do $test$
declare
  actor uuid; other_actor uuid; branch uuid; shift_id uuid; gift text; sid uuid; sid2 uuid; result jsonb;
  o jsonb; items jsonb; gift_order jsonb; gift_items jsonb; n integer;
  test_phone text := '0990000099';
begin
  if exists(select 1 from public.profiles where profiles.phone=test_phone)
    or exists(select 1 from stamp_private.accounts a where a.phone=test_phone) then
    raise exception 'Synthetic phone already exists; choose a different fixture';
  end if;
  select auth_user_id into actor from public.profiles where role='admin' and status='active' and auth_user_id is not null limit 1;
  select id,branch_uuid into shift_id,branch from public.pos_shifts where status='open' limit 1;
  if actor is null or shift_id is null then raise exception 'Need active test operator/open shift'; end if;
  select auth_user_id into other_actor from public.profiles where role='kitchen' and status='active'
    and branch_uuid is distinct from branch and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  insert into stamp_private.accounts values(test_phone,20,0);
  select g into gift from stamp_private.program p cross join lateral unnest(p.gift_ids) g
    where p.id and stamp_private.gift_available(g,branch,'pos') limit 1;
  if gift is null then raise exception 'Need an available configured stamp gift'; end if;
  gift_order := jsonb_build_object('id','STAMP-QRCHECK-TEST','order_code','STAMP-QRCHECK-TEST',
    'customer_phone',test_phone,'customer_name','Test rollback','fulfillment_type','pickup','payment_method','cash',
    'status','pending_zalo','subtotal',0,'total_amount',0,'branch_uuid',branch,'branch_name','Test rollback',
    'pickup_branch_uuid',branch,'pickup_branch_name','Test rollback','pickup_time_text','Lấy tại quầy',
    'delivery_address','Khách nhận tại quầy','pos_shift_id',shift_id,
    'metadata',jsonb_build_object('source','pos_mobile','paymentStatus','paid','stampGiftProductId',gift));
  gift_items := jsonb_build_array(jsonb_build_object('product_id',gift,'product_name','Quà thử',
    'quantity',1,'unit_price',0,'line_total',0,'spice','','note','','toppings','[]'::jsonb,
    'option_groups','[]'::jsonb,'metadata',jsonb_build_object('stampGift',true)));
  set local role authenticated;
  result:=public.checkout_stamp_order(gift_order,gift_items);
  reset role;
  set constraints all immediate;
  if result->>'branch_address' is null then raise exception 'Missing address default'; end if;
  perform public.checkout_stamp_order(gift_order,gift_items);
  if (select balance from stamp_private.accounts a where a.phone=test_phone)<>10 then raise exception 'Stamp redemption not exactly once'; end if;
  update public.orders set status='cancelled' where id='STAMP-QRCHECK-TEST';
  if (select balance from stamp_private.accounts a where a.phone=test_phone)<>20 then raise exception 'Cancel did not return stamps'; end if;
  begin
    perform public.checkout_stamp_order(gift_order,gift_items);
    raise exception 'ASSERT: cancelled gift revived';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if; end;
  set constraints all deferred;
  foreach gift in array array['sepay','pay2s'] loop
    sid:=gen_random_uuid();
    o:=jsonb_build_object('id','POS-QRCHECK-'||gift,'order_code','POS-QRCHECK-'||gift,
      'customer_phone',test_phone,'customer_name','Test rollback','fulfillment_type','pickup','payment_method','bank_qr',
      'status','pending_payment','subtotal',25000,'total_amount',25000,'branch_uuid',branch,
      'branch_name','Test rollback','pos_shift_id',shift_id,'metadata',jsonb_build_object(
        'source','pos_mobile','paymentStatus','pending_payment','requestKey','test-checkout-'||gift,'pagerNumber',''));
    items:=jsonb_build_array(jsonb_build_object('order_id',o->>'id','product_id','test-product','product_name','Món thử',
      'quantity',1,'unit_price',25000,'line_total',25000));
    insert into public.pos_payment_sessions(id,payment_reference,request_key,provider,source,status,branch_uuid,
      branch_name,pos_shift_id,customer_phone,amount_expected,cart_snapshot,checkout_snapshot,expires_at)
    values(sid,o->>'id','test-checkout-'||gift,gift,'pos','pending_payment',branch,'Test rollback',shift_id,test_phone,25000,'[]','{}',now()+interval '10 min');
    begin
      perform public.save_pos_qr_checkout(sid,jsonb_set(o,'{total_amount}','24000'),items);
      raise exception 'ASSERT: wrong amount accepted';
    exception when others then if sqlerrm like 'ASSERT:%' then raise; end if; end;
    begin
      perform public.save_pos_qr_checkout(sid,o,jsonb_set(items,'{0,line_total}','24000'));
      raise exception 'ASSERT: wrong item sum accepted';
    exception when others then if sqlerrm like 'ASSERT:%' then raise; end if; end;
    if exists(select 1 from public.orders where id=o->>'id') then raise exception 'Partial order leaked'; end if;
    set local role authenticated;
    result:=public.save_pos_qr_checkout(sid,o,items);
    reset role;
    if result->>'source'<>'qr_order' or result->>'order_id'<>o->>'id' then raise exception 'Attach missing'; end if;
    if (select metadata->>'paymentStatus' from public.orders where id=o->>'id')<>'pending_payment' then raise exception 'Unpaid order was settled'; end if;
    perform public.save_pos_qr_checkout(sid,o,items);
    select count(*) into n from public.order_items where order_id=o->>'id';
    if n<>1 then raise exception 'Retry duplicated items'; end if;
    update public.pos_payment_sessions set expires_at=now()-interval '1 min' where id=sid;
    begin
      perform public.save_pos_qr_checkout(sid,o,items);
      raise exception 'ASSERT: expired QR reused';
    exception when others then if sqlerrm like 'ASSERT:%' then raise; end if; end;
    update public.pos_payment_sessions set expires_at=now()+interval '10 min' where id=sid;
    if other_actor is not null then
      perform set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'role','authenticated')::text,true);
      begin
        perform public.save_pos_qr_checkout(sid,o,items);
        raise exception 'ASSERT: cross-branch operator accepted';
      exception when insufficient_privilege then null; end;
      perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    end if;
    begin
      perform public.save_pos_qr_checkout(sid,o,jsonb_set(items,'{0,product_name}','"changed"'));
      raise exception 'ASSERT: changed retry accepted';
    exception when others then if sqlerrm like 'ASSERT:%' then raise; end if; end;
    perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
    begin
      perform public.save_pos_qr_checkout(sid,o,items);
      raise exception 'ASSERT: non-operator accepted';
    exception when insufficient_privilege then null; end;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  end loop;
  -- Simulate two sessions competing for the same pager. The second may not
  -- create an order while the first still owns the pager.
  update public.orders set metadata=metadata||'{"pagerNumber":"TEST-QR-PAGER"}'::jsonb where id=o->>'id';
  o:=jsonb_set(jsonb_set(o,'{id}','"POS-QRCHECK-DUP"'),'{order_code}','"POS-QRCHECK-DUP"');
  o:=jsonb_set(o,'{metadata,pagerNumber}','"TEST-QR-PAGER"');
  o:=jsonb_set(o,'{metadata,requestKey}','"test-checkout-duplicate"');
  items:=jsonb_set(items,'{0,order_id}','"POS-QRCHECK-DUP"');
  sid2:=gen_random_uuid();
  insert into public.pos_payment_sessions(id,payment_reference,request_key,provider,source,status,branch_uuid,
    branch_name,pos_shift_id,customer_phone,pager_number,amount_expected,cart_snapshot,checkout_snapshot,expires_at)
  values(sid2,o->>'id','test-checkout-duplicate','sepay','pos','pending_payment',branch,'Test rollback',shift_id,test_phone,
    'TEST-QR-PAGER',25000,'[]','{}',now()+interval '10 min');
  begin
    perform public.save_pos_qr_checkout(sid2,o,items);
    raise exception 'ASSERT: competing pager accepted';
  exception when others then if sqlerrm like 'ASSERT:%' then raise; end if; end;
  if has_function_privilege('anon','public.save_pos_qr_checkout(uuid,jsonb,jsonb)','execute')
    or has_table_privilege('authenticated','public.pos_payment_sessions','update') then
    raise exception 'Permissions widened';
  end if;
  set constraints all immediate;
end $test$;
select 'stamp null/default + redemption retry/cancel + SePay/Pay2S atomic order/items/attach + invalid inputs + privileges passed' as result;
rollback;
