-- Preserve the live stamp function and all permission/hold/redeem rules.
-- jsonb_populate_record does not apply table defaults to omitted fields.
do $patch$
declare definition text;
begin
  definition := pg_get_functiondef('public.checkout_stamp_order(jsonb,jsonb)'::regprocedure);
  if position('o.total_amount,o.branch_uuid,o.branch_name,o.branch_address,' in definition) > 0 then
    definition := replace(definition,
      'o.total_amount,o.branch_uuid,o.branch_name,o.branch_address,',
      'o.total_amount,o.branch_uuid,o.branch_name,coalesce(o.branch_address,''''),');
  elsif position('coalesce(o.branch_address,' in definition)=0 then
    raise exception 'checkout_stamp_order changed; review before patching';
  end if;
  if position('-- Optional POS text defaults' in definition)=0 then
    if position('o:=jsonb_populate_record(null::public.orders,p_order);' in definition)=0 then
      raise exception 'Stamp order parser changed; review before patching';
    end if;
    definition:=replace(definition,'o:=jsonb_populate_record(null::public.orders,p_order);',
      'o:=jsonb_populate_record(null::public.orders,p_order);
  -- Optional POS text defaults; financial, phone and gift validation stays unchanged.
  o.customer_name:=coalesce(o.customer_name,'''');
  o.branch_name:=coalesce(o.branch_name,'''');
  o.branch_address:=coalesce(o.branch_address,'''');
  o.promo_code:=coalesce(o.promo_code,'''');
  o.pickup_time_text:=coalesce(o.pickup_time_text,'''');
  o.delivery_address:=coalesce(o.delivery_address,'''');');
  end if;
  execute definition;
end $patch$;

-- Sessions intentionally have no client UPDATE grant. A narrowly authorized
-- private definer performs only pending-order attach; never grant table UPDATE.
create schema if not exists pos_checkout_private;
revoke all on schema pos_checkout_private from public,anon;
grant usage on schema pos_checkout_private to authenticated;
create or replace function pos_checkout_private.save_pos_qr_checkout(p_session_id uuid,p_order jsonb,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  s public.pos_payment_sessions; o public.orders; existing public.orders;
  actor public.profiles; fingerprint text; item_sum numeric; item_count integer;
begin
  o := jsonb_populate_record(null::public.orders,p_order);
  select * into actor from public.profiles where auth_user_id=auth.uid()
    and role in ('admin','staff','kitchen') and status='active' limit 1;
  if actor.id is null or o.branch_uuid is null or
    not ((actor.role='admin' and actor.branch_uuid is null) or actor.branch_uuid=o.branch_uuid) then
    raise exception 'Không có quyền tạo QR tại chi nhánh.' using errcode='42501';
  end if;
  select * into s from public.pos_payment_sessions where id=p_session_id for update;
  if s.id is null or s.branch_uuid is distinct from o.branch_uuid
    or s.provider not in ('sepay','pay2s') or s.source not in ('pos','qr_order')
    or s.payment_reference is distinct from o.id or o.order_code is distinct from o.id
    or s.amount_expected is distinct from o.total_amount
    or s.pos_shift_id is distinct from o.pos_shift_id
    or coalesce(s.customer_phone,'') is distinct from coalesce(o.customer_phone,'')
    or coalesce(s.pager_number,'') is distinct from coalesce(o.metadata->>'pagerNumber','')
    or s.request_key is distinct from o.metadata->>'requestKey' then
    raise exception 'Đơn không khớp phiên QR.';
  end if;
  fingerprint := md5((p_order - 'created_at' - 'updated_at')::text || p_items::text);
  select * into existing from public.orders where id=o.id for update;
  if found then
    if s.order_id is distinct from o.id or existing.metadata->>'qrCheckoutFingerprint' is distinct from fingerprint
      or s.status not in ('pending_payment','paid','converting','converted')
      or (s.status='pending_payment' and s.expires_at<=now())
      or existing.status in ('cancelled','canceled','refunded') then
      raise exception 'Mã QR đã dùng cho đơn khác hoặc đã hủy.';
    end if;
    return to_jsonb(s);
  end if;
  if s.source<>'pos' or s.status<>'pending_payment' or s.expires_at<=now()
    or s.order_id is not null or o.status is distinct from 'pending_payment'
    or o.payment_method is distinct from 'bank_qr' or o.fulfillment_type is distinct from 'pickup'
    or o.metadata->>'source' is distinct from 'pos_mobile' or o.metadata->>'deviceMode'='phone'
    or o.metadata->>'paymentStatus' is distinct from 'pending_payment'
    or o.total_amount is null or o.total_amount<=0 or o.subtotal is null or o.subtotal<0
    or coalesce(o.shipping_fee,0)<>0 or coalesce(o.promo_discount,0)<0
    or coalesce(o.points_discount,0)<0
    or coalesce((o.metadata->>'pointsDiscountAmount')::numeric,0)<0
    or o.total_amount is distinct from o.subtotal-coalesce(o.promo_discount,0)-coalesce((o.metadata->>'pointsDiscountAmount')::numeric,0)
    or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Dữ liệu đơn QR chờ thanh toán không hợp lệ.';
  end if;
  if not exists(select 1 from public.pos_shifts where id=o.pos_shift_id
    and branch_uuid=o.branch_uuid and status='open') then raise exception 'Ca POS đã đóng.'; end if;
  select count(*),sum((x->>'line_total')::numeric) into item_count,item_sum from jsonb_array_elements(p_items) x;
  if item_count=0 or item_sum is distinct from o.subtotal or exists(
    select 1 from jsonb_array_elements(p_items) x where coalesce((x->>'quantity')::integer,0)<1
      or coalesce((x->>'unit_price')::numeric,-1)<0 or coalesce((x->>'line_total')::numeric,-1)<0
      or x->>'order_id' is distinct from o.id) then raise exception 'Món không khớp tổng đơn QR.'; end if;
  if coalesce(o.metadata->>'stampGiftProductId','')<>'' then
    raise exception 'Món đổi tem dùng luồng checkout tem riêng.';
  end if;
  o.metadata := coalesce(o.metadata,'{}') || jsonb_build_object(
    'paymentStatus','pending_payment','paymentAmount',0,'paidAt','',
    'paymentReference',s.payment_reference,'paymentProvider',s.provider,
    'qrPaymentSessionId',s.id,'qrCheckoutFingerprint',fingerprint,
    'paymentMeta',coalesce(o.metadata->'paymentMeta','{}') || jsonb_build_object('paymentSessionId',s.id,'requestKey',s.request_key));
  -- Customer hydration stays on the existing RPC contract, in this transaction.
  if coalesce(o.customer_phone,'')<>'' then
    perform public.upsert_customer_stub_profile(o.customer_phone,o.customer_name,'pos_mobile',o.id);
  end if;
  insert into public.orders(id,order_code,customer_phone,customer_name,fulfillment_type,payment_method,status,
    subtotal,shipping_fee,original_shipping_fee,shipping_support_discount,promo_discount,promo_code,points_discount,points_earned,
    total_amount,branch_uuid,branch_name,branch_address,pickup_branch_uuid,pickup_branch_name,pickup_branch_address,
    pickup_time_text,delivery_address,kitchen_status,pos_shift_id,metadata,created_at,updated_at)
  values(o.id,o.order_code,o.customer_phone,coalesce(o.customer_name,''),'pickup','bank_qr','pending_payment',
    o.subtotal,0,0,0,coalesce(o.promo_discount,0),coalesce(o.promo_code,''),coalesce(o.points_discount,0),0,
    o.total_amount,o.branch_uuid,coalesce(o.branch_name,''),coalesce(o.branch_address,''),o.branch_uuid,coalesce(o.pickup_branch_name,o.branch_name,''),o.pickup_branch_address,
    coalesce(o.pickup_time_text,''),coalesce(o.delivery_address,''),'pending',o.pos_shift_id,o.metadata,now(),now());
  insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,line_total,spice,note,toppings,option_groups,metadata,kitchen_item_status)
    select o.id,x.product_id,x.product_name,x.quantity,x.unit_price,x.line_total,coalesce(x.spice,''),coalesce(x.note,''),
      coalesce(x.toppings,'[]'),coalesce(x.option_groups,'[]'),coalesce(x.metadata,'{}'),'pending'
    from jsonb_to_recordset(p_items) as x(product_id text,product_name text,quantity integer,unit_price numeric,line_total numeric,spice text,note text,toppings jsonb,option_groups jsonb,metadata jsonb);
  update public.pos_payment_sessions set source='qr_order',order_id=o.id,updated_at=now()
    where id=s.id and status='pending_payment' and source='pos' returning * into s;
  if s.id is null then raise exception 'Phiên QR đã thay đổi trong khi lưu đơn.'; end if;
  return to_jsonb(s);
end $$;
revoke all on function pos_checkout_private.save_pos_qr_checkout(uuid,jsonb,jsonb) from public,anon;
grant execute on function pos_checkout_private.save_pos_qr_checkout(uuid,jsonb,jsonb) to authenticated;
create or replace function public.save_pos_qr_checkout(p_session_id uuid,p_order jsonb,p_items jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select pos_checkout_private.save_pos_qr_checkout(p_session_id,p_order,p_items);
$$;
revoke all on function public.save_pos_qr_checkout(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_pos_qr_checkout(uuid,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';

-- Serialize competing QR orders for the same pager, preserving retry behavior.
do $patch$
declare definition text;
begin
  definition:=pg_get_functiondef('pos_checkout_private.save_pos_qr_checkout(uuid,jsonb,jsonb)'::regprocedure);
  if position('pos-qr-pager-guard' in definition)=0 then
    if position($anchor$  select count(*),sum((x->>'line_total')::numeric) into item_count,item_sum from jsonb_array_elements(p_items) x;$anchor$ in definition)=0 then raise exception 'Checkout changed; review pager patch'; end if;
    definition:=replace(definition,$anchor$  select count(*),sum((x->>'line_total')::numeric) into item_count,item_sum from jsonb_array_elements(p_items) x;$anchor$,$guard$  -- pos-qr-pager-guard
  if coalesce(s.pager_number,'')<>'' then
    perform pg_advisory_xact_lock(hashtextextended(s.branch_uuid::text||':'||s.pager_number,0));
    if exists(select 1 from public.orders q where q.branch_uuid=s.branch_uuid and q.id<>o.id
      and coalesce(q.metadata->>'pagerNumber',q.metadata->>'pager_number')=s.pager_number
      and lower(q.status) not in ('done','completed','cancelled','canceled','refunded')
      and coalesce(q.metadata->>'pagerStatus',q.metadata->>'pager_status','assigned') not in ('released','returned','available')) then
      raise exception 'Thẻ rung đang có đơn chưa hoàn tất.';
    end if;
  end if;
  select count(*),sum((x->>'line_total')::numeric) into item_count,item_sum from jsonb_array_elements(p_items) x;$guard$);
    execute definition;
  end if;
end $patch$;
