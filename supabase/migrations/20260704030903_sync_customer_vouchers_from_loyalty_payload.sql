-- Sync loyalty voucher writes into normalized customer_vouchers.
-- Keeps loyalty_accounts.vouchers as the compatibility payload while making
-- customer_vouchers the operational source for CRM reads.

create or replace function loyalty_private.try_parse_timestamptz(p_value text)
returns timestamptz
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then
    return null;
  end if;

  return p_value::timestamptz;
exception
  when others then
    return null;
end;
$$;

create or replace function loyalty_private.sync_customer_vouchers_from_jsonb(
  p_customer_phone text,
  p_vouchers jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_phone text := public.normalize_vietnam_phone(p_customer_phone);
  v_profile_id uuid;
  v_vouchers jsonb;
  v_metadata jsonb;
  v_rows integer := 0;
begin
  if coalesce(v_phone, '') = '' then
    return 0;
  end if;

  v_vouchers := case
    when jsonb_typeof(coalesce(p_vouchers, '[]'::jsonb)) = 'array' then coalesce(p_vouchers, '[]'::jsonb)
    else '[]'::jsonb
  end;
  v_metadata := case
    when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object' then coalesce(p_metadata, '{}'::jsonb)
    else '{}'::jsonb
  end;

  insert into public.profiles (
    phone,
    registered,
    role,
    status,
    metadata
  )
  values (
    v_phone,
    false,
    'customer',
    'active',
    jsonb_build_object('source', 'loyalty_voucher_sync')
  )
  on conflict (phone) do update
  set metadata = coalesce(public.profiles.metadata, '{}'::jsonb)
      || jsonb_build_object('last_loyalty_touch', 'loyalty_voucher_sync'),
      updated_at = now();

  select id
  into v_profile_id
  from public.profiles
  where public.normalize_vietnam_phone(phone) = v_phone
  order by updated_at desc nulls last, id
  limit 1;

  if v_profile_id is null then
    return 0;
  end if;

  with source_rows as (
    select
      v_profile_id as profile_id,
      v_phone as customer_phone,
      voucher.value as legacy_payload,
      voucher.ordinality as voucher_ordinality,
      coalesce(
        nullif(btrim(coalesce(voucher.value ->> 'id', '')), ''),
        'legacy-backfill-' || md5(
          concat_ws(
            '|',
            v_phone,
            voucher.ordinality::text,
            coalesce(voucher.value ->> 'code', ''),
            coalesce(voucher.value ->> 'createdAt', ''),
            coalesce(voucher.value ->> 'title', ''),
            coalesce(voucher.value ->> 'couponId', '')
          )
        )
      ) as voucher_instance_id,
      case
        when btrim(coalesce(voucher.value ->> 'couponId', '')) ~ '^[0-9]+$'
          then (voucher.value ->> 'couponId')::bigint
        else null
      end as coupon_lookup_id,
      coalesce(
        nullif(upper(btrim(coalesce(voucher.value ->> 'code', ''))), ''),
        case
          when btrim(coalesce(voucher.value ->> 'couponId', '')) ~ '^[0-9]+$' then null
          else nullif(upper(btrim(replace(coalesce(voucher.value ->> 'couponId', ''), 'coupon-', ''))), '')
        end
      ) as coupon_lookup_code,
      coalesce(
        loyalty_private.try_parse_timestamptz(voucher.value ->> 'createdAt'),
        loyalty_private.try_parse_timestamptz(voucher.value ->> 'grantedAt'),
        loyalty_private.try_parse_timestamptz(voucher.value ->> 'created_at'),
        now()
      ) as granted_at,
      loyalty_private.try_parse_timestamptz(voucher.value ->> 'usedAt') as used_at,
      loyalty_private.try_parse_timestamptz(voucher.value ->> 'canceledAt') as canceled_at,
      loyalty_private.try_parse_timestamptz(voucher.value ->> 'expiredAt') as explicit_expires_at,
      case
        when btrim(coalesce(voucher.value ->> 'validDaysAfterGrant', '')) ~ '^[0-9]+$'
          then least(greatest((voucher.value ->> 'validDaysAfterGrant')::integer, 0), 3650)
        else 0
      end as valid_days_after_grant,
      case
        when btrim(coalesce(voucher.value ->> 'discountValue', '')) ~ '^-?[0-9]+(\.[0-9]+)?$'
          then greatest((voucher.value ->> 'discountValue')::numeric, 0)
        when btrim(coalesce(voucher.value ->> 'value', '')) ~ '^-?[0-9]+(\.[0-9]+)?$'
          then greatest((voucher.value ->> 'value')::numeric, 0)
        else 0
      end as discount_value,
      case
        when btrim(coalesce(voucher.value ->> 'maxDiscount', '')) ~ '^-?[0-9]+(\.[0-9]+)?$'
          then greatest((voucher.value ->> 'maxDiscount')::numeric, 0)
        else 0
      end as max_discount,
      case
        when btrim(coalesce(voucher.value ->> 'minOrder', '')) ~ '^-?[0-9]+(\.[0-9]+)?$'
          then greatest((voucher.value ->> 'minOrder')::numeric, 0)
        else 0
      end as min_order,
      coalesce(nullif(lower(btrim(coalesce(voucher.value ->> 'discountType', ''))), ''), 'fixed') as discount_type,
      coalesce(nullif(lower(btrim(coalesce(voucher.value ->> 'voucherType', ''))), ''), 'loyalty') as voucher_type,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'managementGroup', '')), ''), 'legacy_loyalty') as management_group,
      coalesce(nullif(upper(btrim(coalesce(voucher.value ->> 'code', ''))), ''), '') as voucher_code,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'title', '')), ''), nullif(btrim(coalesce(voucher.value ->> 'name', '')), ''), 'Voucher loyalty') as voucher_name,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'grantSourceType', voucher.value ->> 'sourceType', '')), ''), nullif(btrim(coalesce(v_metadata ->> 'sourceType', '')), ''), 'loyalty_sync') as source_type,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'grantSourceLabel', voucher.value ->> 'sourceLabel', '')), ''), nullif(btrim(coalesce(v_metadata ->> 'sourceLabel', '')), ''), 'Đồng bộ voucher') as source_label,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'grantCampaignKey', voucher.value ->> 'campaignKey', '')), ''), nullif(btrim(coalesce(v_metadata ->> 'campaignKey', '')), ''), 'loyalty_voucher') as campaign_key,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'grantCampaignLabel', voucher.value ->> 'campaignLabel', '')), ''), nullif(btrim(coalesce(v_metadata ->> 'campaignLabel', '')), ''), 'Voucher loyalty') as campaign_label,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'grantAudience', voucher.value ->> 'campaignAudience', '')), ''), nullif(btrim(coalesce(v_metadata ->> 'audience', '')), ''), 'existing_customer') as audience,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'grantBatchId', voucher.value ->> 'batchId', '')), ''), nullif(btrim(coalesce(v_metadata ->> 'batchId', '')), ''), '') as batch_id,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'usedOrderId', voucher.value ->> 'orderId', '')), ''), '') as used_order_id,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'usedOrderCode', voucher.value ->> 'orderCode', '')), ''), '') as used_order_code
    from jsonb_array_elements(v_vouchers) with ordinality as voucher(value, ordinality)
  ),
  prepared_rows as (
    select
      sr.profile_id,
      sr.customer_phone,
      sr.voucher_instance_id,
      sr.coupon_lookup_id,
      sr.coupon_lookup_code,
      sr.batch_id,
      sr.voucher_code,
      sr.voucher_name,
      sr.voucher_type,
      sr.management_group,
      sr.discount_type,
      sr.discount_value,
      sr.max_discount,
      sr.min_order,
      sr.valid_days_after_grant,
      case
        when lower(coalesce(sr.legacy_payload ->> 'canceled', 'false')) = 'true' then 'canceled'
        when lower(coalesce(sr.legacy_payload ->> 'used', 'false')) = 'true' then 'used'
        when coalesce(sr.explicit_expires_at, sr.granted_at + make_interval(days => sr.valid_days_after_grant)) < now() then 'expired'
        else 'active'
      end as status,
      sr.source_type,
      sr.source_label,
      sr.campaign_key,
      sr.campaign_label,
      sr.audience,
      sr.granted_at,
      coalesce(sr.explicit_expires_at, sr.granted_at + make_interval(days => sr.valid_days_after_grant)) as expires_at,
      case
        when lower(coalesce(sr.legacy_payload ->> 'used', 'false')) = 'true' then coalesce(sr.granted_at, now())
        else loyalty_private.try_parse_timestamptz(sr.legacy_payload ->> 'usedAt')
      end as used_at,
      sr.used_order_id,
      sr.used_order_code,
      loyalty_private.try_parse_timestamptz(sr.legacy_payload ->> 'canceledAt') as canceled_at,
      jsonb_strip_nulls(jsonb_build_object(
        'sourcePhone', v_phone,
        'sourceType', sr.source_type,
        'sourceLabel', sr.source_label,
        'campaignKey', sr.campaign_key,
        'campaignLabel', sr.campaign_label,
        'audience', sr.audience,
        'migratedAt', now()
      )) as metadata,
      sr.legacy_payload
    from source_rows sr
  )
  insert into public.customer_vouchers (
    voucher_instance_id,
    profile_id,
    customer_phone,
    voucher_template_id,
    batch_id,
    voucher_code,
    voucher_name,
    voucher_type,
    management_group,
    discount_type,
    discount_value,
    max_discount,
    min_order,
    valid_days_after_grant,
    status,
    source_type,
    source_label,
    campaign_key,
    campaign_label,
    audience,
    granted_at,
    expires_at,
    used_at,
    used_order_id,
    used_order_code,
    canceled_at,
    metadata,
    legacy_payload,
    created_at,
    updated_at
  )
  select
    pr.voucher_instance_id,
    pr.profile_id,
    pr.customer_phone,
    coupon.id,
    pr.batch_id,
    pr.voucher_code,
    pr.voucher_name,
    pr.voucher_type,
    pr.management_group,
    pr.discount_type,
    pr.discount_value,
    pr.max_discount,
    pr.min_order,
    pr.valid_days_after_grant,
    pr.status,
    pr.source_type,
    pr.source_label,
    pr.campaign_key,
    pr.campaign_label,
    pr.audience,
    pr.granted_at,
    pr.expires_at,
    pr.used_at,
    pr.used_order_id,
    pr.used_order_code,
    pr.canceled_at,
    pr.metadata,
    pr.legacy_payload,
    coalesce(pr.granted_at, now()),
    now()
  from prepared_rows pr
  left join public.coupons coupon
    on coupon.id = pr.coupon_lookup_id
    or upper(coupon.code) = pr.coupon_lookup_code
  on conflict (profile_id, voucher_instance_id) do update
  set
    customer_phone = excluded.customer_phone,
    voucher_template_id = excluded.voucher_template_id,
    batch_id = excluded.batch_id,
    voucher_code = excluded.voucher_code,
    voucher_name = excluded.voucher_name,
    voucher_type = excluded.voucher_type,
    management_group = excluded.management_group,
    discount_type = excluded.discount_type,
    discount_value = excluded.discount_value,
    max_discount = excluded.max_discount,
    min_order = excluded.min_order,
    valid_days_after_grant = excluded.valid_days_after_grant,
    status = excluded.status,
    source_type = excluded.source_type,
    source_label = excluded.source_label,
    campaign_key = excluded.campaign_key,
    campaign_label = excluded.campaign_label,
    audience = excluded.audience,
    granted_at = excluded.granted_at,
    expires_at = excluded.expires_at,
    used_at = excluded.used_at,
    used_order_id = excluded.used_order_id,
    used_order_code = excluded.used_order_code,
    canceled_at = excluded.canceled_at,
    metadata = excluded.metadata,
    legacy_payload = excluded.legacy_payload,
    updated_at = now();

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

