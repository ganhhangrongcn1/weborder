-- Loyalty V2: close legacy table writes and RPCs after the V2 frontend is live.

begin;

do $$
begin
  if to_regprocedure('public.sync_loyalty_account_metadata(text,jsonb,jsonb)') is null
    or to_regprocedure('public.set_loyalty_voucher_usage(text,text,text,text,timestamptz,boolean)') is null
    or to_regprocedure('public.process_order_loyalty(text,text,text,text)') is null
  then
    raise exception 'Chưa đủ RPC Loyalty V2 để thực hiện security cutover.';
  end if;
end;
$$;

alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_ledger enable row level security;

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
revoke all on public.loyalty_accounts from authenticated;
revoke all on public.loyalty_ledger from authenticated;
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
    from public.profiles profile
    where profile.auth_user_id = (select auth.uid())
      and lower(coalesce(profile.status, '')) = 'active'
      and (
        lower(coalesce(profile.role, '')) in ('admin', 'staff', 'kitchen', 'crm')
        or (
          lower(coalesce(profile.role, '')) = 'customer'
          and public.normalize_vietnam_phone(profile.phone)
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
    from public.profiles profile
    where profile.auth_user_id = (select auth.uid())
      and lower(coalesce(profile.status, '')) = 'active'
      and (
        lower(coalesce(profile.role, '')) in ('admin', 'staff', 'kitchen', 'crm')
        or (
          lower(coalesce(profile.role, '')) = 'customer'
          and public.normalize_vietnam_phone(profile.phone)
            = public.normalize_vietnam_phone(loyalty_ledger.customer_phone)
        )
      )
  )
);

do $$
begin
  if to_regprocedure('public.apply_loyalty_event(text,text,integer,text,numeric,text,text,jsonb,timestamptz)') is not null then
    execute 'revoke execute on function public.apply_loyalty_event(text,text,integer,text,numeric,text,text,jsonb,timestamptz) from public, anon, authenticated';
    execute 'grant execute on function public.apply_loyalty_event(text,text,integer,text,numeric,text,text,jsonb,timestamptz) to service_role';
  end if;
  if to_regprocedure('public.claim_partner_order_points(uuid,text,text,numeric)') is not null then
    execute 'revoke execute on function public.claim_partner_order_points(uuid,text,text,numeric) from public, anon, authenticated';
    execute 'grant execute on function public.claim_partner_order_points(uuid,text,text,numeric) to service_role';
  end if;
  if to_regprocedure('public.can_apply_loyalty_event(text,text)') is not null then
    execute 'revoke execute on function public.can_apply_loyalty_event(text,text) from public, anon, authenticated';
    execute 'grant execute on function public.can_apply_loyalty_event(text,text) to service_role';
  end if;
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.loyalty_accounts', 'INSERT')
    or has_table_privilege('anon', 'public.loyalty_accounts', 'UPDATE')
    or has_table_privilege('anon', 'public.loyalty_ledger', 'INSERT')
    or has_table_privilege('anon', 'public.loyalty_ledger', 'UPDATE')
  then
    raise exception 'Anon vẫn còn quyền ghi trực tiếp vào loyalty.';
  end if;
  if has_table_privilege('authenticated', 'public.loyalty_accounts', 'INSERT')
    or has_table_privilege('authenticated', 'public.loyalty_accounts', 'UPDATE')
    or has_table_privilege('authenticated', 'public.loyalty_ledger', 'INSERT')
    or has_table_privilege('authenticated', 'public.loyalty_ledger', 'UPDATE')
  then
    raise exception 'Authenticated vẫn còn quyền ghi trực tiếp vào loyalty.';
  end if;
  if has_function_privilege('anon', 'public.process_order_loyalty(text,text,text,text)', 'EXECUTE') then
    raise exception 'Anon không được có quyền gọi process_order_loyalty.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
