-- Voucher security phase 1A.
-- 1. Customers and anonymous sessions can still read coupon templates.
-- 2. Only an active linked admin profile can change coupon templates.
-- 3. CRM analytics stays available to active backoffice profiles only.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create schema if not exists loyalty_private;

create or replace function loyalty_private.is_active_staff(
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = (select auth.uid())
        and lower(coalesce(p.status, '')) = 'active'
        and lower(coalesce(p.role, '')) = any(coalesce(p_roles, array[]::text[]))
    );
$$;

revoke all on function loyalty_private.is_active_staff(text[])
from public, anon, authenticated;

alter table public.coupons enable row level security;

drop policy if exists catalog_public_select_coupons on public.coupons;
drop policy if exists coupons_read_public on public.coupons;
drop policy if exists catalog_public_write_coupons on public.coupons;
drop policy if exists coupons_write_runtime on public.coupons;
drop policy if exists coupons_write_admin_only on public.coupons;

create policy coupons_select_public
on public.coupons
for select
to anon, authenticated
using (true);

create policy coupons_write_linked_admin
on public.coupons
for all
to authenticated
using (
  (select loyalty_private.is_active_staff(array['admin']::text[]))
)
with check (
  (select loyalty_private.is_active_staff(array['admin']::text[]))
);

revoke all on public.coupons from anon;
grant select on public.coupons to anon;

revoke all on public.coupons from authenticated;
grant select, insert, update, delete on public.coupons to authenticated;

do $$
begin
  if to_regprocedure('loyalty_private.get_admin_crm_analytics_unchecked()') is null then
    if to_regprocedure('public.get_admin_crm_analytics()') is null then
      raise exception 'Required function public.get_admin_crm_analytics() is missing.';
    end if;

    execute 'alter function public.get_admin_crm_analytics() set schema loyalty_private';
    execute 'alter function loyalty_private.get_admin_crm_analytics() rename to get_admin_crm_analytics_unchecked';
  end if;
end;
$$;

alter function loyalty_private.get_admin_crm_analytics_unchecked()
security invoker;

alter function loyalty_private.get_admin_crm_analytics_unchecked()
set search_path = pg_catalog, public;

revoke all on function loyalty_private.get_admin_crm_analytics_unchecked()
from public, anon, authenticated;

create or replace function public.get_admin_crm_analytics()
returns table(
  summary jsonb,
  customers jsonb,
  top_customers_by_spent jsonb,
  top_customers_by_orders jsonb,
  filter_options jsonb,
  voucher_segments jsonb,
  vip_criteria jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not loyalty_private.is_active_staff(
    array['admin', 'staff', 'kitchen', 'crm']::text[]
  ) then
    raise exception 'crm_access_denied'
      using errcode = '42501';
  end if;

  return query
  select
    analytics.summary,
    analytics.customers,
    analytics.top_customers_by_spent,
    analytics.top_customers_by_orders,
    analytics.filter_options,
    analytics.voucher_segments,
    analytics.vip_criteria
  from loyalty_private.get_admin_crm_analytics_unchecked() analytics;
end;
$$;

revoke all on function public.get_admin_crm_analytics()
from public, anon, authenticated;
grant execute on function public.get_admin_crm_analytics()
to authenticated, service_role;

do $$
begin
  if has_table_privilege('anon', 'public.coupons', 'INSERT')
    or has_table_privilege('anon', 'public.coupons', 'UPDATE')
    or has_table_privilege('anon', 'public.coupons', 'DELETE')
  then
    raise exception 'Anonymous coupon write privileges are still enabled.';
  end if;

  if has_function_privilege('anon', 'public.get_admin_crm_analytics()', 'EXECUTE') then
    raise exception 'Anonymous CRM analytics execution is still enabled.';
  end if;
end;
$$;

comment on function loyalty_private.is_active_staff(text[]) is
  'Checks the caller against an active, Auth-linked backoffice profile.';
comment on function public.get_admin_crm_analytics() is
  'Authorized backoffice facade for customer CRM analytics.';

notify pgrst, 'reload schema';

commit;
