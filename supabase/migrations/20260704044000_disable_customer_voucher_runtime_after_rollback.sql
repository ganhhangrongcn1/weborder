-- Soft rollback for the customer_vouchers runtime experiment.
-- Keep tables/data for audit, but remove the public/runtime functions so the app
-- goes back to the legacy loyalty_accounts.vouchers path.

begin;

drop function if exists public.get_customer_loyalty_wallet_snapshot(text);
drop function if exists public.sync_customer_vouchers_from_loyalty_payload(text, jsonb, jsonb);

notify pgrst, 'reload schema';

commit;
