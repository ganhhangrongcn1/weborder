-- Preparation tickets and paid receipts are separate documents. Keep the
-- existing deduplication for every other job; the paid receipt has a stable UUID.
drop index if exists public.print_jobs_one_active_order_id_idx;
create unique index print_jobs_one_active_order_id_idx on public.print_jobs(branch_uuid,printer_key,job_type,order_id)
  where status in ('pending','printing') and order_id is not null and order_id<>''
    and source_type is distinct from 'website_paid_receipt';
drop index if exists public.print_jobs_one_active_order_code_idx;
create unique index print_jobs_one_active_order_code_idx on public.print_jobs(branch_uuid,printer_key,job_type,order_code)
  where status in ('pending','printing') and (order_id is null or order_id='') and order_code is not null and order_code<>''
    and source_type is distinct from 'website_paid_receipt';
create unique index if not exists print_jobs_paid_website_receipt_idx on public.print_jobs(branch_uuid,printer_key,order_id)
  where source_type='website_paid_receipt';

-- Queue one customer receipt AFTER the paid update (and BEFORE-trigger stamp ledger)
-- commits. An earlier kitchen/preparation ticket is not a paid customer receipt.
create or replace function stamp_private.enqueue_paid_website_receipt()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cfg stamp_private.program;
  account_row stamp_private.accounts;
  phone_key text;
  summary jsonb;
  receipt_order jsonb;
  receipt_items jsonb;
  job_id uuid;
begin
  if lower(coalesce(new.metadata->>'source', new.metadata->>'orderSource', '')) not in ('online','website','web')
    or lower(coalesce(new.metadata->>'paymentStatus',new.metadata->>'payment_status','')) <> 'paid'
    or lower(coalesce(new.payment_method,'')) not in ('bank_qr','momo')
    or lower(coalesce(new.status,'')) in ('cancelled','canceled','refunded','expired')
    or new.branch_uuid is null
    or not stamp_private.is_operator(new.branch_uuid) then
    return new;
  end if;
  if tg_op='UPDATE' then
    if lower(coalesce(old.metadata->>'paymentStatus',old.metadata->>'payment_status',''))='paid' then
      return new;
    end if;
  end if;
  -- Only follow an existing unpaid preparation ticket. Prepaid orders without
  -- a preparation ticket keep their normal webhook/kitchen print flow.
  if not exists(select 1 from public.print_jobs j where j.order_id=new.id
    and j.job_type='customer_bill' and j.source_type in ('website','web','online')
    and coalesce(j.payload->'order'->>'paidAt','')=''
    and lower(coalesce(j.payload->'order'->>'paymentStatus','unpaid'))<>'paid') then
    return new;
  end if;
  phone_key := stamp_private.phone(new.customer_phone);
  if phone_key ~ '^0[35789][0-9]{8}$' then
    select * into cfg from stamp_private.program where id;
    select * into account_row from stamp_private.accounts where phone=phone_key;
    summary := jsonb_build_object('enabled',coalesce(cfg.enabled,false),'required',10,
      'balance',coalesce(account_row.balance,0),'held',coalesce(account_row.held,0),
      'available',greatest(0,coalesce(account_row.balance-account_row.held,0)),
      'earnedToday',exists(select 1 from stamp_private.sources s where s.phone=phone_key
        and s.business_day=(now() at time zone 'Asia/Ho_Chi_Minh')::date and s.active));
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'productId',i.product_id,'name',i.product_name,
    'quantity',i.quantity,'price',i.unit_price,'lineTotal',i.line_total,'note',i.note,
    'options',coalesce(i.toppings,'[]'::jsonb) || coalesce(i.option_groups,'[]'::jsonb)
  ) order by i.id),'[]'::jsonb) into receipt_items from public.order_items i where i.order_id=new.id;
  receipt_order := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object(
    'id',new.id,'orderCode',coalesce(new.order_code,new.id),
    'displayOrderCode',coalesce(new.metadata->>'displayOrderCode',new.metadata->>'display_order_code',new.order_code,new.id),
    'customerName',new.customer_name,'customerPhone',phone_key,
    'branchName',coalesce(new.branch_name,new.pickup_branch_name,new.delivery_branch_name),
    'subtotal',new.subtotal,'totalAmount',new.total_amount,'shippingFee',new.shipping_fee,
    'paymentMethod',new.payment_method,'paymentStatus','paid',
    'paidAt',coalesce(new.metadata->>'paidAt',new.metadata->>'paid_at',now()::text),
    'paymentReference',coalesce(new.metadata->>'paymentReference',new.metadata->>'payment_reference',''),
    'items',receipt_items,'stampSummary',summary);
  job_id := md5('website-paid-receipt:' || new.id)::uuid;
  insert into public.print_jobs(id,branch_uuid,printer_key,job_type,status,order_id,order_code,source_type,payload,requested_by)
    values(job_id,new.branch_uuid::text,'cashier-80mm','customer_bill','pending',new.id,
      receipt_order->>'displayOrderCode','website_paid_receipt',
      jsonb_build_object('type','website_paid_receipt','sourceType','website_paid_receipt','order',receipt_order),
      'paid-website-receipt')
    on conflict(id) do nothing;
  return new;
