-- Partner order -> customer profile ingest contract
-- Goal:
-- 1. Partner order ingest must not fail just because customer profile hydration fails.
-- 2. n8n keeps writing partner_orders / partner_order_items as the source of truth for FoodApp orders.
-- 3. Customer stub profile hydration goes through one explicit RPC: public.upsert_customer_stub_profile.
--
-- Safe to rerun.
--
-- Recommended n8n flow:
-- 1. Upsert public.partner_orders on conflict (partner_source, nexpos_order_id).
-- 2. Sync public.partner_order_items for the returned partner_orders.id.
-- 3. Call RPC public.upsert_customer_stub_profile as a best-effort step:
--    p_phone      = partner_orders.customer_phone_key or customer_phone
--    p_name       = partner_orders.customer_name
--    p_source     = partner_orders.partner_source
--    p_source_ref = partner_orders.id or nexpos_order_id
-- 4. Do not stop the order ingest workflow if step 3 fails.

begin;

-- The customer profile write contract is explicit and protected.
-- It prevents partner/POS/n8n from directly deciding registered=true or overwriting operational profiles.
alter function public.upsert_customer_stub_profile(text, text, text, text)
  security definer;

alter function public.upsert_customer_stub_profile(text, text, text, text)
  set search_path = public;

grant execute on function public.upsert_customer_stub_profile(text, text, text, text)
  to authenticated, service_role;

grant execute on function public.normalize_vietnam_phone(text)
  to anon, authenticated, service_role;

-- Partner order inserts should not have hidden writes into profiles.
-- Profile hydration is handled by the explicit RPC above so n8n can make it non-blocking.
drop trigger if exists trg_sync_customer_profile_from_partner_orders
on public.partner_orders;

-- Keep service role able to run server-side ingest jobs.
grant usage on schema public to service_role;
grant select, insert, update on table public.partner_orders to service_role;
grant select, insert, update, delete on table public.partner_order_items to service_role;

notify pgrst, 'reload schema';

commit;

-- Verification: partner_orders should no longer have the profile auto-sync trigger.
select
  'partner_profile_trigger_removed' as check_name,
  not exists (
    select 1
    from pg_trigger t
    where t.tgname = 'trg_sync_customer_profile_from_partner_orders'
      and t.tgrelid = 'public.partner_orders'::regclass
  ) as ok;

-- Verification: profile hydration RPC should be security definer.
select
  'upsert_customer_stub_profile_security_definer' as check_name,
  p.prosecdef as ok
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'upsert_customer_stub_profile'
  and pg_get_function_identity_arguments(p.oid) = 'p_phone text, p_name text, p_source text, p_source_ref text';
