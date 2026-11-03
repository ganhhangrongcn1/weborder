-- New clients only. Existing create_pos_bank_checkout remains unchanged.
-- Lock-only helpers preserve the ledger-only write policy on loyalty tables.
create or replace function pos_checkout_private.lock_pos_qr_account(p_phone text)
returns public.loyalty_accounts language plpgsql security definer set search_path='' as $$
declare a public.loyalty_accounts; available numeric;
begin
  select * into a from public.loyalty_accounts where customer_phone=p_phone for update;
  select coalesce(sum(remaining_points),0) into available from loyalty_private.point_lots
    where customer_phone=p_phone and remaining_points>0 and expires_at>now();
  a.total_points:=least(coalesce(a.total_points,0),available);
  return a;
end;
$$;
create or replace function pos_checkout_private.lock_pos_qr_rule()
returns public.loyalty_rule_versions language sql security definer set search_path='' as $$
  select r from public.loyalty_rule_versions r where r.status='ACTIVE' and r.effective_from<=now()
    order by r.effective_from desc,r.version_number desc limit 1 for share;
$$;
revoke all on function pos_checkout_private.lock_pos_qr_account(text),pos_checkout_private.lock_pos_qr_rule() from public,anon,authenticated;
grant execute on function pos_checkout_private.lock_pos_qr_account(text),pos_checkout_private.lock_pos_qr_rule() to service_role;
grant execute on function loyalty_private.evaluate_order_voucher(text,text,numeric,text,text,text,timestamptz),
  loyalty_private.resolve_configured_coupon(text),loyalty_private.get_loyalty_max_redemption_percent(uuid),
  loyalty_private.combined_benefit_points_limit(numeric,numeric) to service_role;
