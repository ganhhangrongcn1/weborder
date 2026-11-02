begin;
do $test$
declare actor uuid; branch uuid; shift_id uuid; provider text; body jsonb; o jsonb; items jsonb; result jsonb;
begin
  select auth_user_id into actor from public.profiles where role='admin' and status='active' limit 1;
  select id,branch_uuid into shift_id,branch from public.pos_shifts where status='open' limit 1;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  foreach provider in array array['sepay','pay2s'] loop
    body:=jsonb_build_object('payment_reference','POS-ATOMIC-'||upper(provider),'request_key','test:atomic:'||provider,
      'provider',provider,'source','pos','bank_account_snapshot',true,'branch_uuid',branch,'pos_shift_id',shift_id,
      'branch_name','Test rollback','pager_number','TEST-ATOM-'||provider,'amount_expected',5000,
      'cart_snapshot','[{"id":"test-item","quantity":1}]'::jsonb,'checkout_snapshot','{}'::jsonb);
    o:=jsonb_build_object('id',body->>'payment_reference','order_code',body->>'payment_reference',
      'branch_uuid',branch,'pos_shift_id',shift_id,'status','pending_payment','payment_method','bank_qr',
      'fulfillment_type','pickup','subtotal',5000,'total_amount',5000,
      'metadata',jsonb_build_object('source','pos_mobile','paymentStatus','pending_payment',
        'requestKey',body->>'request_key','pagerNumber',body->>'pager_number'));
    items:=jsonb_build_array(jsonb_build_object('order_id',o->>'id','product_id','test-item','product_name','Test rollback',
      'quantity',1,'unit_price',5000,'line_total',5000));
    begin
      perform public.create_pos_bank_checkout(actor,body,o,jsonb_set(items,'{0,line_total}','4000'));
      raise exception 'ASSERT: bad total accepted';
    exception when others then if sqlerrm like 'ASSERT:%' then raise; end if; end;
    if exists(select 1 from public.pos_payment_sessions where payment_reference=body->>'payment_reference')
      or exists(select 1 from public.orders where id=o->>'id') then raise exception 'Partial session/order leaked'; end if;
    result:=public.create_pos_bank_checkout(actor,body,o,items);
    if result->'session'->>'source'<>'qr_order' or result->'session'->>'provider'<>provider then raise exception 'Wrong atomic result'; end if;
    if auth.role()<>'service_role' then raise exception 'Actor context leaked'; end if;
    result:=public.create_pos_bank_checkout(actor,body,o,items);
    if result->>'reused'<>'true' then raise exception 'Retry created another session'; end if;
    if (select count(*) from public.order_items where order_id=o->>'id')<>1 then raise exception 'Duplicate items'; end if;
    begin
      perform public.create_pos_bank_checkout('00000000-0000-0000-0000-000000000001',body,o,items);
      raise exception 'ASSERT: invalid actor accepted';
    exception when insufficient_privilege then null; end;
  end loop;
  if has_function_privilege('authenticated','public.create_pos_bank_checkout(uuid,jsonb,jsonb,jsonb)','execute')
    or has_function_privilege('anon','public.create_pos_bank_checkout(uuid,jsonb,jsonb,jsonb)','execute') then
    raise exception 'Client can choose bank routing'; end if;
  set constraints all immediate;
end $test$;
select 'atomic session/order/items + retry + rollback + actor isolation passed' as result;
rollback;
