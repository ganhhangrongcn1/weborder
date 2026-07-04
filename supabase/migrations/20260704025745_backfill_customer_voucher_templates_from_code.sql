-- Resolve voucher_template_id for legacy backfilled rows by matching the real voucher code.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '5min';

do $$
declare
  v_rows integer := 0;
begin
  with resolved_rows as (
    select
      cv.id as customer_voucher_id,
      c.id as voucher_template_id
    from public.customer_vouchers cv
    join lateral (
      select
        coalesce(
          nullif(upper(btrim(coalesce(cv.voucher_code, ''))), ''),
          nullif(upper(btrim(coalesce(cv.legacy_payload ->> 'code', ''))), ''),
          case
            when btrim(coalesce(cv.legacy_payload ->> 'couponId', '')) like 'coupon-%'
              then nullif(upper(btrim(replace(coalesce(cv.legacy_payload ->> 'couponId', ''), 'coupon-', ''))), '')
            else null
          end
        ) as lookup_code,
        case
          when btrim(coalesce(cv.legacy_payload ->> 'couponId', '')) ~ '^[0-9]+$'
            then (cv.legacy_payload ->> 'couponId')::bigint
          else null
        end as lookup_id
    ) lookup on true
    join public.coupons c
      on (
        lookup.lookup_id is not null
        and c.id = lookup.lookup_id
      )
      or (
        lookup.lookup_code is not null
        and upper(c.code) = lookup.lookup_code
      )
    where cv.source_type = 'legacy_backfill'
      and cv.voucher_template_id is null
  )
  update public.customer_vouchers cv
  set
    voucher_template_id = resolved_rows.voucher_template_id,
    updated_at = now()
  from resolved_rows
  where cv.id = resolved_rows.customer_voucher_id;

  get diagnostics v_rows = row_count;
  raise notice 'customer_vouchers template mapping upserted % rows', v_rows;
end $$;

commit;
