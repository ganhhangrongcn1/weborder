-- Run together with the migration inside BEGIN/ROLLBACK for pre-deploy verification.
-- Uses a temporary copy of a known paid website order; never commits or prints it.
do $$
declare sample public.orders; test_id text := '__receipt_regression_'||gen_random_uuid()::text;
  job public.print_jobs; count_jobs int; before_balance int; after_balance int;
begin
  select * into sample from public.orders where id='GHR261020184613234';
  if not found then raise exception 'Verification sample order not found'; end if;
  select balance into before_balance from stamp_private.accounts where phone=stamp_private.phone(sample.customer_phone);
  insert into public.orders(id,order_code,branch_uuid,pickup_branch_uuid,customer_phone,customer_name,
    subtotal,total_amount,payment_method,status,kitchen_status,fulfillment_type,metadata)
    values(test_id,test_id,sample.branch_uuid,sample.pickup_branch_uuid,sample.customer_phone,'Receipt regression',
    28000,28000,'bank_qr','preparing','pending','pickup','{"source":"online","paymentStatus":"pending"}');
  insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,line_total,note,toppings,option_groups)
    select test_id,product_id,product_name,quantity,unit_price,line_total,note,toppings,option_groups
    from public.order_items where order_id=sample.id;
  insert into public.print_jobs(branch_uuid,order_id,order_code,source_type,job_type,payload)
    values(sample.branch_uuid::text,test_id,test_id,'website','customer_bill',
    '{"text":"@@CENTER:PHIẾU LÀM MÓN","order":{"paymentStatus":"pending","paidAt":""}}');
  update public.orders set metadata=metadata||jsonb_build_object('paymentStatus','paid','paidAt',now()::text) where id=test_id;
  select * into job from public.print_jobs where id=md5('website-paid-receipt:'||test_id)::uuid;
  if not found then raise exception 'Paid follow-up receipt was not queued'; end if;
  if job.payload->'order'->>'paymentStatus'<>'paid' or (job.payload->'order'->'stampSummary'->>'available')::int<>before_balance
    or jsonb_array_length(job.payload->'order'->'items')=0 then raise exception 'Receipt snapshot/items are incorrect'; end if;
  update public.orders set metadata=metadata||'{"receiptRegression":true}' where id=test_id;
  select count(*) into count_jobs from public.print_jobs where source_type='website_paid_receipt' and order_id=test_id;
  if count_jobs<>1 then raise exception 'Duplicate paid receipts'; end if;
  insert into public.print_jobs(branch_uuid,order_id,source_type,job_type,payload)
    values(sample.branch_uuid::text,test_id,'qr_order_bundle','customer_bill','{"secondaryText":"Paid customer bill"}');
  if exists(select 1 from public.print_jobs where order_id=test_id and source_type='qr_order_bundle') then
    raise exception 'Duplicate webhook bundle was not suppressed'; end if;
  update public.print_jobs set status='printed' where order_id=test_id and source_type='website';
  -- A separate paid receipt/reprint gets a snapshot, never a new stamp.
  insert into public.print_jobs(branch_uuid,order_id,source_type,job_type,payload)
    values(sample.branch_uuid::text,test_id,'website','customer_bill','{"text":"Paid customer bill"}') returning * into job;
  if position('@@STAMPS:' in job.payload->>'text')=0 then raise exception 'Paid receipt lacks stamps'; end if;
  select balance into after_balance from stamp_private.accounts where phone=stamp_private.phone(sample.customer_phone);
  if after_balance is distinct from before_balance then raise exception 'Printing/duplicate-day sale changed stamp balance'; end if;
end $$;
