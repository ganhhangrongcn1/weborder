-- Resolve configured availability against stable branch identities, never display order codes.
create or replace function stamp_private.gift_available(p_product text,p_branch uuid,p_channel text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare av jsonb; keys text[]; matrix jsonb; entry record;
begin
  select coalesce(metadata->'availability','{}') into av from public.products
    where id=p_product and active is not false and visible is not false;
  if av is null then return false; end if;
  select array_remove(array[b.branch_uuid::text,b.id::text,b.branch_code,b.legacy_id,b.slug],null) into keys
    from public.branches b where b.branch_uuid=p_branch and b.pickup_enabled is not false;
  if keys is null then return false; end if;
  matrix:=coalesce(av->'branchChannels','{}');
  if jsonb_typeof(matrix)='object' and matrix<>'{}'::jsonb then
    for entry in select * from jsonb_each(matrix) loop
      if entry.key=any(keys) then return entry.value ? p_channel; end if;
    end loop;
    return false;
  end if;
  if jsonb_array_length(coalesce(av->'channels','[]'))>0 and not (av->'channels' ? p_channel) then return false; end if;
  return jsonb_array_length(coalesce(av->'branchIds','[]'))=0 or av->'branchIds' ?| keys;
end $$;

create or replace function stamp_private.order_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cfg stamp_private.program; r stamp_private.redemptions;
  phone_key text; gift_id text; cancelled boolean; settled boolean; earned boolean; trusted boolean; source_time timestamptz; prior stamp_private.sources; a stamp_private.accounts;
begin
  select * into cfg from stamp_private.program where id;
  gift_id := coalesce(new.metadata->>'stampGiftProductId','');
  phone_key := stamp_private.phone(new.customer_phone);
  trusted := stamp_private.is_operator(new.branch_uuid);
  source_time := new.created_at;
  -- Offline POS sync may insert later; retain the original paid business day.
  if new.metadata->>'source' in ('pos_mobile','pos') and nullif(new.metadata->>'paidAt','') is not null then
    begin
      source_time := least(new.created_at,(new.metadata->>'paidAt')::timestamptz);
    exception when invalid_datetime_format or datetime_field_overflow then
      source_time := new.created_at;
    end;
  end if;
  select * into prior from stamp_private.sources where source='orders' and order_id=new.id;
  if prior.order_id is not null and (phone_key<>prior.phone or (source_time at time zone 'Asia/Ho_Chi_Minh')::date<>prior.business_day) then
    raise exception 'Không thể thay khách hoặc ngày của đơn đã tích tem.';
  end if;
  select * into r from stamp_private.redemptions where order_id=new.id;
  cancelled := lower(coalesce(new.status,'')) in ('cancelled','canceled','refunded');
  settled := not cancelled and (lower(coalesce(new.status,'')) in ('completed','done')
    or (new.metadata->>'paymentStatus'='paid' and new.metadata->>'source' in ('pos_mobile','pos')));
  if r.order_id is not null and (gift_id<>r.product_id or phone_key<>r.phone or new.branch_uuid is distinct from r.branch_uuid) then
    raise exception 'Không thể đổi khách, chi nhánh hoặc món của đơn đổi tem đã tạo.';
  end if;
  if gift_id<>'' then
    if not trusted then
      perform stamp_private.authorize(phone_key,new.branch_uuid);
      if settled or (tg_op='UPDATE' and (new.status is distinct from old.status or new.metadata is distinct from old.metadata
        or new.total_amount is distinct from old.total_amount)) then
        raise exception 'Đơn đổi tem đã tạo chỉ được nhân viên xử lý.' using errcode='42501';
      end if;
    end if;
    if phone_key !~ '^0[35789][0-9]{8}$' or new.fulfillment_type is distinct from 'pickup' or coalesce(new.shipping_fee,0)<>0 then
      raise exception 'Quà đổi tem cần số điện thoại hợp lệ và nhận tại quán.';
    end if;
    if new.total_amount is null or new.total_amount<0 or new.subtotal is null or new.subtotal<0 then
      raise exception 'Tổng tiền đơn đổi tem không hợp lệ.';
    end if;
    if new.total_amount=0 and coalesce(lower(new.payment_method),'') not in ('cash','counter') then
      raise exception 'Đơn 0đ chỉ xác nhận tại quầy.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('stamp:'||phone_key,0));
    if r.order_id is null then
      perform stamp_private.authorize(phone_key,new.branch_uuid);
      if new.branch_uuid is null then raise exception 'Chọn chi nhánh nhận quà.'; end if;
      if not cfg.enabled or not (gift_id=any(cfg.gift_ids)) or not stamp_private.gift_available(gift_id,new.branch_uuid,
        case when trusted and new.metadata->>'source' in ('pos_mobile','pos') then 'pos' else 'web' end) then raise exception 'Món quà không còn áp dụng.'; end if;
      select * into a from stamp_private.accounts where phone=phone_key for update;
      if coalesce(a.balance-a.held,0)<10 then raise exception 'Chưa đủ 10 tem khả dụng hoặc tem đang dùng cho đơn khác.'; end if;
      insert into stamp_private.redemptions(order_id,phone,product_id,state,branch_uuid,actor_id)
        values(new.id,phone_key,gift_id,'held',new.branch_uuid,auth.uid()) returning * into r;
      update stamp_private.accounts set held=held+10 where phone=phone_key;
      insert into stamp_private.events(phone,kind,delta,source,order_id) values(phone_key,'hold',0,'orders',new.id);
    end if;
    if r.state='released' and not cancelled then raise exception 'Đơn đổi tem đã hủy, vui lòng tạo đơn mới.'; end if;
    if cancelled and r.state<>'released' then
      update stamp_private.accounts set held=held-case when r.state='held' then 10 else 0 end,
        balance=balance+case when r.state='redeemed' then 10 else 0 end where phone=phone_key;
      update stamp_private.redemptions set state='released' where order_id=new.id;
      insert into stamp_private.events(phone,kind,delta,source,order_id)
        values(phone_key,'release',case when r.state='redeemed' then 10 else 0 end,'orders',new.id);
    elsif settled and r.state='held' then
      update stamp_private.accounts set held=held-10,balance=balance-10 where phone=phone_key;
      update stamp_private.redemptions set state='redeemed' where order_id=new.id;
      insert into stamp_private.events(phone,kind,delta,source,order_id) values(phone_key,'redeem',-10,'orders',new.id);
    end if;
  end if;
  if phone_key ~ '^0[35789][0-9]{8}$' then
    earned := (cfg.enabled or prior.active is true) and source_time>=cfg.starts_at and settled and new.total_amount>0;
    if not trusted and prior.order_id is not null and (cancelled or not settled or new.total_amount<=0) then
      raise exception 'Chỉ nhân viên được điều chỉnh đơn đã tích tem.' using errcode='42501';
    end if;
    if trusted and (earned or prior.order_id is not null) then
      perform stamp_private.set_source('orders',new.id,phone_key,(source_time at time zone 'Asia/Ho_Chi_Minh')::date,earned);
    end if;
  end if;
  return new;
end $$;

create or replace function stamp_private.partner_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cfg stamp_private.program; phone_key text; eligible boolean; source_time timestamptz; prior stamp_private.sources;
begin
  select * into cfg from stamp_private.program where id;
  select * into prior from stamp_private.sources where source='partner_orders' and order_id=new.id::text;
  if not stamp_private.is_operator(new.branch_uuid) then
    if prior.order_id is not null then raise exception 'Chỉ nhân viên được điều chỉnh đơn đã tích tem.' using errcode='42501'; end if;
    return new;
  end if;
  phone_key:=stamp_private.phone(coalesce(nullif(new.claimed_customer_phone,''),nullif(new.customer_phone_key,''),new.customer_phone));
  source_time:=coalesce(new.order_time,new.created_at);
  if prior.order_id is not null and (phone_key<>prior.phone or (source_time at time zone 'Asia/Ho_Chi_Minh')::date<>prior.business_day) then
    raise exception 'STAMP_ORDER_IDENTITY_CHANGED';
  end if;
  if phone_key !~ '^0[35789][0-9]{8}$' then return new; end if;
  eligible:=(cfg.enabled or prior.active is true) and source_time>=cfg.starts_at and new.total_amount>0
    and lower(coalesce(new.order_status,'')) in ('completed','done');
  if eligible or exists(select 1 from stamp_private.sources where source='partner_orders' and order_id=new.id::text) then
    perform stamp_private.set_source('partner_orders',new.id::text,phone_key,(source_time at time zone 'Asia/Ho_Chi_Minh')::date,eligible);
  end if;
  return new;
end $$;

-- A gift order and its item must commit together. Never leave a paid gift order without its item.
create or replace function stamp_private.validate_gift_items() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o public.orders; n integer; gift_id text; subtotal numeric;
begin
  if tg_table_name='orders' then select * into o from public.orders where id=new.id;
  else select * into o from public.orders where id=coalesce(new.order_id,old.order_id); end if;
  gift_id:=coalesce(o.metadata->>'stampGiftProductId','');
  if gift_id='' then
    if tg_table_name='order_items' and coalesce(new.metadata->>'stampGift','false')='true' then
      raise exception 'Món đổi tem thiếu giao dịch đổi hợp lệ.';
    end if;
    return null;
  end if;
  select count(*) into n from public.order_items where order_id=o.id and metadata->>'stampGift'='true'
    and product_id=gift_id and quantity=1 and unit_price=0 and line_total=0
    and coalesce(toppings,'[]')='[]'::jsonb and coalesce(option_groups,'[]')='[]'::jsonb;
  select coalesce(sum(line_total),0) into subtotal from public.order_items where order_id=o.id;
  if n<>1 or subtotal<>o.subtotal or (select count(*) from public.order_items where order_id=o.id and metadata->>'stampGift'='true')<>1 then
    raise exception 'Đơn đổi tem phải có đúng một món quà 0đ và tổng món hợp lệ.';
  end if;
  return null;
end $$;

-- Cancellation is the reversible path. Do not orphan earned/held stamps through a hard delete.
create or replace function stamp_private.protect_order_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from stamp_private.sources where source=tg_table_name and order_id=old.id::text)
    or (tg_table_name='orders' and exists(select 1 from stamp_private.redemptions where order_id=old.id::text)) then
    raise exception 'Đơn có tem cần hủy hoặc hoàn tiền, không xóa trực tiếp.';
  end if;
  return old;
