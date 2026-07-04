-- Read-only postcheck for the legacy customer voucher backfill.
-- Verifies that normalized rows match the legacy loyalty_accounts.vouchers payload.

begin transaction read only;

set local statement_timeout = '5min';

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
    ) as voucher_instance_id
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
legacy_summary as (
  select
    count(*) as legacy_count,
    count(distinct profile_id || ':' || voucher_instance_id) as legacy_unique_count
  from legacy_rows
),
normalized_summary as (
  select
    count(*) as normalized_count,
    count(distinct profile_id || ':' || voucher_instance_id) as normalized_unique_count
  from public.customer_vouchers
  where source_type = 'legacy_backfill'
),
missing_rows as (
  select count(*) as missing_count
  from legacy_rows lr
  left join public.customer_vouchers cv
    on cv.profile_id = lr.profile_id
   and cv.voucher_instance_id = lr.voucher_instance_id
  where cv.id is null
),
extra_rows as (
  select count(*) as extra_count
  from public.customer_vouchers cv
  left join legacy_rows lr
    on cv.profile_id = lr.profile_id
   and cv.voucher_instance_id = lr.voucher_instance_id
  where cv.source_type = 'legacy_backfill'
    and lr.profile_id is null
)
select
  'legacy_total' as check_name,
  legacy_count as expected_value,
  normalized_count as actual_value
from legacy_summary, normalized_summary

union all

select
  'legacy_unique_total' as check_name,
  legacy_unique_count as expected_value,
  normalized_unique_count as actual_value
from legacy_summary, normalized_summary

union all

select
  'missing_rows' as check_name,
  0 as expected_value,
  missing_count as actual_value
from missing_rows

union all

select
  'extra_rows' as check_name,
  0 as expected_value,
  extra_count as actual_value
from extra_rows
;

select
  status,
  count(*) as total
from public.customer_vouchers
where source_type = 'legacy_backfill'
group by status
order by status;

select
  count(*) as unresolved_coupon_count
from public.customer_vouchers
where source_type = 'legacy_backfill'
  and voucher_template_id is null
  and nullif(btrim(coalesce((legacy_payload ->> 'couponId'), '')), '') is not null;

rollback;
