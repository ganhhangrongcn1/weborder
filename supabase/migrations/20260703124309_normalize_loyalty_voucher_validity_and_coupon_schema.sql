-- Voucher phase 2.
-- Normalize coupon catalog fields and move loyalty voucher expiry to
-- "valid days after grant" instead of fixed coupon end dates.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.coupons
  add column if not exists valid_days_after_grant integer null;

create or replace function loyalty_private.normalize_coupon_valid_days_after_grant(
  p_code text,
  p_voucher_type text,
  p_candidate integer default null,
  p_fallback integer default 7
)
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_voucher_type text := lower(btrim(coalesce(p_voucher_type, 'checkout')));
  v_candidate integer := case
    when coalesce(p_candidate, 0) > 0 then least(greatest(p_candidate, 1), 60)
    else null
  end;
  v_fallback integer := least(greatest(coalesce(p_fallback, 7), 1), 60);
  v_welcome_days integer;
begin
  if v_voucher_type <> 'loyalty' then
    return null;
  end if;

  if v_candidate is not null then
    return v_candidate;
  end if;

  if v_code = 'CHAOBANMOI' then
    select case
      when btrim(coalesce(source_config ->> 'welcomeVoucherValidityDays', '')) ~ '^[0-9]+$'
        then least(greatest((source_config ->> 'welcomeVoucherValidityDays')::integer, 1), 60)
      else null
    end
    into v_welcome_days
    from public.loyalty_rule_versions
    where status = 'ACTIVE'
    order by effective_from desc, version_number desc
    limit 1;

    if v_welcome_days is not null then
      return v_welcome_days;
    end if;
  end if;

  return case v_code
    when 'CHOMGHIEN10' then 14
    when 'GHIENNHE12' then 21
    when 'GHIENTHIET15' then 30
    when 'GHIENCHINH20' then 30
    when 'HUYENTHOAI30' then 45
    else v_fallback
  end;
end;
$$;

create or replace function loyalty_private.resolve_coupon_validity_days(
  p_coupon public.coupons,
  p_fallback integer default 7
)
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_coupon_data jsonb := coalesce(p_coupon.data, '{}'::jsonb);
  v_voucher_type text := lower(coalesce(
    nullif(btrim(v_coupon_data ->> 'voucherType'), ''),
    nullif(btrim(p_coupon.voucher_type), ''),
    'checkout'
  ));
  v_candidate integer;
begin
  if btrim(coalesce(v_coupon_data ->> 'validDaysAfterGrant', '')) ~ '^[0-9]+$' then
    v_candidate := (v_coupon_data ->> 'validDaysAfterGrant')::integer;
  elsif coalesce(p_coupon.valid_days_after_grant, 0) > 0 then
    v_candidate := p_coupon.valid_days_after_grant;
  else
    v_candidate := null;
  end if;

  return loyalty_private.normalize_coupon_valid_days_after_grant(
    coalesce(nullif(btrim(v_coupon_data ->> 'code'), ''), p_coupon.code, ''),
    v_voucher_type,
    v_candidate,
    p_fallback
  );
end;
$$;

create or replace function loyalty_private.sync_coupon_canonical_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_data jsonb := case
    when jsonb_typeof(coalesce(new.data, '{}'::jsonb)) = 'object'
      then coalesce(new.data, '{}'::jsonb)
    else '{}'::jsonb
  end;
  v_code text;
  v_name text;
  v_discount_type text;
  v_voucher_type text;
  v_start_at text;
  v_end_at text;
  v_valid_days_candidate integer;
