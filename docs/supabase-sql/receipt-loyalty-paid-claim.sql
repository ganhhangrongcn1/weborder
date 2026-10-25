-- Capability-based receipt claims. No table or general loyalty permission is opened.
create schema if not exists receipt_private;
revoke all on schema receipt_private from public, anon, authenticated;

create table if not exists receipt_private.receipts (
  source_type text not null check (source_type in ('ORDER','PARTNER_ORDER')),
  source_id text not null,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  paid_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  earned_points integer not null default 0,
  base_amount numeric not null default 0,
  phone_key text not null default '',
  rule_version_id uuid,
  details jsonb not null default '{}'::jsonb,
  primary key(source_type, source_id)
);
alter table receipt_private.receipts enable row level security;
revoke all on receipt_private.receipts from public, anon, authenticated;

create table if not exists receipt_private.activation (
  singleton boolean primary key default true check(singleton), started_at timestamptz not null default now(),
  enabled boolean not null default false
);
insert into receipt_private.activation(singleton) values(true) on conflict do nothing;
create table if not exists receipt_private.failures (
  source_type text not null, source_id text not null, error_message text not null,
  failed_at timestamptz not null default now(), primary key(source_type,source_id)
);
alter table receipt_private.activation enable row level security;
alter table receipt_private.failures enable row level security;
revoke all on receipt_private.activation,receipt_private.failures from public,anon,authenticated;

create or replace function receipt_private.staff_allowed(p_branch uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'role','')='service_role'
    or (session_user in ('postgres','supabase_admin') and auth.uid() is null
      and coalesce(current_setting('role',true),'none') not in ('anon','authenticated'))
    or exists(select 1 from public.profiles p where p.auth_user_id=auth.uid()
      and lower(p.status)='active'
      and (p.role='admin' or (p.role in ('staff','kitchen') and p.branch_uuid=p_branch)));
$$;

