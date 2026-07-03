-- Fix loyalty voucher grants for newly registered customers and monthly tiers.
-- Business rules:
-- 1. Registration voucher is granted once, including customers with pre-existing order profiles.
-- 2. Tier voucher is granted once per customer + tier + Vietnam calendar month.
-- 3. Tier vouchers expire seven days after they are granted.

begin;

create index if not exists coupons_data_app_id_idx
on public.coupons ((data ->> 'id'))
where data ? 'id';

create or replace function loyalty_private.resolve_configured_coupon(
  p_reference text
)
returns public.coupons
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select c
  from public.coupons c
  where trim(coalesce(p_reference, '')) <> ''
    and (
      c.id::text = trim(p_reference)
      or trim(coalesce(c.data ->> 'id', '')) = trim(p_reference)
      or upper(trim(coalesce(c.code, ''))) = upper(trim(p_reference))
      or upper(trim(coalesce(c.data ->> 'code', ''))) = upper(trim(p_reference))
    )
  order by
    case
      when c.id::text = trim(p_reference) then 0
      when trim(coalesce(c.data ->> 'id', '')) = trim(p_reference) then 1
      when upper(trim(coalesce(c.code, ''))) = upper(trim(p_reference)) then 2
      else 3
    end,
    c.updated_at desc nulls last
  limit 1;
$$;

create or replace function loyalty_private.grant_registration_welcome_voucher(
  p_phone text,
  p_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_phone text := public.normalize_vietnam_phone(p_phone);
  v_rule public.loyalty_rule_versions%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_coupon public.coupons%rowtype;
  v_coupon_data jsonb;
  v_coupon_ref text;
  v_start_at text;
  v_end_at text;
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
  v_end_at := coalesce(
    nullif(v_coupon_data ->> 'endAt', ''),
    nullif(v_coupon_data ->> 'expiry', ''),
    nullif(v_coupon.end_at::text, '')
  );

  if v_start_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and v_created_at < v_start_at::date
  then
    return false;
  end if;
  if v_end_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and v_created_at > v_end_at::date
  then
    return false;
  end if;

  if coalesce(v_rule.source_config ->> 'welcomeVoucherValidityDays', '') ~ '^[0-9]+$' then
    v_validity_days := greatest(
      1,
      least((v_rule.source_config ->> 'welcomeVoucherValidityDays')::integer, 60)
    );
  end if;
  v_expired_at := case
    when v_end_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then v_end_at::date
    else v_created_at + v_validity_days
  end;

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
$$;

create or replace function loyalty_private.grant_current_monthly_tier_voucher(
  p_phone text,
  p_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
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
  v_expired_at date := ((p_at at time zone 'Asia/Ho_Chi_Minh')::date + interval '7 days')::date;
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
$$;

create or replace function loyalty_private.grant_registration_loyalty_vouchers()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
begin
  if coalesce(new.registered, false) is not true then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and coalesce(old.registered, false) is true
    and public.normalize_vietnam_phone(old.phone) = public.normalize_vietnam_phone(new.phone)
  then
    return new;
  end if;

  perform loyalty_private.grant_registration_welcome_voucher(new.phone, now());
  perform loyalty_private.grant_current_monthly_tier_voucher(new.phone, now());
  return new;
end;
$$;

drop trigger if exists trg_profiles_grant_registration_loyalty_vouchers on public.profiles;
create trigger trg_profiles_grant_registration_loyalty_vouchers
after insert or update of registered, phone on public.profiles
for each row execute function loyalty_private.grant_registration_loyalty_vouchers();

create or replace function loyalty_private.grant_monthly_tier_voucher_after_ledger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
begin
  if new.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN') then
    perform loyalty_private.grant_current_monthly_tier_voucher(new.customer_phone, new.created_at);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_loyalty_program_after_ledger_monthly_voucher on public.loyalty_ledger;
create trigger trg_loyalty_program_after_ledger_monthly_voucher
after insert on public.loyalty_ledger
for each row execute function loyalty_private.grant_monthly_tier_voucher_after_ledger();

revoke all on function loyalty_private.resolve_configured_coupon(text)
from public, anon, authenticated;
revoke all on function loyalty_private.grant_registration_welcome_voucher(text, timestamptz)
from public, anon, authenticated;
revoke all on function loyalty_private.grant_current_monthly_tier_voucher(text, timestamptz)
from public, anon, authenticated;
revoke all on function loyalty_private.grant_registration_loyalty_vouchers()
from public, anon, authenticated;
revoke all on function loyalty_private.grant_monthly_tier_voucher_after_ledger()
from public, anon, authenticated;

comment on function loyalty_private.grant_registration_welcome_voucher(text, timestamptz) is
  'Grants the configured welcome voucher once after a customer becomes registered.';
comment on function loyalty_private.grant_current_monthly_tier_voucher(text, timestamptz) is
  'Grants one seven-day voucher per customer, tier, and Vietnam calendar month.';

notify pgrst, 'reload schema';

commit;