begin
  v_code := upper(btrim(coalesce(
    nullif(v_data ->> 'code', ''),
    nullif(new.code, ''),
    case when tg_op = 'UPDATE' then nullif(old.code, '') else null end,
    ''
  )));
  v_name := btrim(coalesce(
    nullif(v_data ->> 'name', ''),
    nullif(new.name, ''),
    case when tg_op = 'UPDATE' then nullif(old.name, '') else null end,
    'Mã giảm giá'
  ));
  v_discount_type := case
    when lower(btrim(coalesce(
      nullif(v_data ->> 'discountType', ''),
      nullif(new.discount_type, ''),
      case when tg_op = 'UPDATE' then nullif(old.discount_type, '') else null end,
      'fixed'
    ))) = 'percent' then 'percent'
    else 'fixed'
  end;
  v_voucher_type := case
    when lower(btrim(coalesce(
      nullif(v_data ->> 'voucherType', ''),
      nullif(new.voucher_type, ''),
      case when tg_op = 'UPDATE' then nullif(old.voucher_type, '') else null end,
      'checkout'
    ))) = 'loyalty' then 'loyalty'
    else 'checkout'
  end;
  v_start_at := '';
  if nullif(v_data ->> 'startAt', '') is not null then
    v_start_at := left(btrim(v_data ->> 'startAt'), 10);
  elsif new.start_at is not null then
    v_start_at := new.start_at::text;
  elsif tg_op = 'UPDATE' and old.start_at is not null then
    v_start_at := old.start_at::text;
  end if;

  v_end_at := '';
  if nullif(v_data ->> 'endAt', '') is not null then
    v_end_at := left(btrim(v_data ->> 'endAt'), 10);
  elsif nullif(v_data ->> 'expiry', '') is not null then
    v_end_at := left(btrim(v_data ->> 'expiry'), 10);
  elsif new.end_at is not null then
    v_end_at := new.end_at::text;
  elsif tg_op = 'UPDATE' and old.end_at is not null then
    v_end_at := old.end_at::text;
  end if;
  v_valid_days_candidate := case
    when btrim(coalesce(v_data ->> 'validDaysAfterGrant', '')) ~ '^[0-9]+$'
      then least(greatest((v_data ->> 'validDaysAfterGrant')::integer, 1), 60)
    when coalesce(new.valid_days_after_grant, 0) > 0
      then least(greatest(new.valid_days_after_grant, 1), 60)
    else null
  end;

  new.code := nullif(v_code, '');
  new.name := v_name;
  new.discount_type := v_discount_type;
  new.value := loyalty_private.safe_nonnegative_numeric(v_data ->> 'value', new.value);
  new.max_discount := loyalty_private.safe_nonnegative_numeric(v_data ->> 'maxDiscount', new.max_discount);
  new.min_order := loyalty_private.safe_nonnegative_numeric(v_data ->> 'minOrder', new.min_order);
  new.customer_type := btrim(coalesce(
    nullif(v_data ->> 'customerType', ''),
    nullif(new.customer_type, ''),
    'all'
  ));
  new.usage_limit := floor(loyalty_private.safe_nonnegative_numeric(v_data ->> 'usageLimit', new.usage_limit))::integer;
  new.per_user_limit := greatest(
    1,
    floor(loyalty_private.safe_nonnegative_numeric(v_data ->> 'perUserLimit', new.per_user_limit))::integer
  );
  new.total_used := floor(loyalty_private.safe_nonnegative_numeric(v_data ->> 'totalUsed', new.total_used))::integer;
  new.voucher_type := v_voucher_type;
  new.valid_days_after_grant := case
    when v_voucher_type = 'loyalty' then loyalty_private.normalize_coupon_valid_days_after_grant(
      new.code,
      v_voucher_type,
      v_valid_days_candidate,
      7
    )
    else null
  end;
  new.fulfillment_type := btrim(coalesce(
    nullif(v_data ->> 'fulfillmentType', ''),
    nullif(new.fulfillment_type, ''),
    'all'
  ));
  new.scope_type := btrim(coalesce(
    nullif(v_data ->> 'scopeType', ''),
    nullif(new.scope_type, ''),
    'all'
  ));
  new.scope_values := btrim(coalesce(
    nullif(v_data ->> 'scopeValues', ''),
    nullif(new.scope_values, ''),
    ''
  ));
  new.stackable := lower(btrim(coalesce(
    nullif(v_data ->> 'stackable', ''),
    new.stackable::text,
    'false'
  ))) = 'true';
  new.active := lower(btrim(coalesce(
    nullif(v_data ->> 'active', ''),
    new.active::text,
    'true'
  ))) <> 'false';
  if v_start_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    new.start_at := v_start_at;
  elsif btrim(coalesce(new.start_at::text, '')) <> '' then
    new.start_at := new.start_at::text;
  elsif tg_op = 'UPDATE' and btrim(coalesce(old.start_at::text, '')) <> '' then
    new.start_at := old.start_at::text;
  else
    new.start_at := to_char(coalesce(new.updated_at, now()) at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
  end if;
  new.end_at := case
    when v_voucher_type = 'loyalty' then new.start_at
    when v_end_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then v_end_at
    when btrim(coalesce(new.end_at::text, '')) <> '' then new.end_at::text
    when tg_op = 'UPDATE' and btrim(coalesce(old.end_at::text, '')) <> '' then old.end_at::text
    else new.start_at
  end;
  new.data := jsonb_strip_nulls(
    (v_data - 'endAt' - 'expiry' - 'validDaysAfterGrant')
    || jsonb_build_object(
      'id', coalesce(nullif(v_data ->> 'id', ''), coalesce(new.id::text, new.code, '')),
      'code', new.code,
      'name', new.name,
      'discountType', new.discount_type,
      'value', coalesce(new.value, 0),
      'maxDiscount', coalesce(new.max_discount, 0),
      'minOrder', coalesce(new.min_order, 0),
      'customerType', coalesce(new.customer_type, 'all'),
      'usageLimit', coalesce(new.usage_limit, 0),
      'perUserLimit', greatest(coalesce(new.per_user_limit, 1), 1),
      'totalUsed', coalesce(new.total_used, 0),
      'voucherType', new.voucher_type,
      'fulfillmentType', coalesce(new.fulfillment_type, 'all'),
      'scopeType', coalesce(new.scope_type, 'all'),
      'scopeValues', coalesce(new.scope_values, ''),
      'stackable', coalesce(new.stackable, false),
      'active', coalesce(new.active, true)
    )
    || case
      when new.start_at is not null then jsonb_build_object('startAt', new.start_at)
      else '{}'::jsonb
    end
    || case
      when new.voucher_type = 'loyalty'
        and new.valid_days_after_grant is not null
        then jsonb_build_object('validDaysAfterGrant', new.valid_days_after_grant)
      else '{}'::jsonb
    end
    || case
      when new.voucher_type <> 'loyalty'
        and new.end_at is not null
        then jsonb_build_object('endAt', new.end_at, 'expiry', new.end_at)
      else '{}'::jsonb
    end
  );
  return new;
end;
$$;

drop trigger if exists trg_coupons_sync_canonical_fields on public.coupons;
create trigger trg_coupons_sync_canonical_fields
before insert or update on public.coupons
for each row
execute function loyalty_private.sync_coupon_canonical_fields();

update public.coupons
set data = case
  when jsonb_typeof(coalesce(data, '{}'::jsonb)) = 'object'
    then coalesce(data, '{}'::jsonb)
  else '{}'::jsonb
end;

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
  v_start_at text;
  v_validity_days integer := 7;
  v_expired_at date;
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
$$;

revoke all on function loyalty_private.normalize_coupon_valid_days_after_grant(text, text, integer, integer)
from public, anon, authenticated;
revoke all on function loyalty_private.resolve_coupon_validity_days(public.coupons, integer)
from public, anon, authenticated;
revoke all on function loyalty_private.sync_coupon_canonical_fields()
from public, anon, authenticated;
revoke all on function loyalty_private.grant_registration_welcome_voucher(text, timestamptz)
from public, anon, authenticated;
revoke all on function loyalty_private.grant_current_monthly_tier_voucher(text, timestamptz)
from public, anon, authenticated;

comment on function loyalty_private.sync_coupon_canonical_fields() is
  'Normalizes coupon catalog fields and enforces valid_days_after_grant for loyalty vouchers.';
comment on function loyalty_private.grant_registration_welcome_voucher(text, timestamptz) is
  'Grants the configured welcome loyalty voucher once using valid days after grant.';
comment on function loyalty_private.grant_current_monthly_tier_voucher(text, timestamptz) is
  'Grants one monthly tier voucher using the template valid days after grant.';

notify pgrst, 'reload schema';

commit;
