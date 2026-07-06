-- Thu hồi quyền profiles rộng và thay bằng owner/backoffice RLS.
-- Chạy sau migration tạo RPC profile an toàn.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.profiles enable row level security;

drop policy if exists profiles_customer_select on public.profiles;
drop policy if exists profiles_customer_insert on public.profiles;
drop policy if exists profiles_customer_update on public.profiles;
drop policy if exists profiles_owner_select on public.profiles;
drop policy if exists profiles_backoffice_select on public.profiles;

create policy profiles_owner_select
on public.profiles
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
);

create policy profiles_backoffice_select
on public.profiles
for select
to authenticated
using (
  (select loyalty_private.is_active_staff(
    array['admin', 'staff', 'kitchen', 'crm']::text[]
  ))
);

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

do $$
declare
  v_columns text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
  into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name <> 'password_demo';

  if nullif(v_columns, '') is null then
    raise exception 'profiles_safe_select_columns_missing';
  end if;

  execute format(
    'grant select (%s) on table public.profiles to authenticated',
    v_columns
  );
end;
$$;

do $$
begin
  if has_table_privilege('anon', 'public.profiles', 'SELECT')
    or has_table_privilege('anon', 'public.profiles', 'INSERT')
    or has_table_privilege('anon', 'public.profiles', 'UPDATE')
    or has_table_privilege('anon', 'public.profiles', 'DELETE')
  then
    raise exception 'anonymous_profiles_table_access_still_enabled';
  end if;

  if has_column_privilege(
    'authenticated',
    'public.profiles',
    'password_demo',
    'SELECT'
  ) then
    raise exception 'authenticated_password_demo_select_still_enabled';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_customer_profile_login_hint(text)',
    'EXECUTE'
  ) then
    raise exception 'login_hint_rpc_missing_anon_execute';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.sync_own_customer_profile(text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'profile_sync_rpc_missing_authenticated_execute';
  end if;

  if not has_function_privilege(
    'authenticated',
    'loyalty_private.is_active_staff(text[])',
    'EXECUTE'
  ) then
    raise exception 'backoffice_profile_policy_helper_missing_execute';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
