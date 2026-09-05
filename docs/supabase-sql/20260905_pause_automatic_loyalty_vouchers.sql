-- Pause new welcome and monthly tier vouchers; preserve existing wallets and point rules.
-- Re-enable only together with the customer/admin UI and client feature flag.
insert into public.app_configs (id, value, updated_at)
values ('ghr_automatic_voucher_policy', '{"enabled": false}'::jsonb, now())
on conflict (id) do update
set value = coalesce(public.app_configs.value, '{}'::jsonb) || excluded.value,
    updated_at = now();

-- Stops older website clients that still call the welcome-voucher service.
update public.app_configs
set value = jsonb_set(value, '{welcomeVoucherEnabled}', 'false'::jsonb),
    updated_at = now()
where id = 'ghr_loyalty' and jsonb_typeof(value) = 'object';

create or replace function loyalty_private.automatic_vouchers_enabled()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select coalesce((
    select value -> 'enabled' = 'true'::jsonb
    from public.app_configs
    where id = 'ghr_automatic_voucher_policy'
  ), false);
$function$;

revoke all on function loyalty_private.automatic_vouchers_enabled() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION loyalty_private.grant_current_monthly_tier_voucher(p_phone text, p_at timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'loyalty_private'
AS $function$
declare
  v_phone text := public.normalize_vietnam_phone(p_phone);
  v_rule public.loyalty_rule_versions%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_tier jsonb;
  v_tier_id text;
  v_coupon public.coupons%rowtype;
  v_coupon_data jsonb;
  v_coupon_ref text;
  v_grant_id uuid;
  v_grant_month text := to_char(p_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM');
  v_created_at date := (p_at at time zone 'Asia/Ho_Chi_Minh')::date;
  v_start_at text;
  v_validity_days integer := 7;
  v_expired_at date;
  v_voucher jsonb;
begin
  if not loyalty_private.automatic_vouchers_enabled() then
    return false;
  end if;
  if v_phone = '' then
    return false;
  end if;

  select * into v_rule
  from public.loyalty_rule_versions
  where status = 'ACTIVE' and effective_from <= p_at
  order by effective_from desc, version_number desc
  limit 1;

  if not found then
    return false;
  end if;

  v_account := loyalty_private.rollover_loyalty_account(v_phone, v_rule, p_at);
  if v_account.customer_phone is null then
    return false;
  end if;

  select value into v_tier
  from jsonb_array_elements(coalesce(v_rule.source_config -> 'tiers', '[]'::jsonb))
  where value ->> 'id' = v_account.tier_id
  limit 1;

  v_tier := coalesce(
    v_tier,
    loyalty_private.resolve_program_tier(v_rule, v_account.tier_qualifying_spend)
  );
  v_tier_id := trim(coalesce(v_tier ->> 'id', ''));
  v_coupon_ref := trim(coalesce(v_tier ->> 'milestoneVoucherId', ''));
  if v_tier_id = '' or v_coupon_ref = '' then
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

  v_validity_days := loyalty_private.resolve_coupon_validity_days(v_coupon, 7);
  v_expired_at := v_created_at + v_validity_days;

  v_voucher := jsonb_build_object(
    'id', 'tier-' || v_tier_id || '-' || v_grant_month,
    'type', 'TIER_MONTHLY',
    'couponId', coalesce(nullif(v_coupon_data ->> 'id', ''), v_coupon.id::text),
    'code', upper(coalesce(nullif(v_coupon_data ->> 'code', ''), v_coupon.code, '')),
    'title', coalesce(
      nullif(v_coupon_data ->> 'name', ''),
      nullif(v_coupon.name, ''),
      nullif(v_tier ->> 'name', ''),
      'Voucher hạng thành viên'
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
    'tierId', v_tier_id,
    'cycleYear', v_account.tier_cycle_year,
    'grantMonth', v_grant_month
  );

  insert into public.loyalty_milestone_grants (
    customer_phone,
    tier_id,
    cycle_year,
    grant_month,
    coupon_id,
    voucher_data,
    rule_version_id
  ) values (
    v_phone,
    v_tier_id,
    v_account.tier_cycle_year,
    v_grant_month,
    coalesce(nullif(v_coupon_data ->> 'id', ''), v_coupon.id::text),
    v_voucher,
    v_rule.id
  )
  on conflict (customer_phone, tier_id, grant_month) do nothing
  returning id into v_grant_id;

  if v_grant_id is null then
    return false;
  end if;

  update public.loyalty_accounts
  set
    vouchers = coalesce(vouchers, '[]'::jsonb) || jsonb_build_array(v_voucher),
    updated_at = now()
  where customer_phone = v_phone;

  return true;
end;
$function$;

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
  if not loyalty_private.automatic_vouchers_enabled() then
    return false;
  end if;
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

CREATE OR REPLACE FUNCTION loyalty_private.apply_loyalty_account_lifecycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'loyalty_private'
AS $function$
declare
  v_rule public.loyalty_rule_versions%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_candidate jsonb;
  v_previous_tier_id text;
  v_next_tier_id text;
  v_coupon_id text;
  v_coupon public.coupons%rowtype;
  v_voucher jsonb;
  v_grant_id uuid;
  v_grant_month text;
  v_expired_at date;
begin
  if new.action not in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN', 'REVERSE_EARN') then
    return new;
  end if;

  select * into v_rule
  from public.loyalty_rule_versions
  where id = new.rule_version_id
  limit 1;

  if not found then
    select * into v_rule
    from public.loyalty_rule_versions
    where status = 'ACTIVE' and effective_from <= now()
    order by effective_from desc, version_number desc
    limit 1;
  end if;

  v_account := loyalty_private.rollover_loyalty_account(new.customer_phone, v_rule, new.created_at);
  v_previous_tier_id := coalesce(
    nullif(v_account.tier_id, ''),
    loyalty_private.resolve_program_tier(v_rule, 0) ->> 'id'
  );

  if new.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN') then
    update public.loyalty_accounts
    set
      tier_qualifying_spend = greatest(
        coalesce(tier_qualifying_spend, 0) + greatest(coalesce(new.amount, 0), 0),
        0
      ),
      tier_qualifying_order_count = greatest(coalesce(tier_qualifying_order_count, 0) + 1, 0),
      last_purchase_at = greatest(coalesce(last_purchase_at, new.created_at), new.created_at),

      updated_at = now()
    where customer_phone = public.normalize_vietnam_phone(new.customer_phone)
    returning * into v_account;

    v_candidate := loyalty_private.resolve_program_tier(v_rule, v_account.tier_qualifying_spend);
    v_next_tier_id := v_candidate ->> 'id';

    if loyalty_private.program_tier_position(v_rule, v_next_tier_id)
      > loyalty_private.program_tier_position(v_rule, v_previous_tier_id)
    then
      update public.loyalty_accounts
      set
        tier_id = v_next_tier_id,
        tier_qualified_at = new.created_at,
        updated_at = now()
      where customer_phone = public.normalize_vietnam_phone(new.customer_phone)
      returning * into v_account;
    end if;

    -- Monthly tier voucher: once per customer + tier + Vietnam calendar month.
    -- If the customer upgrades again in the same month, the new tier is a new grant key.
    v_coupon_id := trim(coalesce(v_candidate ->> 'milestoneVoucherId', ''));
    if v_coupon_id <> '' and loyalty_private.automatic_vouchers_enabled() then
      select * into v_coupon
      from public.coupons c
      where c.id::text = v_coupon_id
      limit 1;

      if found then
        v_grant_month := to_char(new.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM');
        v_expired_at := ((new.created_at at time zone 'Asia/Ho_Chi_Minh')::date + interval '7 days')::date;

        v_voucher := jsonb_build_object(
          'id', 'tier-' || v_next_tier_id || '-' || v_grant_month,
          'type', 'TIER_MONTHLY',
          'couponId', v_coupon.id::text,
          'code', coalesce(v_coupon.code, ''),
          'title', coalesce(v_coupon.name, v_candidate ->> 'name'),
          'discountType', coalesce(v_coupon.discount_type, ''),
          'value', coalesce(v_coupon.value, 0),
          'maxDiscount', coalesce(v_coupon.max_discount, 0),
          'minOrder', coalesce(v_coupon.min_order, 0),
          'createdAt', (new.created_at at time zone 'Asia/Ho_Chi_Minh')::date::text,
          'expiredAt', v_expired_at::text,
          'used', false,
          'tierId', v_next_tier_id,
          'cycleYear', v_account.tier_cycle_year,
          'grantMonth', v_grant_month
        );

        insert into public.loyalty_milestone_grants (
          customer_phone, tier_id, cycle_year, grant_month, coupon_id,
          voucher_data, rule_version_id
        ) values (
          public.normalize_vietnam_phone(new.customer_phone),
          v_next_tier_id, v_account.tier_cycle_year, v_grant_month, v_coupon.id::text,
          v_voucher, v_rule.id
        )
        on conflict (customer_phone, tier_id, grant_month) do nothing
        returning id into v_grant_id;

        if v_grant_id is not null then
          update public.loyalty_accounts
          set
            vouchers = coalesce(vouchers, '[]'::jsonb) || jsonb_build_array(v_voucher),
            updated_at = now()
          where customer_phone = public.normalize_vietnam_phone(new.customer_phone);
        end if;
      end if;
    end if;
  else
    update public.loyalty_accounts
    set
      tier_qualifying_spend = greatest(
        coalesce(tier_qualifying_spend, 0) - greatest(coalesce(new.amount, 0), 0),
        0
      ),
      tier_qualifying_order_count = greatest(coalesce(tier_qualifying_order_count, 0) - 1, 0),
      updated_at = now()
    where customer_phone = public.normalize_vietnam_phone(new.customer_phone);
  end if;

  return new;
end;
$function$;
