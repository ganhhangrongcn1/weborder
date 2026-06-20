-- Loyalty V2 - security cutover
-- KHÔNG CHẠY trong Phase 2 foundation.
-- Chỉ chạy sau khi web/QR/POS/partner/admin đã chuyển hết sang RPC V2.
--
-- Bắt buộc chủ động mở khóa trong cùng session SQL Editor:
--   set app.loyalty_v2_allow_legacy_cutover = 'on';

begin;

do $$
begin
  if coalesce(current_setting('app.loyalty_v2_allow_legacy_cutover', true), '') <> 'on' then
    raise exception 'Cutover đang khóa. Chỉ mở sau khi toàn bộ runtime đã chuyển sang Loyalty V2.';
  end if;
end;
$$;

alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_ledger enable row level security;

-- Xóa các policy runtime rộng đã quan sát trên production.
drop policy if exists loyalty_accounts_insert_anon_runtime on public.loyalty_accounts;
drop policy if exists loyalty_accounts_insert_authenticated_runtime on public.loyalty_accounts;
drop policy if exists loyalty_accounts_update_anon_runtime on public.loyalty_accounts;
drop policy if exists loyalty_accounts_update_authenticated_runtime on public.loyalty_accounts;
drop policy if exists loyalty_accounts_update_runtime on public.loyalty_accounts;
drop policy if exists loyalty_accounts_write_runtime on public.loyalty_accounts;
drop policy if exists loyalty_accounts_write_auth_roles on public.loyalty_accounts;
drop policy if exists loyalty_accounts_read_runtime on public.loyalty_accounts;

drop policy if exists loyalty_ledger_insert_anon_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_insert_authenticated_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_update_anon_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_update_authenticated_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_update_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_delete_anon_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_delete_authenticated_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_delete_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_write_runtime on public.loyalty_ledger;
drop policy if exists loyalty_ledger_write_auth_roles on public.loyalty_ledger;
drop policy if exists loyalty_ledger_read_runtime on public.loyalty_ledger;

revoke all on public.loyalty_accounts from anon;
revoke all on public.loyalty_ledger from anon;
revoke insert, update, delete on public.loyalty_accounts from authenticated;
revoke insert, update, delete on public.loyalty_ledger from authenticated;
grant select on public.loyalty_accounts to authenticated;
grant select on public.loyalty_ledger to authenticated;

drop policy if exists loyalty_accounts_select_staff_or_owner on public.loyalty_accounts;
create policy loyalty_accounts_select_staff_or_owner
on public.loyalty_accounts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and lower(coalesce(p.status, '')) = 'active'
      and (
        lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen')
        or (
          lower(coalesce(p.role, '')) = 'customer'
          and public.normalize_vietnam_phone(p.phone)
            = public.normalize_vietnam_phone(loyalty_accounts.customer_phone)
        )
      )
  )
);

drop policy if exists loyalty_ledger_select_staff_or_owner on public.loyalty_ledger;
create policy loyalty_ledger_select_staff_or_owner
on public.loyalty_ledger
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and lower(coalesce(p.status, '')) = 'active'
      and (
        lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen')
        or (
          lower(coalesce(p.role, '')) = 'customer'
          and public.normalize_vietnam_phone(p.phone)
            = public.normalize_vietnam_phone(loyalty_ledger.customer_phone)
        )
      )
  )
);

-- Tắt API legacy; giữ service_role tạm thời cho rollback vận hành có kiểm soát.
revoke execute on function public.apply_loyalty_event(
  text, text, integer, text, numeric, text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_loyalty_event(
  text, text, integer, text, numeric, text, text, jsonb, timestamptz
) to service_role;

revoke execute on function public.claim_partner_order_points(uuid, text, text, numeric)
from public, anon, authenticated;
grant execute on function public.claim_partner_order_points(uuid, text, text, numeric)
to service_role;

revoke execute on function public.can_apply_loyalty_event(text, text)
from public, anon, authenticated;
grant execute on function public.can_apply_loyalty_event(text, text)
to service_role;

notify pgrst, 'reload schema';

commit;