end $$;
drop trigger if exists orders_stamp_delete on public.orders;
create trigger orders_stamp_delete before delete on public.orders for each row execute function stamp_private.protect_order_delete();
drop trigger if exists partner_stamp_delete on public.partner_orders;
create trigger partner_stamp_delete before delete on public.partner_orders for each row execute function stamp_private.protect_order_delete();

drop trigger if exists orders_stamp_program on public.orders;
create trigger orders_stamp_program before insert or update on public.orders
  for each row execute function stamp_private.order_before_write();
drop trigger if exists partner_orders_stamp_program on public.partner_orders;
create trigger partner_orders_stamp_program after insert or update on public.partner_orders
  for each row execute function stamp_private.partner_after_write();
drop trigger if exists orders_stamp_items_check on public.orders;
create constraint trigger orders_stamp_items_check after insert or update on public.orders deferrable initially deferred
  for each row execute function stamp_private.validate_gift_items();
drop trigger if exists order_items_stamp_check on public.order_items;
create constraint trigger order_items_stamp_check after insert or update or delete on public.order_items deferrable initially deferred
  for each row execute function stamp_private.validate_gift_items();

-- SECURITY INVOKER retains existing orders/order_items RLS. Only authenticated gift checkouts use this RPC.
create or replace function public.checkout_stamp_order(p_order jsonb,p_items jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare o public.orders; existing public.orders; result public.orders;
begin
  o:=jsonb_populate_record(null::public.orders,p_order);
  if coalesce(o.metadata->>'stampGiftProductId','')='' then raise exception 'Thiếu món đổi tem.'; end if;
  if auth.uid() is null then raise exception 'Đăng nhập để đổi tem.' using errcode='42501'; end if;
  perform public.get_stamp_summary(o.customer_phone);
  select * into existing from public.orders where id=o.id for update;
  if found then
    if lower(existing.status) in ('cancelled','canceled','refunded') then
      raise exception 'Đơn đổi tem đã hủy. Vui lòng tạo đơn mới.';
    end if;
    if existing.customer_phone is distinct from o.customer_phone or existing.metadata->>'stampGiftProductId' is distinct from o.metadata->>'stampGiftProductId'
      or existing.total_amount is distinct from o.total_amount or existing.subtotal is distinct from o.subtotal then
      raise exception 'Mã đơn đã dùng với nội dung khác.';
    end if;
    return to_jsonb(existing);
  end if;
  if exists(select 1 from public.profiles where auth_user_id=auth.uid() and role='customer')
    and (o.status not in ('preparing','pending_payment') or coalesce(o.metadata->>'paymentStatus','')='paid') then
    raise exception 'Khách không thể tự xác nhận đã thanh toán.' using errcode='42501';
  end if;
  insert into public.orders(id,order_code,customer_phone,customer_name,fulfillment_type,payment_method,status,
    subtotal,shipping_fee,original_shipping_fee,shipping_support_discount,promo_discount,promo_code,points_discount,points_earned,
    total_amount,branch_uuid,branch_name,branch_address,pickup_branch_uuid,pickup_branch_name,pickup_branch_address,
    pickup_time_text,delivery_address,kitchen_status,pos_shift_id,metadata,created_at,updated_at)
  values(o.id,o.order_code,o.customer_phone,o.customer_name,o.fulfillment_type,o.payment_method,o.status,
    o.subtotal,coalesce(o.shipping_fee,0),coalesce(o.original_shipping_fee,0),coalesce(o.shipping_support_discount,0),coalesce(o.promo_discount,0),o.promo_code,coalesce(o.points_discount,0),coalesce(o.points_earned,0),
    o.total_amount,o.branch_uuid,o.branch_name,o.branch_address,o.pickup_branch_uuid,o.pickup_branch_name,o.pickup_branch_address,
    o.pickup_time_text,o.delivery_address,coalesce(o.kitchen_status,'pending'),o.pos_shift_id,o.metadata,coalesce(o.created_at,now()),now()) returning * into result;
  insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,line_total,spice,note,toppings,option_groups,metadata,kitchen_item_status)
    select o.id,x.product_id,x.product_name,x.quantity,x.unit_price,x.line_total,x.spice,x.note,coalesce(x.toppings,'[]'),coalesce(x.option_groups,'[]'),coalesce(x.metadata,'{}'),'pending'
    from jsonb_to_recordset(p_items) as x(product_id text,product_name text,quantity integer,unit_price numeric,line_total numeric,spice text,note text,toppings jsonb,option_groups jsonb,metadata jsonb);
  return to_jsonb(result);
end $$;
revoke all on all functions in schema stamp_private from public,anon,authenticated;
revoke all on function public.checkout_stamp_order(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.checkout_stamp_order(jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
