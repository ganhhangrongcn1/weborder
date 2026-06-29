-- POS loyalty/profile hotfix.
-- Safe to rerun.
--
-- Fixes:
-- 1. Allow authenticated POS staff sessions to call the loyalty RPCs.
-- 2. Ensure partner_orders also auto-sync customer stub profiles.

grant execute on function public.can_apply_loyalty_event(text, text) to authenticated;

grant execute on function public.apply_loyalty_event(
  text,
  text,
  integer,
  text,
  numeric,
  text,
  text,
  jsonb,
  timestamptz
) to authenticated;

do $$
begin
  if to_regclass('public.partner_orders') is not null
    and to_regprocedure('public.sync_customer_profile_from_order_row()') is not null
    and not exists (
      select 1
      from pg_trigger
      where tgname = 'trg_sync_customer_profile_from_partner_orders'
        and tgrelid = 'public.partner_orders'::regclass
    )
  then
    create trigger trg_sync_customer_profile_from_partner_orders
    after insert or update of customer_phone, customer_phone_key, customer_name, order_time
    on public.partner_orders
    for each row
    execute function public.sync_customer_profile_from_order_row();
  end if;
end $$;

notify pgrst, 'reload schema';
