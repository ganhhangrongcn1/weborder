-- Award web and POS stamps in the payment transaction, before receipt reads.
-- Retain legacy completion handling, authorization, daily cap and reversals.
-- No historical backfill; completion/retries use the same (source, order_id).
begin;
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
    or new.metadata->>'paymentStatus'='paid');
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
notify pgrst, 'reload schema';
commit;
