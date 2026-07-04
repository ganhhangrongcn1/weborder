-- Backfill legacy loyalty_accounts.vouchers into public.customer_vouchers.
-- Safe to rerun: rows are upserted by (profile_id, voucher_instance_id).

begin;

set local lock_timeout = '5s';
set local statement_timeout = '5min';

create or replace function pg_temp.try_parse_timestamptz(p_value text)
returns timestamptz
language plpgsql
stable
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

do $$
declare
  v_rows integer := 0;
begin
  with normalized_profiles as (
    select
      p.id,
      p.phone,
      public.normalize_vietnam_phone(p.phone) as normalized_phone,
      p.updated_at
    from public.profiles p
    where nullif(btrim(coalesce(p.phone, '')), '') is not null
  ),
  legacy_rows as (
    select
      la.customer_phone as loyalty_phone,
      public.normalize_vietnam_phone(la.customer_phone) as normalized_phone,
      profile.id as profile_id,
      profile.phone as profile_phone,
      voucher.value as legacy_payload,
      voucher.ordinality as voucher_ordinality,
      coalesce(
        nullif(btrim(coalesce(voucher.value ->> 'id', '')), ''),
        'legacy-backfill-' || md5(
          concat_ws(
            '|',
            public.normalize_vietnam_phone(la.customer_phone),
            voucher.ordinality::text,
            coalesce(voucher.value ->> 'code', ''),
            coalesce(voucher.value ->> 'createdAt', ''),
            coalesce(voucher.value ->> 'title', ''),
            coalesce(voucher.value ->> 'couponId', '')
          )
        )
      ) as voucher_instance_id,
      nullif(btrim(coalesce(voucher.value ->> 'couponId', '')), '') as coupon_id_text,
      coalesce(
        pg_temp.try_parse_timestamptz(voucher.value ->> 'createdAt'),
        pg_temp.try_parse_timestamptz(voucher.value ->> 'grantedAt'),
        pg_temp.try_parse_timestamptz(voucher.value ->> 'created_at'),
        now()
      ) as granted_at,
      pg_temp.try_parse_timestamptz(voucher.value ->> 'usedAt') as used_at,
      pg_temp.try_parse_timestamptz(voucher.value ->> 'canceledAt') as canceled_at,
      pg_temp.try_parse_timestamptz(voucher.value ->> 'expiredAt') as explicit_expires_at,
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
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'discountType', '')), ''), 'fixed') as discount_type,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'voucherType', '')), ''), 'loyalty') as voucher_type,
      coalesce(
        nullif(btrim(coalesce(voucher.value ->> 'managementGroup', '')), ''),
        case
          when nullif(btrim(coalesce(voucher.value ->> 'tierId', '')), '') is not null then 'loyalty_auto'
          when lower(coalesce(voucher.value ->> 'grantSourceType', '')) like 'crm%' then 'loyalty_crm'
          else 'legacy_loyalty'
        end
      ) as management_group,
      coalesce(
        nullif(btrim(coalesce(voucher.value ->> 'code', '')), ''),
        nullif(btrim(coalesce(voucher.value ->> 'couponCode', '')), ''),
        ''
      ) as voucher_code,
      coalesce(
        nullif(btrim(coalesce(voucher.value ->> 'title', '')), ''),
        nullif(btrim(coalesce(voucher.value ->> 'name', '')), ''),
        'Voucher cũ'
      ) as voucher_name,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'sourceType', '')), ''), 'legacy_backfill') as source_type,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'sourceLabel', '')), ''), 'Đồng bộ voucher cũ') as source_label,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'grantCampaignKey', voucher.value ->> 'campaignKey', '')), ''), 'legacy_loyalty') as campaign_key,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'grantCampaignLabel', voucher.value ->> 'campaignLabel', '')), ''), 'Voucher cũ từ loyalty_accounts') as campaign_label,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'grantAudience', voucher.value ->> 'campaignAudience', '')), ''), 'existing_customer') as audience,
      coalesce(
        nullif(btrim(coalesce(voucher.value ->> 'grantBatchId', '')), ''),
        'legacy_backfill'
      ) as batch_id,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'usedOrderCode', voucher.value ->> 'orderCode', voucher.value ->> 'orderId', '')), ''), '') as used_order_code,
      coalesce(nullif(btrim(coalesce(voucher.value ->> 'usedOrderId', voucher.value ->> 'orderId', voucher.value ->> 'orderCode', '')), ''), '') as used_order_id
    from public.loyalty_accounts la
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(coalesce(la.vouchers, '[]'::jsonb)) = 'array' then coalesce(la.vouchers, '[]'::jsonb)
        else '[]'::jsonb
      end
    ) with ordinality as voucher(value, ordinality)
    join lateral (
      select p.id, p.phone
      from normalized_profiles p
      where p.normalized_phone = public.normalize_vietnam_phone(la.customer_phone)
      order by p.updated_at desc nulls last, p.id
      limit 1
    ) as profile on true
    where nullif(btrim(coalesce(la.customer_phone, '')), '') is not null
  ),
  prepared_rows as (
    select
      lr.profile_id,
      lr.profile_phone as customer_phone,
      lr.voucher_instance_id,
      lr.batch_id,
      lr.voucher_code,
      lr.voucher_name,
      lr.voucher_type,
      lr.management_group,
      lr.discount_type,
      lr.discount_value,
      lr.max_discount,
      lr.min_order,
      lr.valid_days_after_grant,
      case
        when lower(coalesce(lr.legacy_payload ->> 'canceled', 'false')) = 'true' then 'canceled'
        when lower(coalesce(lr.legacy_payload ->> 'used', 'false')) = 'true' then 'used'
        when coalesce(lr.explicit_expires_at, lr.granted_at + make_interval(days => lr.valid_days_after_grant)) < now() then 'expired'
        else 'active'
      end as status,
      lr.source_type,
      lr.source_label,
      lr.campaign_key,
      lr.campaign_label,
      lr.audience,
      lr.granted_at,
      coalesce(lr.explicit_expires_at, lr.granted_at + make_interval(days => lr.valid_days_after_grant)) as expires_at,
      case
        when lower(coalesce(lr.legacy_payload ->> 'used', 'false')) = 'true' then coalesce(lr.granted_at, now())
        else pg_temp.try_parse_timestamptz(lr.legacy_payload ->> 'usedAt')
      end as used_at,
      lr.used_order_id,
      lr.used_order_code,
      lr.canceled_at,
      jsonb_strip_nulls(jsonb_build_object(
        'legacyPhone', lr.loyalty_phone,
        'normalizedPhone', lr.normalized_phone,
        'tierId', lr.legacy_payload ->> 'tierId',
        'cycleYear', lr.legacy_payload ->> 'cycleYear',
        'grantMonth', lr.legacy_payload ->> 'grantMonth',
        'grantSourceType', lr.legacy_payload ->> 'grantSourceType',
        'grantSourceLabel', lr.legacy_payload ->> 'grantSourceLabel',
        'grantCampaignKey', lr.legacy_payload ->> 'grantCampaignKey',
        'grantCampaignLabel', lr.legacy_payload ->> 'grantCampaignLabel',
        'grantAudience', lr.legacy_payload ->> 'grantAudience',
        'validDaysAfterGrant', lr.legacy_payload ->> 'validDaysAfterGrant',
        'migratedFrom', 'loyalty_accounts.vouchers',
        'migratedAt', now()
      )) as metadata,
      lr.legacy_payload
    from legacy_rows lr
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
    on coupon.id = case
      when btrim(coalesce(pr.legacy_payload ->> 'couponId', '')) ~ '^[0-9]+$'
        then (pr.legacy_payload ->> 'couponId')::bigint
      else null
    end
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
  raise notice 'customer_vouchers legacy backfill upserted % rows', v_rows;
end $$;

commit;