create or replace function public.create_pos_bank_checkout_v2(
  p_actor uuid,p_session jsonb,p_order jsonb,p_items jsonb,p_intent jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  actor public.profiles; account public.loyalty_accounts; customer public.profiles;
  rule public.loyalty_rule_versions; coupon public.coupons;
  claims text:=coalesce(current_setting('request.jwt.claims',true),'');
  branch uuid:=(p_session->>'branch_uuid')::uuid;
  customer_phone_key text:=public.normalize_vietnam_phone(p_session->>'customer_phone');
  payment_ref text:=p_session->>'payment_reference'; checkout_key text:=p_session->>'request_key';
  subtotal numeric; requested numeric; spent numeric; point_amount numeric; discount numeric:=0; total numeric;
  unit numeric; unit_value numeric; step numeric; percent numeric; ceiling_amount numeric;
  code text:=upper(btrim(coalesce(p_intent->>'promoCode','')));
  source text:=lower(btrim(coalesce(p_intent->>'promoSource','')));
  voucher_id text:=btrim(coalesce(p_intent->>'promoVoucherId',''));
  voucher_result record; valid boolean:=true; reason text:='ok';
  voucher jsonb; data jsonb; branches jsonb; channels jsonb; customer_type text; fulfillment text;
  quote jsonb; result jsonb; selected_key text;
begin
  if coalesce(auth.role(),'')<>'service_role' and not (session_user in ('postgres','supabase_admin') and coalesce(auth.role(),'')='') then
    raise exception 'Server checkout only' using errcode='42501'; end if;
  select * into actor from public.profiles where auth_user_id=p_actor
    and role in ('admin','staff','kitchen') and status='active' limit 1;
  if actor.id is null or branch is null or not ((actor.role='admin' and actor.branch_uuid is null) or actor.branch_uuid=branch) then
    raise exception 'Không có quyền tại chi nhánh.' using errcode='42501'; end if;
  if jsonb_typeof(p_intent) is distinct from 'object' or checkout_key is null
    or checkout_key !~ '^[A-Za-z0-9:_-]{6,120}$' or payment_ref is null or payment_ref !~ '^[A-Z0-9-]{6,80}$'
    or p_order->>'id' is distinct from payment_ref or p_order->>'branch_uuid' is distinct from branch::text
    or public.normalize_vietnam_phone(p_order->>'customer_phone') is distinct from customer_phone_key then
    raise exception 'Dữ liệu tạo QR không hợp lệ.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pos-bank:'||checkout_key,0));
  perform pg_advisory_xact_lock(hashtextextended('pos-ref:'||payment_ref,0));
  -- A retry must return the frozen original amount/account, not reprice a QR
  -- which a customer may already have scanned. V1 checks fingerprint and owner.
  if exists(select 1 from public.pos_payment_sessions s where s.request_key=checkout_key or s.payment_reference=payment_ref) then
    return public.create_pos_bank_checkout(p_actor,p_session,p_order,p_items);
  end if;
  select sum((item->>'line_total')::numeric) into subtotal from jsonb_array_elements(p_items) item;
  requested:=coalesce((p_intent->>'pointsRequested')::numeric,0);
  if subtotal is null or subtotal<=0 or subtotal<>trunc(subtotal)
    or subtotal is distinct from (p_order->>'subtotal')::numeric
    or requested<0 or requested<>trunc(requested) or requested>2147483647 then
    raise exception 'Tổng món hoặc số điểm không hợp lệ.'; end if;
  if source not in ('','loyalty','checkout') or code is distinct from upper(btrim(coalesce(p_order->>'promo_code','')))
    or voucher_id is distinct from btrim(coalesce(p_order#>>'{metadata,promoVoucherId}','')) then
    raise exception 'Ưu đãi không khớp bill.'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::text,true);
  if coalesce(customer_phone_key,'')<>'' then
    account:=pos_checkout_private.lock_pos_qr_account(customer_phone_key);
    select * into customer from public.profiles where public.profiles.phone in (customer_phone_key,'84'||substr(customer_phone_key,2),substr(customer_phone_key,2))
      order by (registered or auth_user_id is not null) desc nulls last limit 1;
  end if;
  rule:=pos_checkout_private.lock_pos_qr_rule();
  if rule.id is null then raise exception 'Chưa có quy tắc loyalty đang hoạt động.'; end if;
  unit:=greatest(rule.redeem_point_unit,1); unit_value:=greatest(rule.redeem_value,1);
  percent:=loyalty_private.get_loyalty_max_redemption_percent(rule.id);
  step:=1000*unit/pg_catalog.gcd(1000::bigint,unit::bigint);
  if code<>'' then
    perform pg_advisory_xact_lock(hashtextextended('pos-voucher:'||code,0));
    coupon:=loyalty_private.resolve_configured_coupon(code);
    select * into voucher_result from loyalty_private.evaluate_order_voucher(payment_ref,customer_phone_key,subtotal,code,source,voucher_id,now());
    valid:=coalesce(voucher_result.is_valid,false); reason:=coalesce(voucher_result.reason,'voucher_invalid');
    if source='loyalty' then
      select value into voucher from jsonb_array_elements(coalesce(account.vouchers,'[]'))
        where (voucher_id<>'' and value->>'id'=voucher_id) or (voucher_id='' and upper(value->>'code')=code) limit 1;
      data:=coalesce(coupon.data,voucher,'{}');
    else
      data:=coalesce(coupon.data,'{}');
      channels:=coalesce(data->'salesChannels',data->'sales_channels');
      customer_type:=lower(coalesce(data->>'customerType',coupon.customer_type,'all'));
      fulfillment:=lower(coalesce(data->>'fulfillmentType',coupon.fulfillment_type,'all'));
      if (jsonb_typeof(channels)='array' and not exists(select 1 from jsonb_array_elements_text(channels) x where lower(x)='pos'))
        or fulfillment not in ('','all','pickup','pos')
        or (customer_type='registered' and not coalesce(customer.registered or customer.auth_user_id is not null or customer.email<>'',false))
        or (customer_type in ('guest','new','walk_in','walkin') and coalesce(customer.registered or customer.auth_user_id is not null or customer.email<>'',false)) then
        valid:=false; reason:='voucher_scope_changed'; end if;
      voucher:=data||jsonb_build_object('id',coalesce(data->>'id',coupon.id::text),'code',code,'source','checkout',
        'discountType',coalesce(data->>'discountType',coupon.discount_type,'fixed'),
        'value',coalesce(data->'value',to_jsonb(coupon.value)),
        'minOrder',coalesce(data->'minOrder',to_jsonb(coupon.min_order)),
        'maxDiscount',coalesce(data->'maxDiscount',to_jsonb(coupon.max_discount)),
        'customerType',customer_type,'fulfillmentType',fulfillment,
        'startAt',coalesce(data->>'startAt',coupon.start_at::text,''),
        'endAt',coalesce(data->>'endAt',data->>'expiry',coupon.end_at::text,''),
        'active',coalesce(data->>'active',coupon.active::text,'true')<>'false');
    end if;
    branches:=coalesce(data->'branchUuids',data->'branch_uuids');
    if jsonb_typeof(branches)='array' and jsonb_array_length(branches)>0
      and not exists(select 1 from jsonb_array_elements_text(branches) x where lower(x)=branch::text) then
      valid:=false; reason:='voucher_branch_changed'; end if;
    if valid then discount:=least(subtotal,greatest(voucher_result.discount_amount,0)); end if;
  end if;
  ceiling_amount:=least(floor(greatest(subtotal-discount,0)*percent/100),loyalty_private.combined_benefit_points_limit(subtotal,discount));
  spent:=floor(least(floor(greatest(coalesce(account.total_points,0),0)/step)*step,
    floor(ceiling_amount/unit_value)*unit)/step)*step;
  spent:=least(spent,floor(requested/step)*step);
  point_amount:=least(ceiling_amount,floor(spent/unit)*unit_value);
  total:=greatest(subtotal-discount-point_amount,0);
  selected_key:=case when code<>'' and valid then coalesce(nullif(source,''),'checkout')||':'||
    coalesce(nullif(voucher_id,''),nullif(voucher->>'id',''),code) else '' end;
  quote:=jsonb_build_object('subtotal',subtotal,'voucherDiscount',discount,'pointsSpent',spent,
    'pointsDiscount',point_amount,'total',total,'voucherValid',valid,'reason',reason,'selectedVoucherKey',selected_key,
    'coupon',case when source<>'loyalty' and valid then voucher else null end,
    'customer',jsonb_build_object('ok',true,'phone',customer_phone_key,'customerName',coalesce(customer.name,''),
      'registeredCustomer',coalesce(customer.registered or customer.auth_user_id is not null or customer.email<>'',false),
      'loyalty',jsonb_build_object('phone',customer_phone_key,'totalPoints',coalesce(account.total_points,0)),
      'loyaltyRule',jsonb_build_object('redeemPointUnit',unit,'redeemValue',unit_value,'maxRedemptionPercent',percent),
      'availableVouchers',coalesce((select jsonb_agg(v) from (
        select value as v from jsonb_array_elements(coalesce(account.vouchers,'[]'))
        where coalesce(value->>'used','false')<>'true' and coalesce(value->>'canceled','false')<>'true'
          and coalesce(value->>'cancelled','false')<>'true'
        limit 8) active_vouchers),'[]'::jsonb)));
  if not valid or total<=0 or total is distinct from (p_session->>'amount_expected')::numeric
    or total is distinct from (p_order->>'total_amount')::numeric
    or discount is distinct from coalesce((p_order->>'promo_discount')::numeric,0)
    or spent is distinct from coalesce((p_order->>'points_discount')::numeric,0)
    or spent is distinct from coalesce((p_order#>>'{metadata,pointsSpent}')::numeric,0)
    or spent is distinct from coalesce((p_session#>>'{checkout_snapshot,pointsDiscount}')::numeric,0)
    or point_amount is distinct from coalesce((p_order#>>'{metadata,pointsDiscountAmount}')::numeric,0)
    or spent is distinct from requested then
    perform set_config('request.jwt.claims',claims,true);
    return jsonb_build_object('needs_confirmation',true,'quote',quote);
  end if;
  -- Amounts have been recomputed and match exactly. Preserve JSON shape so a
  -- retry has the same fingerprint (missing zero fields and numeric scales too).
  perform set_config('request.jwt.claims',claims,true);
  result:=public.create_pos_bank_checkout(p_actor,p_session,p_order,p_items);
  perform set_config('request.jwt.claims',claims,true);
  return result;
end $$;
revoke all on function public.create_pos_bank_checkout_v2(uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_pos_bank_checkout_v2(uuid,jsonb,jsonb,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
