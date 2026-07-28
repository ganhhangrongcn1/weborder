-- CRM analytics cache - safe, reversible optimization.
-- Keeps the existing get_admin_crm_analytics() contract unchanged.

create schema if not exists loyalty_private;

create table if not exists loyalty_private.admin_crm_analytics_cache (
  cache_key text primary key,
  payload jsonb not null,
  refreshed_at timestamptz not null default now()
);

revoke all on table loyalty_private.admin_crm_analytics_cache from public, anon, authenticated;

create or replace function public.get_admin_crm_analytics_cached(
  p_force_refresh boolean default false
)
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
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_refreshed_at timestamptz;
  v_role text;
begin
  select p.role
  into v_role
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;

  if auth.uid() is null or coalesce(v_role, '') not in ('admin', 'staff') then
    raise exception 'CRM analytics requires an admin or staff account';
  end if;

  select c.payload, c.refreshed_at
  into v_payload, v_refreshed_at
  from loyalty_private.admin_crm_analytics_cache c
  where c.cache_key = 'all';

  if p_force_refresh
    or v_payload is null
    or v_refreshed_at < now() - interval '5 minutes'
  then
    perform pg_catalog.pg_advisory_xact_lock(724631);

    select c.payload, c.refreshed_at
    into v_payload, v_refreshed_at
    from loyalty_private.admin_crm_analytics_cache c
    where c.cache_key = 'all';

    if p_force_refresh
      or v_payload is null
      or v_refreshed_at < now() - interval '5 minutes'
    then
      select pg_catalog.to_jsonb(result)
      into v_payload
      from public.get_admin_crm_analytics() result;

      insert into loyalty_private.admin_crm_analytics_cache(cache_key, payload, refreshed_at)
      values ('all', v_payload, now())
      on conflict (cache_key) do update
      set payload = excluded.payload,
          refreshed_at = excluded.refreshed_at;
    end if;
  end if;

  return query
  select
    v_payload -> 'summary',
    coalesce(v_payload -> 'customers', '[]'::jsonb),
    coalesce(v_payload -> 'top_customers_by_spent', '[]'::jsonb),
    coalesce(v_payload -> 'top_customers_by_orders', '[]'::jsonb),
    coalesce(v_payload -> 'filter_options', '{}'::jsonb),
    coalesce(v_payload -> 'voucher_segments', '[]'::jsonb),
    coalesce(v_payload -> 'vip_criteria', '{}'::jsonb);
end;
$$;

revoke execute on function public.get_admin_crm_analytics_cached(boolean)
from public, anon;
grant execute on function public.get_admin_crm_analytics_cached(boolean)
to authenticated;

notify pgrst, 'reload schema';
