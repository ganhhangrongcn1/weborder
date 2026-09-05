-- Restore welcome vouchers only. Monthly tier voucher policy stays disabled.
update public.app_configs set value = jsonb_set(value, '{welcomeVoucherEnabled}', 'true'::jsonb), updated_at = now() where id = 'ghr_loyalty';

CREATE OR REPLACE FUNCTION loyalty_private.grant_registration_welcome_voucher(p_phone text, p_at timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'loyalty_private'
AS $function$
declare
  v_phone text := public.normalize_vietnam_phone(p_phone);
  v_rule public.loyalty_rule_versions%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_coupon public.coupons%rowtype;
  v_coupon_data jsonb;
  v_coupon_ref text;
  v_start_at text;
  v_created_at date := (p_at at time zone 'Asia/Ho_Chi_Minh')::date;
  v_expired_at date;
  v_validity_days integer := 7;
  v_voucher jsonb;
begin
  if v_phone = '' then
    return false;
  end if;

  select * into v_rule
  from public.loyalty_rule_versions
  where status = 'ACTIVE' and effective_from <= p_at
  order by effective_from desc, version_number desc
  limit 1;

  if not found
    or lower(coalesce(v_rule.source_config ->> 'welcomeVoucherEnabled', 'false')) <> 'true'
  then
    return false;
  end if;

  v_coupon_ref := trim(coalesce(v_rule.source_config ->> 'welcomeVoucherId', ''));
  if v_coupon_ref = '' then
    return false;
  end if;

  v_account := loyalty_private.rollover_loyalty_account(v_phone, v_rule, p_at);
  if v_account.customer_phone is null then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_account.vouchers, '[]'::jsonb)) as item
    where upper(trim(coalesce(item ->> 'type', ''))) = 'WELCOME_REGISTER'
  ) then
    return false;
  end if;

  v_coupon := loyalty_private.resolve_configured_coupon(v_coupon_ref);
  if v_coupon.id is null then
    return false;
  end if;

  v_coupon_data := coalesce(v_coupon.data, '{}'::jsonb);
  if lower(coalesce(nullif(v_coupon_data ->> 'voucherType', ''), nullif(v_coupon.voucher_type, ''), 'checkout')) <> 'loyalty'
    or lower(coalesce(nullif(v_coupon_data ->> 'active', ''), v_coupon.active::text, 'true')) = 'false'
  then
    return false;
  end if;

  v_start_at := coalesce(nullif(v_coupon_data ->> 'startAt', ''), nullif(v_coupon.start_at::text, ''));
  if v_start_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and v_created_at < v_start_at::date
  then
    return false;
  end if;

  if coalesce(v_rule.source_config ->> 'welcomeVoucherValidityDays', '') ~ '^[0-9]+$' then
    v_validity_days := greatest(
      1,
      least((v_rule.source_config ->> 'welcomeVoucherValidityDays')::integer, 60)
    );
  end if;
  v_validity_days := loyalty_private.resolve_coupon_validity_days(v_coupon, v_validity_days);
  v_expired_at := v_created_at + v_validity_days;

  v_voucher := jsonb_build_object(
    'id', 'welcome-register-' || substr(md5(v_phone), 1, 12),
    'type', 'WELCOME_REGISTER',
    'couponId', coalesce(nullif(v_coupon_data ->> 'id', ''), v_coupon.id::text),
    'code', upper(coalesce(nullif(v_coupon_data ->> 'code', ''), v_coupon.code, '')),
    'title', coalesce(
      nullif(v_coupon_data ->> 'name', ''),
      nullif(v_coupon.name, ''),
      'Voucher chào thành viên mới'
    ),
    'discountType', coalesce(
      nullif(v_coupon_data ->> 'discountType', ''),
      nullif(v_coupon.discount_type, ''),
      'fixed'
    ),
    'value', coalesce(nullif(v_coupon_data ->> 'value', '')::numeric, v_coupon.value, 0),
    'maxDiscount', coalesce(
      nullif(v_coupon_data ->> 'maxDiscount', '')::numeric,
      v_coupon.max_discount,
      0
    ),
    'minOrder', coalesce(nullif(v_coupon_data ->> 'minOrder', '')::numeric, v_coupon.min_order, 0),
    'createdAt', v_created_at::text,
    'validDaysAfterGrant', v_validity_days,
    'expiredAt', v_expired_at::text,
    'used', false,
    'canceled', false,
    'orderCode', ''
  );

  update public.loyalty_accounts
  set
    vouchers = jsonb_build_array(v_voucher) || coalesce(vouchers, '[]'::jsonb),
    updated_at = now()
  where customer_phone = v_phone;

  return found;
end;
$function$;
