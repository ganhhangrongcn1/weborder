-- Synthetic sessions only. Roll back every test row; no orders/prints are created.
begin;
do $$
declare
  sid uuid := gen_random_uuid();
  tx jsonb;
  result jsonb;
  session_status text;
  ref text := 'PAY2STEST' || replace(sid::text, '-', '');
begin
  insert into public.pos_payment_sessions(id, payment_reference, provider, source, status,
    amount_expected, cart_snapshot, checkout_snapshot, provider_payload, expires_at)
  values (sid, ref, 'pay2s', 'pos', 'pending_payment', 25000, '[]', '{}',
    '{"bankTransfer":{"accountNumber":"00123456789","bankBin":"970416"}}', now()+interval '10 minutes');
  tx := jsonb_build_object('id', 'test-'||sid, 'accountNumber', '00123456789', 'bankBin', '970416',
    'amount', 25000, 'direction', 'IN', 'transactionDate', now(), 'references', jsonb_build_array(upper(ref)), 'raw', '{}');

  result := public.receive_pay2s_transaction(tx || '{"amount":24000,"id":"test-mismatch"}');
  assert result->>'reason' = 'amount_mismatch', result::text;
  result := public.receive_pay2s_transaction(tx || '{"accountNumber":"different","id":"test-account"}');
  assert result->>'reason' = 'account_mismatch', result::text;
  result := public.receive_pay2s_transaction(tx || '{"bankBin":"970422","id":"test-bank"}');
  assert result->>'reason' = 'account_mismatch', result::text;
  result := public.receive_pay2s_transaction(tx || '{"direction":"OUT","id":"test-out"}');
  assert result->>'reason' = 'ignored_outgoing', result::text;
  result := public.receive_pay2s_transaction(tx || '{"references":["UNKNOWN"],"id":"test-unknown"}');
  assert result->>'reason' = 'no_pay2s_session', result::text;

  update public.pos_payment_sessions set expires_at=now()-interval '1 minute' where id=sid;
  result := public.receive_pay2s_transaction(tx || '{"id":"test-expired"}');
  assert result->>'reason' = 'late_payment_manual_review', result::text;
  update public.pos_payment_sessions set expires_at=now()+interval '10 minutes', status='cancelled' where id=sid;
  result := public.receive_pay2s_transaction(tx || '{"id":"test-cancelled"}');
  assert result->>'reason' = 'late_payment_manual_review', result::text;
  update public.pos_payment_sessions set status='pending_payment', provider='sepay' where id=sid;
  result := public.receive_pay2s_transaction(tx || '{"id":"test-sepay"}');
  assert result->>'reason' = 'no_pay2s_session', result::text;
  select status into session_status from public.pos_payment_sessions where id=sid;
  assert session_status='pending_payment', 'Negative checks must leave session unpaid';

  update public.pos_payment_sessions set provider='pay2s' where id=sid;
  result := public.receive_pay2s_transaction(tx);
  assert result->>'reason'='settled', result::text;
  select status into session_status from public.pos_payment_sessions where id=sid;
  assert session_status='paid', 'Positive check must settle session';
  result := public.receive_pay2s_transaction(tx);
  assert result->>'reason'='settled', 'Retry must resume effects without settling another session';
  result := public.receive_pay2s_transaction(tx || '{"amount":25001}');
  assert result->>'reason'='transaction_conflict', result::text;
  result := public.receive_pay2s_transaction(tx || '{"id":"test-second-payment"}');
  assert result->>'reason'='already_paid_other_transaction', result::text;
  update public.pay2s_webhook_receipts set completed_at=now(), result='processed' where transaction_id=tx->>'id';
  result := public.receive_pay2s_transaction(tx);
  assert result->>'complete'='true' and result->>'reason'='processed', result::text;

  assert not has_function_privilege('anon', 'public.receive_pay2s_transaction(jsonb)', 'execute');
  assert not has_function_privilege('authenticated', 'public.receive_pay2s_transaction(jsonb)', 'execute');
  assert not has_table_privilege('anon', 'public.pay2s_webhook_receipts', 'select');
  raise notice 'Pay2S SQL regression checks passed';
end;
$$;
do $$
declare
  sid uuid := gen_random_uuid();
  oid text := 'PAY2S-WEBSITE-TEST-' || sid;
  bid uuid;
  tx jsonb;
  result jsonb;
  payment_status text;
begin
  select branch_uuid into bid from branches where branch_uuid is not null limit 1;
  insert into orders(id,order_code,branch_uuid,pickup_branch_uuid,fulfillment_type,payment_method,status,total_amount,metadata)
  values(oid,oid,bid,bid,'pickup','bank_qr','pending_payment',25000,
    '{"source":"online","paymentStatus":"unpaid"}');
  insert into pos_payment_sessions(id,payment_reference,provider,source,status,amount_expected,order_id,
    branch_uuid,cart_snapshot,checkout_snapshot,provider_payload,expires_at)
  values(sid,oid,'pay2s','qr_order','pending_payment',25000,oid,bid,'[]','{}',
    '{"bankTransfer":{"accountNumber":"00123456789","bankBin":"970416"}}',now()+interval '10 minutes');
  tx:=jsonb_build_object('id','web-'||sid,'accountNumber','00123456789','bankBin','970416',
    'amount',25000,'direction','IN','transactionDate',now(),
    'references',jsonb_build_array(regexp_replace(upper(oid),'[^A-Z0-9]','','g')),'raw','{}'::jsonb);
  update orders set status='cancelled' where id=oid;
  result:=receive_pay2s_transaction(tx || jsonb_build_object('id','web-cancel-'||sid));
  assert result->>'reason'='late_payment_manual_review',result::text;
  update orders set status='pending_payment' where id=oid;
  result:=receive_pay2s_transaction(tx);
  assert result->>'reason'='settled' and result->>'syncOrder'='true',result::text;
  select metadata->>'paymentStatus' into payment_status from orders where id=oid and status='preparing';
  assert payment_status='paid','Website order must settle in same transaction';
  assert exists(select 1 from orders where id=oid and metadata->>'paymentProvider'='pay2s'
    and metadata#>>'{pay2sWebhook,providerTransactionId}'=tx->>'id');
  raise notice 'Website atomic settlement and cancellation checks passed';
end;
$$;
rollback;
select 'Pay2S SQL regression checks passed; all fixtures rolled back' as result;
