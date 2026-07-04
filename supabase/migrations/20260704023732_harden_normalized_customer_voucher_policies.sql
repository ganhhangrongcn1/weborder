-- Follow-up hardening for normalized voucher storage.
-- Keeps access behavior unchanged while avoiding overlapping SELECT policies.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.voucher_campaigns
  alter column source_label set default 'CRM - gửi theo nhóm';

drop policy if exists customer_vouchers_select_owner on public.customer_vouchers;
drop policy if exists customer_vouchers_select_staff on public.customer_vouchers;
drop policy if exists customer_vouchers_select_owner_or_staff on public.customer_vouchers;

create policy customer_vouchers_select_owner_or_staff
on public.customer_vouchers
for select
to authenticated
using (
  profile_id = (
    select p.id
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and lower(coalesce(p.status, '')) = 'active'
    limit 1
  )
  or (select loyalty_private.is_active_staff(array['admin', 'staff', 'crm']::text[]))
);

notify pgrst, 'reload schema';

commit;
