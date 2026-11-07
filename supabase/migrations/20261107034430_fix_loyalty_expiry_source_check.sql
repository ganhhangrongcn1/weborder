-- Permit the source already emitted by rolling point expiry.
-- Existing source types and all other ledger checks remain enforced.
set local lock_timeout = '5s';

alter table public.loyalty_ledger
  drop constraint loyalty_ledger_v2_source_check;

alter table public.loyalty_ledger
  add constraint loyalty_ledger_v2_source_check
  check (
    source_type is null
    or source_type in (
      'ORDER', 'PARTNER_ORDER', 'CUSTOMER_DAY',
      'CUSTOMER_STREAK', 'ADMIN', 'LOYALTY_LOT'
    )
  );
