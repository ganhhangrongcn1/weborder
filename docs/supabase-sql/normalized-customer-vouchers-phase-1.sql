-- Phase 1 source of truth:
-- supabase/migrations/20260704023036_create_normalized_customer_vouchers.sql
-- supabase/migrations/20260704023732_harden_normalized_customer_voucher_policies.sql
--
-- This phase is additive only. It creates:
-- - public.voucher_campaigns
-- - public.customer_vouchers
--
-- Runtime reads and writes continue using loyalty_accounts.vouchers until
-- backfill, reconciliation and dual-write phases are verified.

select
  to_regclass('public.voucher_campaigns') as voucher_campaigns,
  to_regclass('public.customer_vouchers') as customer_vouchers;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('voucher_campaigns', 'customer_vouchers')
order by tablename, policyname;

select
  role_name,
  has_table_privilege(role_name, 'public.voucher_campaigns', 'SELECT') as campaigns_select,
  has_table_privilege(role_name, 'public.voucher_campaigns', 'INSERT') as campaigns_insert,
  has_table_privilege(role_name, 'public.customer_vouchers', 'SELECT') as vouchers_select,
  has_table_privilege(role_name, 'public.customer_vouchers', 'INSERT') as vouchers_insert
from unnest(array['anon', 'authenticated', 'service_role']) as role_name;