end $$;
revoke all on function stamp_private.enqueue_paid_website_receipt() from public,anon,authenticated;
drop trigger if exists orders_enqueue_paid_website_receipt on public.orders;
create trigger orders_enqueue_paid_website_receipt
  after update of metadata,payment_method on public.orders
  for each row execute function stamp_private.enqueue_paid_website_receipt();

-- Bind the receipt to the paid order and snapshot the committed stamp balance.
-- This is display-only: neither printing nor reprinting awards a stamp.
create or replace function stamp_private.snapshot_paid_receipt_stamps()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  cfg stamp_private.program;
  a stamp_private.accounts;
  phone_key text;
  summary jsonb;
  section text;
  field_name text;
begin
  if new.job_type is distinct from 'customer_bill'
    or new.source_type not in ('website','web','online','qr_order','qr_order_bundle','website_paid_receipt') then return new; end if;
  select * into o from public.orders where id=new.order_id;
  if not found or new.branch_uuid is distinct from o.branch_uuid::text
    or not stamp_private.is_operator(o.branch_uuid)
    or lower(coalesce(o.metadata->>'paymentStatus',o.metadata->>'payment_status',''))<>'paid'
    or lower(coalesce(o.status,'')) in ('cancelled','canceled','refunded','expired') then return new; end if;
  -- The paid follow-up replaces a second webhook bundle only when an earlier
  -- unpaid preparation ticket caused the follow-up to be queued.
  if new.source_type='qr_order_bundle' and exists(select 1 from public.print_jobs j
    where j.id=md5('website-paid-receipt:' || o.id)::uuid) then return null; end if;
  phone_key := stamp_private.phone(o.customer_phone);
  if phone_key !~ '^0[35789][0-9]{8}$' then return new; end if;
  select * into cfg from stamp_private.program where id;
  select * into a from stamp_private.accounts where phone=phone_key;
  summary := jsonb_build_object('enabled',coalesce(cfg.enabled,false),'required',10,
    'balance',coalesce(a.balance,0),'held',coalesce(a.held,0),
    'available',greatest(0,coalesce(a.balance-a.held,0)),
    'earnedToday',exists(select 1 from stamp_private.sources s where s.phone=phone_key
      and s.business_day=(now() at time zone 'Asia/Ho_Chi_Minh')::date and s.active));
  new.payload := jsonb_set(new.payload,'{order}',coalesce(new.payload->'order','{}'::jsonb)
    || jsonb_build_object('stampSummary',summary),true);
  if cfg.enabled then
    section := E'\n@@RULE\n@@CENTER:TÍCH TEM NHẬN QUÀ\n@@STAMPS:' || (summary->>'available')
      || E'\nBạn có ' || (summary->>'available') || E'/10 tem khả dụng\nMỗi ngày tối đa 1 tem / số điện thoại\n@@STAMPEND';
    field_name := case when coalesce(new.payload->>'secondaryText','')<>'' then 'secondaryText' else 'text' end;
    if coalesce(new.payload->>field_name,'')<>''
      and position('@@STAMPS:' in new.payload->>field_name)=0
      and position('PHIẾU LÀM MÓN' in new.payload->>field_name)=0
      and position('CHƯA THANH TOÁN' in new.payload->>field_name)=0 then
      new.payload := jsonb_set(new.payload,array[field_name],to_jsonb((new.payload->>field_name)||section),true);
    end if;
  end if;
  return new;
end $$;
revoke all on function stamp_private.snapshot_paid_receipt_stamps() from public,anon,authenticated;
drop trigger if exists print_jobs_snapshot_paid_stamps on public.print_jobs;
create trigger print_jobs_snapshot_paid_stamps before insert on public.print_jobs
  for each row execute function stamp_private.snapshot_paid_receipt_stamps();