-- One settlement path, same business event keys as loyalty V2 and old clients.
create or replace function receipt_private.settle(p_source text, p_id text, p_phone text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o public.orders%rowtype; po public.partner_orders%rowtype;
  r receipt_private.receipts%rowtype; previous public.loyalty_ledger%rowtype;
  phone_key text; original_phone text; points_value integer; amount_value numeric;
  rule_id uuid; code_value text; state_value text; action_value text; cancelled boolean;
begin
  -- Lock source BEFORE receipt everywhere, including the claim endpoint.
  if p_source='ORDER' then
    select * into o from public.orders where id=p_id for update;
    if not found then return; end if;
    original_phone:=public.normalize_vietnam_phone(o.customer_phone);
    points_value:=o.expected_earn_points; amount_value:=o.points_base_amount;
    rule_id:=o.loyalty_rule_version_id; code_value:=o.order_code; state_value:=lower(o.status);
    if lower(coalesce(o.metadata->>'paymentStatus',o.metadata->>'payment_status','')) in ('refunded','refund','cancelled','canceled') then
      state_value:='refunded';
    end if;
    action_value:='SETTLE_EARN';
  elsif p_source='PARTNER_ORDER' then
    select * into po from public.partner_orders where id::text=p_id for update;
    if not found then return; end if;
    original_phone:=public.normalize_vietnam_phone(coalesce(nullif(po.customer_phone_key,''),po.customer_phone));
    points_value:=po.expected_earn_points; amount_value:=po.points_base_amount;
    rule_id:=po.loyalty_rule_version_id; code_value:=po.order_code; state_value:=lower(po.order_status);
    action_value:='CLAIM_PARTNER_EARN';
  else return;
  end if;
  select * into r from receipt_private.receipts where source_type=p_source and source_id=p_id for update;
  if not found then return; end if;
  -- Never trust client-writable order fields for the value/recipient of a claim.
  points_value:=r.earned_points; amount_value:=r.base_amount;
  rule_id:=r.rule_version_id; original_phone:=r.phone_key;
  cancelled:=state_value in ('cancelled','canceled','cancel','refunded','refund');
  select * into previous from public.loyalty_ledger
    where source_type=p_source and source_order_id=p_id and action=action_value and action_version=1;
  if cancelled then
    if previous.id is not null then
      insert into public.loyalty_ledger(id,customer_phone,entry_type,order_id,partner_order_id,
        partner_order_code,points,amount,title,source,source_type,source_order_id,action,action_version,
        idempotency_key,rule_version_id,reversal_of_ledger_id,actor_type,metadata)
      values('receipt-reverse-'||gen_random_uuid(),previous.customer_phone,'ORDER_EARN_REVERSED',
        previous.order_id,previous.partner_order_id,previous.partner_order_code,-previous.points,
        previous.amount,'Thu hồi điểm bill hủy/hoàn tiền','receipt',p_source,p_id,'REVERSE_EARN',1,
        'loyalty-v2:'||p_source||':'||p_id||':REVERSE_EARN:v1',previous.rule_version_id,previous.id,
        'SERVICE',jsonb_build_object('source','receipt_loyalty')) on conflict do nothing;
    end if;
    return;
  end if;
  if previous.id is not null or now()>=r.expires_at or coalesce(points_value,0)<=0 then return; end if;
  if p_source='PARTNER_ORDER' and lower(coalesce(po.point_status,''))='claimed' then return; end if;
  if p_source='PARTNER_ORDER' and po.net_received_amount is null then return; end if;
  phone_key:=public.normalize_vietnam_phone(coalesce(nullif(p_phone,''),original_phone));
  if phone_key !~ '^0[35789][0-9]{8}$' or phone_key is null then return; end if;
  if original_phone ~ '^0[35789][0-9]{8}$' and phone_key<>original_phone then
    raise exception 'Bill đã gắn số điện thoại khác. Vui lòng liên hệ quán.';
  end if;
  insert into public.loyalty_accounts(customer_phone,total_points,metadata)
    values(phone_key,0,jsonb_build_object('source','receipt_loyalty')) on conflict(customer_phone) do nothing;
  perform 1 from public.loyalty_accounts where customer_phone=phone_key for update;
  insert into public.loyalty_ledger(id,customer_phone,entry_type,order_id,partner_order_id,
    partner_order_code,points,amount,title,note,source,source_type,source_order_id,action,
    action_version,idempotency_key,rule_version_id,actor_type,metadata)
  values('receipt-earn-'||gen_random_uuid(),phone_key,
    case when p_source='ORDER' then 'ORDER_EARN' else 'PARTNER_ORDER_EARN' end,
    case when p_source='ORDER' then p_id end,case when p_source='PARTNER_ORDER' then po.id end,
    case when p_source='PARTNER_ORDER' then code_value end,points_value,coalesce(amount_value,0),
    'Cộng điểm bill đã thanh toán','Đơn '||coalesce(code_value,p_id),'receipt',p_source,p_id,
    action_value,1,'loyalty-v2:'||p_source||':'||p_id||':'||action_value||':v1',rule_id,'SERVICE',
    jsonb_build_object('source','receipt_loyalty','receipt',true)) on conflict do nothing;
  if not found then return; end if;
  if p_source='ORDER' and not coalesce(original_phone ~ '^0[35789][0-9]{8}$',false) then
    update public.orders set customer_phone=phone_key where id=p_id;
  elsif p_source='PARTNER_ORDER' then
    update public.partner_orders set point_status='claimed',claimed_customer_phone=phone_key,
      claimed_at=coalesce(claimed_at,now()) where id=po.id;
  end if;
end;
$$;

create or replace function receipt_private.issue(p_source text,p_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare result_token text; order_at timestamptz; snapshot jsonb; display_value jsonb; phone_value text;
begin
  if p_source='ORDER' then
    select created_at,to_jsonb(o) into order_at,snapshot from public.orders o where id=p_id for update;
  else select coalesce(order_time,created_at),to_jsonb(po) into order_at,snapshot from public.partner_orders po where id::text=p_id for update;
  end if;
  if order_at is null then return null; end if;
  phone_value:=coalesce(public.normalize_vietnam_phone(coalesce(nullif(snapshot->>'customer_phone_key',''),snapshot->>'customer_phone')),'');
  display_value:=jsonb_build_object('orderCode',coalesce(nullif(snapshot->>'display_order_code',''),
      nullif(snapshot->'metadata'->>'displayOrderCode',''),snapshot->>'order_code'),
    'branchName',snapshot->>'branch_name','createdAt',order_at,
    'totalAmount',coalesce((snapshot->>'total_amount')::numeric,0),
    'pointsBaseAmount',coalesce((snapshot->>'points_base_amount')::numeric,0),
    'source',coalesce(snapshot->>'partner_source','Gánh Hàng Rong'));
  insert into receipt_private.receipts(source_type,source_id,expires_at,earned_points,base_amount,phone_key,rule_version_id,details)
    values(p_source,p_id,order_at+interval '24 hours',coalesce((snapshot->>'expected_earn_points')::integer,0),
      coalesce((snapshot->>'points_base_amount')::numeric,0),phone_value,(snapshot->>'loyalty_rule_version_id')::uuid,display_value)
    on conflict(source_type,source_id) do update set
      earned_points=excluded.earned_points,base_amount=excluded.base_amount,
      rule_version_id=excluded.rule_version_id,details=excluded.details,
      phone_key=coalesce(nullif(receipt_private.receipts.phone_key,''),excluded.phone_key)
    where receipt_private.receipts.earned_points<=0;
  perform receipt_private.settle(p_source,p_id);
  select token into result_token from receipt_private.receipts where source_type=p_source and source_id=p_id;
  delete from receipt_private.failures where source_type=p_source and source_id=p_id;
  return 'https://ganhhangrong.vn/nhan-diem/'||result_token;
end;
$$;

create or replace function public.get_receipt_loyalty(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r receipt_private.receipts%rowtype; details jsonb; earned public.loyalty_ledger%rowtype;
  state_value text; status_value text; points_value integer; source_phone text;
  legacy_claimed boolean:=false; legacy_phone text;
begin
  if coalesce(p_token,'') !~ '^[a-f0-9]{64}$' then raise exception 'QR không hợp lệ. Vui lòng quét lại bill.'; end if;
  select * into r from receipt_private.receipts where token=p_token;
  if not found then raise exception 'Không tìm thấy bill. Vui lòng kiểm tra QR hoặc liên hệ quán.'; end if;
  if r.source_type='ORDER' then
    select jsonb_build_object('orderCode',coalesce(nullif(metadata->>'displayOrderCode',''),order_code),
      'branchName',branch_name,'createdAt',created_at,'totalAmount',total_amount,
      'pointsBaseAmount',points_base_amount,'source','Gánh Hàng Rong'),lower(status),expected_earn_points,customer_phone
    into details,state_value,points_value,source_phone from public.orders where id=r.source_id;
    if exists(select 1 from public.orders where id=r.source_id
      and lower(coalesce(metadata->>'paymentStatus',metadata->>'payment_status','')) in ('refunded','refund','cancelled','canceled')) then state_value:='refunded'; end if;
  else
    select jsonb_build_object('orderCode',coalesce(nullif(display_order_code,''),order_code),
      'branchName',branch_name,'createdAt',coalesce(order_time,created_at),'totalAmount',total_amount,
      'pointsBaseAmount',points_base_amount,'source',partner_source),lower(order_status),expected_earn_points,
      coalesce(nullif(customer_phone_key,''),customer_phone)
    into details,state_value,points_value,source_phone from public.partner_orders where id::text=r.source_id;
    select lower(coalesce(point_status,''))='claimed',
      coalesce(nullif(claimed_customer_phone,''),nullif(customer_phone_key,''),customer_phone)
    into legacy_claimed,legacy_phone from public.partner_orders where id::text=r.source_id;
  end if;
  if details is null then raise exception 'Bill không còn khả dụng. Vui lòng liên hệ quán.'; end if;
  details:=r.details; points_value:=r.earned_points; source_phone:=r.phone_key;
  select * into earned from public.loyalty_ledger where source_type=r.source_type
    and source_order_id=r.source_id and action in ('SETTLE_EARN','CLAIM_PARTNER_EARN') and action_version=1;
  status_value:=case when state_value in ('cancelled','canceled','cancel','refunded','refund') then 'cancelled'
    when earned.id is not null or legacy_claimed then 'claimed' when now()>=r.expires_at then 'expired'
    when coalesce(points_value,0)<=0 then 'waiting_data' else 'available' end;
  return details||jsonb_build_object('status',status_value,'points',coalesce(earned.points,points_value,0),
    'maskedPhone',case when earned.id is not null then '•••••••'||right(earned.customer_phone,3)
      when legacy_claimed then '•••••••'||right(coalesce(legacy_phone,''),3) else '' end,
    'phoneBound',coalesce(public.normalize_vietnam_phone(source_phone) ~ '^0[35789][0-9]{8}$',false),
    'expiresAt',r.expires_at);
end;
$$;

-- Only the validated receipt claim can call this bridge. Existing stamp rules,
-- phone/day identity, daily limits and source idempotency stay in set_source.
create or replace function receipt_private.record_claim_stamp(p_source text,p_id text,p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare r receipt_private.receipts%rowtype; cfg stamp_private.program%rowtype;
  source_name text; source_at timestamptz; state_value text;
begin
  select * into r from receipt_private.receipts where source_type=p_source and source_id=p_id;
  if not found then raise exception 'Không tìm thấy bill nhận tem.'; end if;
  if not exists(select 1 from public.loyalty_ledger where source_type=p_source and source_order_id=p_id
    and action in ('SETTLE_EARN','CLAIM_PARTNER_EARN') and action_version=1 and customer_phone=p_phone) then
    raise exception 'Chưa có giao dịch điểm hợp lệ để nhận tem.';
  end if;
  select * into cfg from stamp_private.program where id;
  source_at:=(r.details->>'createdAt')::timestamptz;
  if not coalesce(cfg.enabled,false) or source_at<cfg.starts_at or coalesce((r.details->>'totalAmount')::numeric,0)<=0 then return; end if;
  if p_source='ORDER' then
    source_name:='orders';
    select lower(status) into state_value from public.orders where id=p_id;
  else
    source_name:='partner_orders';
    select lower(order_status) into state_value from public.partner_orders where id::text=p_id;
    if state_value not in ('confirmed','preparing','ready','completed','done') then return; end if;
  end if;
  if state_value in ('cancelled','canceled','cancel','refunded','refund') then return; end if;
  perform stamp_private.set_source(source_name,p_id,p_phone,(source_at at time zone 'Asia/Ho_Chi_Minh')::date,true);
end;
$$;

create or replace function public.claim_receipt_loyalty(p_token text,p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r receipt_private.receipts%rowtype; current_view jsonb; phone_key text;
begin
  -- Capability authorizes only this bill; no access to account or order history.
  if not (select enabled from receipt_private.activation where singleton) then
    raise exception 'Hệ thống đang tạm ngưng nhận điểm. Vui lòng thử lại sau.';
  end if;
  current_view:=public.get_receipt_loyalty(p_token);
  if current_view->>'status'='claimed' then return current_view; end if;
  if current_view->>'status'<>'available' then raise exception 'Bill chưa đủ điều kiện hoặc đã hết hạn nhận điểm.'; end if;
  phone_key:=public.normalize_vietnam_phone(p_phone);
  if phone_key is null or phone_key !~ '^0[35789][0-9]{8}$' then raise exception 'Vui lòng nhập số điện thoại Việt Nam hợp lệ.'; end if;
  select * into r from receipt_private.receipts where token=p_token;
  perform receipt_private.settle(r.source_type,r.source_id,phone_key);
  perform receipt_private.record_claim_stamp(r.source_type,r.source_id,phone_key);
  return public.get_receipt_loyalty(p_token);
end;
$$;

create or replace function public.get_receipt_loyalty_link(p_source text,p_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare branch_value uuid; state_value text; paid boolean; url text;
begin
  if not (select enabled from receipt_private.activation where singleton) then return null; end if;
  if p_source='ORDER' then
    select branch_uuid,lower(status),lower(coalesce(metadata->>'paymentStatus',metadata->>'payment_status',''))
      in ('paid','converted','completed','success') into branch_value,state_value,paid from public.orders where id=p_id;
  elsif p_source='PARTNER_ORDER' then
    select branch_uuid,lower(order_status),true into branch_value,state_value,paid from public.partner_orders where id::text=p_id;
  else raise exception 'Nguồn bill không hợp lệ.'; end if;
  if not found or not receipt_private.staff_allowed(branch_value) then raise exception 'Không có quyền truy cập bill này.'; end if;
  if not paid or state_value in ('cancelled','canceled','cancel','refunded','refund') then return null; end if;
  url:=receipt_private.issue(p_source,p_id);
  return url;
end;
$$;

create or replace function receipt_private.order_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not (select enabled from receipt_private.activation where singleton) then return new; end if;
  if not receipt_private.staff_allowed(new.branch_uuid) then return new; end if;
  if pg_trigger_depth()>2 then return new; end if;
  if exists(select 1 from receipt_private.receipts where source_type='ORDER' and source_id=new.id) then
    perform receipt_private.issue('ORDER',new.id);
  elsif receipt_private.staff_allowed(new.branch_uuid)
    and lower(coalesce(new.metadata->>'paymentStatus',new.metadata->>'payment_status','')) in ('paid','converted','completed','success')
    and lower(new.status) not in ('cancelled','canceled','cancel','refunded','refund') then
    perform receipt_private.issue('ORDER',new.id);
  end if;
  return new;
exception when others then
  insert into receipt_private.failures(source_type,source_id,error_message) values('ORDER',new.id,sqlerrm)
    on conflict(source_type,source_id) do update set error_message=excluded.error_message,failed_at=now();
  return new;
end;
$$;

create or replace function receipt_private.partner_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not (select enabled from receipt_private.activation where singleton) then return new; end if;
  if not receipt_private.staff_allowed(new.branch_uuid) then return new; end if;
  if pg_trigger_depth()>2 then return new; end if;
  -- Merchant contract: partner orders arrive paid; no completion or print wait.
  -- Existing rows are not bulk-awarded or silently backfilled on unrelated updates.
  if exists(select 1 from receipt_private.receipts where source_type='PARTNER_ORDER' and source_id=new.id::text) then
    perform receipt_private.issue('PARTNER_ORDER',new.id::text);
  elsif new.created_at >= (select started_at from receipt_private.activation where singleton)
    and lower(coalesce(new.order_status,'')) not in ('cancelled','canceled','cancel','refunded','refund') then
    perform receipt_private.issue('PARTNER_ORDER',new.id::text);
  end if;
  return new;
exception when others then
  insert into receipt_private.failures(source_type,source_id,error_message) values('PARTNER_ORDER',new.id::text,sqlerrm)
    on conflict(source_type,source_id) do update set error_message=excluded.error_message,failed_at=now();
  return new;
end;
$$;

create or replace function receipt_private.print_job_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare source_value text; id_value text; url text; branch_value uuid;
begin
  if not (select enabled from receipt_private.activation where singleton) then return new; end if;
  if new.job_type<>'customer_bill' or (coalesce(new.payload->>'text','') like '%PHIẾU LÀM MÓN%'
      and lower(new.source_type)<>'qr_order_bundle')
    or lower(new.source_type) in ('pos_payment_qr','pos_payment_momo_qr','pickup_order_payment_qr',
      'delivery_order_payment_qr','qr_order_preparation','item_label','pos_shift_close') then return new; end if;
  id_value:=coalesce(nullif(new.payload->'order'->>'id',''),new.order_id);
  source_value:=case when lower(new.source_type) in ('partner','partner_order','grab','grabfood',
    'shopee','shopeefood','xanhngon','nexpos','foodapp','food_app') then 'PARTNER_ORDER' else 'ORDER' end;
  if source_value='PARTNER_ORDER' then
    select branch_uuid into branch_value from public.partner_orders where id::text=id_value;
  else select branch_uuid into branch_value from public.orders where id=id_value; end if;
  -- A queue entry must match its canonical branch, never the display code.
  if branch_value is null or branch_value::text<>new.branch_uuid then return new; end if;
  if not receipt_private.staff_allowed(branch_value) then return new; end if;
  url:=public.get_receipt_loyalty_link(source_value,id_value);
  if url is not null then
    new.payload:=new.payload||jsonb_build_object('receiptLoyaltyUrl',url,'loyaltyUrl',url,
      'footerQrUrl',url)||case when source_value='PARTNER_ORDER' then jsonb_build_object('qrUrl',url) else '{}'::jsonb end;
  end if;
  return new;
end;
$$;

drop trigger if exists receipt_loyalty_paid on public.orders;
create trigger receipt_loyalty_paid after insert or update of metadata,status,expected_earn_points on public.orders
  for each row execute function receipt_private.order_changed();
drop trigger if exists receipt_loyalty_partner on public.partner_orders;
create trigger receipt_loyalty_partner after insert or update of order_status,net_received_amount,expected_earn_points on public.partner_orders
  for each row execute function receipt_private.partner_changed();
drop trigger if exists receipt_loyalty_print on public.print_jobs;
create trigger receipt_loyalty_print before insert on public.print_jobs
  for each row execute function receipt_private.print_job_created();

revoke all on all functions in schema receipt_private from public, anon, authenticated;
revoke all on function public.get_receipt_loyalty(text),public.claim_receipt_loyalty(text,text),
  public.get_receipt_loyalty_link(text,text) from public,anon,authenticated;
grant execute on function public.get_receipt_loyalty(text),public.claim_receipt_loyalty(text,text) to anon,authenticated;
grant execute on function public.get_receipt_loyalty_link(text,text) to authenticated,service_role;
notify pgrst,'reload schema';

-- Deliberately returns only an aggregate, never identity, address or history.
create or replace function public.get_receipt_point_summary(p_phone text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare phone_key text; points_value integer;
begin
  phone_key:=public.normalize_vietnam_phone(p_phone);
  if phone_key is null or phone_key !~ '^0[35789][0-9]{8}$' then raise exception 'Số điện thoại không hợp lệ.'; end if;
  select total_points into points_value from public.loyalty_accounts where customer_phone=phone_key;
  return jsonb_build_object('totalPoints',coalesce(points_value,0));
end;
$$;
revoke all on function public.get_receipt_point_summary(text) from public;
grant execute on function public.get_receipt_point_summary(text) to anon,authenticated;
