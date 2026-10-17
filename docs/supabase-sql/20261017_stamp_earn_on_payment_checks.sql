-- Standalone post-deployment check. All test writes are rolled back.
-- Only a temporary order table fires the stamp trigger. No real orders,
-- payments, kitchen feeds or print jobs are created.
begin;
create temporary table stamp_payment_test_orders (like public.orders including defaults);
alter table stamp_payment_test_orders alter column order_code set default 'STAMP-PAYMENT-CHECK';
create trigger stamp_payment_test before insert or update on stamp_payment_test_orders
  for each row execute function stamp_private.order_before_write();

do $$
declare
  phone_key text;
  order_key text := 'STAMP-PAYMENT-CHECK-' || gen_random_uuid()::text;
  actual integer;
  receipt jsonb;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',
    (select auth_user_id from public.profiles where role='admin' and coalesce(status,'active')='active'
      and auth_user_id is not null limit 1))::text,true);
  if auth.uid() is null then raise exception 'An active admin is required for receipt authorization checks'; end if;
  loop
    phone_key := '090' || lpad(floor(random()*10000000)::integer::text,7,'0');
    exit when not exists(select 1 from stamp_private.accounts where phone=phone_key)
      and not exists(select 1 from public.profiles where phone=phone_key)
      and not exists(select 1 from public.orders where customer_phone=phone_key);
  end loop;
  update stamp_private.program set enabled=true, starts_at=now()-interval '1 day' where id;
  insert into stamp_payment_test_orders(id,customer_phone,status,total_amount,subtotal,created_at,metadata)
    values(order_key,phone_key,'preparing',51000,51000,now(),'{"source":"online","paymentStatus":"pending"}');
  select coalesce((select balance from stamp_private.accounts where phone=phone_key),0) into actual;
  if actual<>0 then raise exception 'Unpaid preparing order earned a stamp'; end if;

  update stamp_payment_test_orders set metadata=metadata||'{"paymentStatus":"paid","paymentMethod":"cash"}' where id=order_key;
  receipt := public.get_stamp_summary(phone_key);
  if (receipt->>'available')::integer<>1 then raise exception 'Paid website receipt must include the current stamp: %',receipt; end if;
  update stamp_payment_test_orders set status='done',kitchen_status='done' where id=order_key;
  update stamp_payment_test_orders set status='done' where id=order_key;
  select balance into actual from stamp_private.accounts where phone=phone_key;
  if actual<>1 then raise exception 'Kitchen completion/retry duplicated a stamp'; end if;
  if (select count(*) from stamp_private.events where phone=phone_key and kind='earn')<>1 then
    raise exception 'Expected exactly one earn event';
  end if;
  update stamp_payment_test_orders set status='refunded' where id=order_key;
  select balance into actual from stamp_private.accounts where phone=phone_key;
  if actual<>0 then raise exception 'Refund did not reverse stamp'; end if;

  -- Two paid channels on the same business day still count only once.
  insert into stamp_payment_test_orders(id,customer_phone,status,total_amount,subtotal,created_at,metadata)
    values(order_key||'-qr',phone_key,'preparing',51000,51000,now(),'{"source":"online","paymentStatus":"paid","paymentMethod":"bank_qr"}'),
          (order_key||'-pos',phone_key,'preparing',51000,51000,now(),'{"source":"pos_mobile","paymentStatus":"paid"}'),
          (order_key||'-momo',phone_key,'preparing',51000,51000,now(),'{"source":"online","paymentStatus":"paid","paymentMethod":"momo"}');
  select balance into actual from stamp_private.accounts where phone=phone_key;
  if actual<>1 then raise exception 'Same-day paid channels exceeded one stamp'; end if;
  update stamp_payment_test_orders set status='cancelled' where id in (order_key||'-qr',order_key||'-momo');
  select balance into actual from stamp_private.accounts where phone=phone_key;
  if actual<>1 then raise exception 'Cancelling one channel revoked another valid daily stamp'; end if;
  update stamp_payment_test_orders set status='cancelled' where id=order_key||'-pos';
  select balance into actual from stamp_private.accounts where phone=phone_key;
  if actual<>0 then raise exception 'Last cancellation did not reverse daily stamp'; end if;
  insert into stamp_payment_test_orders(id,customer_phone,status,total_amount,subtotal,created_at,metadata)
    values(order_key||'-zero',phone_key,'preparing',0,0,now(),'{"source":"online","paymentStatus":"paid"}');
  select balance into actual from stamp_private.accounts where phone=phone_key;
  if actual<>0 then raise exception 'Zero-price order earned a stamp'; end if;

  -- The same trigger must continue to reject customer self-awarding.
  perform set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000099"}',true);
  insert into stamp_payment_test_orders(id,customer_phone,status,total_amount,subtotal,created_at,metadata)
    values(order_key||'-forged',phone_key,'preparing',51000,51000,now(),'{"source":"online","paymentStatus":"paid"}');
  select balance into actual from stamp_private.accounts where phone=phone_key;
  if actual<>0 then raise exception 'Untrusted customer awarded themselves a stamp'; end if;
  perform set_config('request.jwt.claims','',true);
end $$;
select 'stamp payment, receipt summary, kitchen retry, daily cap, reversal and authorization checks passed' as result;
rollback;
