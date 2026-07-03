-- Read-only postcheck for voucher phase 2.
-- Verifies coupon catalog normalization and loyalty valid-days-after-grant logic.

begin transaction read only;

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'coupons'
  and column_name = 'valid_days_after_grant';

select
  exists (
    select 1
    from pg_trigger
    where tgname = 'trg_coupons_sync_canonical_fields'
      and tgrelid = 'public.coupons'::regclass
  ) as has_coupon_sync_trigger;

select
  count(*) as loyalty_rows_missing_canonical_type
from public.coupons
where lower(coalesce(data ->> 'voucherType', 'checkout')) = 'loyalty'
  and lower(coalesce(voucher_type, 'checkout')) <> 'loyalty';

select
  count(*) as loyalty_rows_missing_valid_days
from public.coupons
where lower(coalesce(data ->> 'voucherType', voucher_type, 'checkout')) = 'loyalty'
  and coalesce(valid_days_after_grant, 0) <= 0;

select
  code,
  voucher_type,
  valid_days_after_grant,
  start_at,
  end_at,
  data ->> 'validDaysAfterGrant' as data_valid_days_after_grant,
  data ->> 'voucherType' as data_voucher_type
from public.coupons
order by updated_at desc nulls last, id desc
limit 20;

rollback;