create or replace function public.sync_loyalty_account_metadata(
  p_customer_phone text,
  p_vouchers jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_vouchers jsonb;
  v_metadata jsonb;
begin
  if not public.crm_loyalty_staff_can_write() then
    raise exception 'Tai khoan hien tai chua du quyen cap nhat voucher loyalty.';
  end if;

  v_phone := public.normalize_vietnam_phone(p_customer_phone);
  if coalesce(v_phone, '') = '' then
    raise exception 'So dien thoai loyalty khong hop le.';
  end if;

  v_vouchers := case
    when jsonb_typeof(coalesce(p_vouchers, '[]'::jsonb)) = 'array' then coalesce(p_vouchers, '[]'::jsonb)
    else '[]'::jsonb
  end;
  v_metadata := case
    when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object' then coalesce(p_metadata, '{}'::jsonb)
    else '{}'::jsonb
  end;

  insert into public.profiles (phone, registered, role, status, metadata)
  values (
    v_phone,
    false,
    'customer',
    'active',
    jsonb_build_object('source', 'crm_voucher_rpc')
  )
  on conflict (phone) do update
    set metadata = coalesce(public.profiles.metadata, '{}'::jsonb)
        || jsonb_build_object('last_loyalty_touch', 'crm_voucher_rpc'),
        updated_at = now();

  insert into public.loyalty_accounts (
    customer_phone,
    total_points,
    vouchers,
    metadata
  )
  values (
    v_phone,
    0,
    v_vouchers,
    (v_metadata - 'pointHistory' - 'voucherHistory')
      || jsonb_build_object('source', 'crm_voucher_rpc')
  )
  on conflict (customer_phone) do update
    set vouchers = excluded.vouchers,
        metadata = coalesce(public.loyalty_accounts.metadata, '{}'::jsonb)
          || excluded.metadata,
        updated_at = now();

  perform loyalty_private.sync_customer_vouchers_from_jsonb(
    v_phone,
    v_vouchers,
    v_metadata
  );

  return true;
end;
$$;

create or replace function public.set_loyalty_voucher_usage(
  p_customer_phone text,
  p_voucher_id text default '',
  p_voucher_code text default '',
  p_order_id text default '',
  p_used_at timestamptz default now(),
  p_used boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_voucher_id text;
  v_voucher_code text;
  v_is_staff boolean;
  v_is_owner boolean;
  v_current_vouchers jsonb;
  v_next_vouchers jsonb;
  v_found boolean;
begin
  v_phone := public.normalize_vietnam_phone(p_customer_phone);
  v_voucher_id := trim(coalesce(p_voucher_id, ''));
  v_voucher_code := upper(trim(coalesce(p_voucher_code, '')));

  if coalesce(v_phone, '') = '' then
    raise exception 'So dien thoai loyalty khong hop le.';
  end if;
  if v_voucher_id = '' and v_voucher_code = '' then
    raise exception 'Can voucher id hoac voucher code de cap nhat.';
  end if;

  select public.crm_loyalty_staff_can_write() into v_is_staff;
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.normalize_vietnam_phone(p.phone) = v_phone
      and coalesce(p.status, 'active') = 'active'
  )
  into v_is_owner;

  if not coalesce(v_is_staff, false) and not coalesce(v_is_owner, false) then
    raise exception 'Tai khoan hien tai chua du quyen cap nhat voucher nay.';
  end if;

  select coalesce(vouchers, '[]'::jsonb)
  into v_current_vouchers
  from public.loyalty_accounts
  where customer_phone = v_phone;

  if v_current_vouchers is null then
    return false;
  end if;

  select
    coalesce(jsonb_agg(
      case
        when matched then
          voucher
          || jsonb_build_object(
            'used', coalesce(p_used, true),
            'usedAt', case when coalesce(p_used, true) then coalesce(p_used_at, now())::text else '' end,
            'orderCode', trim(coalesce(p_order_id, ''))
          )
        else voucher
      end
    ), '[]'::jsonb),
    coalesce(bool_or(matched), false)
  into v_next_vouchers, v_found
  from (
    select
      item.voucher,
      (
        (v_voucher_id <> '' and coalesce(item.voucher ->> 'id', '') = v_voucher_id)
        or
        (v_voucher_code <> '' and upper(coalesce(item.voucher ->> 'code', '')) = v_voucher_code)
      ) as matched
    from jsonb_array_elements(v_current_vouchers) as item(voucher)
  ) source;

  if not coalesce(v_found, false) then
    return false;
  end if;

  update public.loyalty_accounts
  set vouchers = v_next_vouchers,
      updated_at = now()
  where customer_phone = v_phone;

  perform loyalty_private.sync_customer_vouchers_from_jsonb(
    v_phone,
    v_next_vouchers,
    jsonb_build_object(
      'sourceType', 'set_loyalty_voucher_usage',
      'sourceLabel', 'Cap nhat trang thai voucher'
    )
  );

  return true;
end;
$$;

notify pgrst, 'reload schema';
