-- Supabase profiles migration for GHR.
-- Goal:
-- 1. Add a unified profiles table for customer/admin/staff accounts.
-- 2. Copy existing customers rows into profiles with role = 'customer'.
-- 3. Keep the old customers table untouched during the transition.
--
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_profile_customer_to_legacy_customers()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'customer' then
    insert into public.customers (
      id,
      phone,
      name,
      email,
      avatar_url,
      password_demo,
      registered,
      total_orders,
      total_spent,
      member_rank,
      created_at,
      updated_at
    )
    values (
      new.id,
      new.phone,
      coalesce(new.name, ''),
      coalesce(new.email, ''),
      coalesce(new.avatar_url, ''),
      coalesce(new.password_demo, ''),
      coalesce(new.registered, false),
      coalesce(new.total_orders, 0),
      coalesce(new.total_spent, 0),
      coalesce(nullif(new.member_rank, ''), 'Member'),
      coalesce(new.created_at, now()),
      coalesce(new.updated_at, now())
    )
    on conflict (phone) do update
    set
      name = excluded.name,
      email = excluded.email,
      avatar_url = excluded.avatar_url,
      password_demo = excluded.password_demo,
      registered = excluded.registered,
      total_orders = excluded.total_orders,
      total_spent = excluded.total_spent,
      member_rank = excluded.member_rank,
      updated_at = coalesce(excluded.updated_at, now());
  end if;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  phone text not null,
  name text not null default '',
  email text not null default '',
  avatar_url text not null default '',
  password_demo text not null default '',
  registered boolean not null default false,
  role text not null default 'customer',
  status text not null default 'active',
  total_orders integer not null default 0,
  total_spent numeric(12, 0) not null default 0,
  member_rank text not null default 'Member',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_phone_unique unique (phone),
  constraint profiles_role_check check (role in ('customer', 'admin', 'staff', 'kitchen', 'shipper')),
  constraint profiles_status_check check (status in ('active', 'inactive', 'blocked')),
  constraint profiles_total_orders_check check (total_orders >= 0),
  constraint profiles_total_spent_check check (total_spent >= 0)
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_registered_idx on public.profiles (registered);
create index if not exists profiles_updated_at_idx on public.profiles (updated_at desc);

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to anon, authenticated;

drop policy if exists profiles_customer_select on public.profiles;
create policy profiles_customer_select
on public.profiles
for select
to anon, authenticated
using (
  role = 'customer'
  and status <> 'blocked'
);

drop policy if exists profiles_customer_insert on public.profiles;
create policy profiles_customer_insert
on public.profiles
for insert
to anon, authenticated
with check (
  role = 'customer'
  and status in ('active', 'inactive')
);

drop policy if exists profiles_customer_update on public.profiles;
create policy profiles_customer_update
on public.profiles
for update
to anon, authenticated
using (
  role = 'customer'
)
with check (
  role = 'customer'
  and status in ('active', 'inactive')
);

drop policy if exists profiles_privileged_self_select on public.profiles;
create policy profiles_privileged_self_select
on public.profiles
for select
to authenticated
using (
  role in ('admin', 'staff', 'kitchen', 'shipper')
  and status <> 'blocked'
  and (
    auth.uid() = auth_user_id
    or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists profiles_privileged_link_auth_user on public.profiles;
create policy profiles_privileged_link_auth_user
on public.profiles
for update
to authenticated
using (
  role in ('admin', 'staff', 'kitchen', 'shipper')
  and status <> 'blocked'
  and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  role in ('admin', 'staff', 'kitchen', 'shipper')
  and status in ('active', 'inactive')
  and auth_user_id = auth.uid()
  and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists profiles_sync_legacy_customers on public.profiles;
create trigger profiles_sync_legacy_customers
after insert or update on public.profiles
for each row
execute function public.sync_profile_customer_to_legacy_customers();

insert into public.profiles (
  id,
  phone,
  name,
  email,
  avatar_url,
  password_demo,
  registered,
  role,
  status,
  total_orders,
  total_spent,
  member_rank,
  created_at,
  updated_at,
  metadata
)
select
  coalesce(c.id, gen_random_uuid()) as id,
  trim(c.phone) as phone,
  coalesce(c.name, '') as name,
  coalesce(c.email, '') as email,
  coalesce(c.avatar_url, '') as avatar_url,
  coalesce(c.password_demo, '') as password_demo,
  coalesce(c.registered, false) as registered,
  'customer' as role,
  'active' as status,
  coalesce(c.total_orders, 0) as total_orders,
  coalesce(c.total_spent, 0) as total_spent,
  coalesce(nullif(c.member_rank, ''), 'Member') as member_rank,
  coalesce(c.created_at, now()) as created_at,
  coalesce(c.updated_at, now()) as updated_at,
  jsonb_build_object(
    'source_table', 'customers',
    'migrated_at', now()
  ) as metadata
from public.customers c
where nullif(trim(c.phone), '') is not null
on conflict (phone) do update
set
  name = coalesce(nullif(excluded.name, ''), public.profiles.name),
  email = coalesce(nullif(excluded.email, ''), public.profiles.email),
  avatar_url = coalesce(nullif(excluded.avatar_url, ''), public.profiles.avatar_url),
  password_demo = coalesce(nullif(excluded.password_demo, ''), public.profiles.password_demo),
  registered = public.profiles.registered or excluded.registered,
  role = coalesce(nullif(public.profiles.role, ''), excluded.role),
  status = coalesce(nullif(public.profiles.status, ''), excluded.status),
  total_orders = greatest(public.profiles.total_orders, excluded.total_orders),
  total_spent = greatest(public.profiles.total_spent, excluded.total_spent),
  member_rank = coalesce(nullif(excluded.member_rank, ''), public.profiles.member_rank),
  updated_at = now(),
  metadata = public.profiles.metadata || excluded.metadata;

insert into public.profiles (
  phone,
  name,
  registered,
  role,
  status,
  metadata
)
select
  address_profiles.customer_phone as phone,
  coalesce(address_profiles.receiver_name, '') as name,
  false as registered,
  'customer' as role,
  'active' as status,
  jsonb_build_object(
    'source_table', 'customer_addresses',
    'migrated_at', now()
  ) as metadata
from (
  select distinct on (ca.customer_phone)
    trim(ca.customer_phone) as customer_phone,
    nullif(trim(coalesce(ca.receiver_name, '')), '') as receiver_name
  from public.customer_addresses ca
  where nullif(trim(ca.customer_phone), '') is not null
  order by ca.customer_phone, ca.is_default desc, ca.updated_at desc nulls last
) address_profiles
where not exists (
  select 1
  from public.profiles p
  where p.phone = address_profiles.customer_phone
)
on conflict (phone) do nothing;

insert into public.customers (
  id,
  phone,
  name,
  email,
  avatar_url,
  password_demo,
  registered,
  total_orders,
  total_spent,
  member_rank,
  created_at,
  updated_at
)
select
  p.id,
  p.phone,
  coalesce(p.name, '') as name,
  coalesce(p.email, '') as email,
  coalesce(p.avatar_url, '') as avatar_url,
  coalesce(p.password_demo, '') as password_demo,
  coalesce(p.registered, false) as registered,
  coalesce(p.total_orders, 0) as total_orders,
  coalesce(p.total_spent, 0) as total_spent,
  coalesce(nullif(p.member_rank, ''), 'Member') as member_rank,
  coalesce(p.created_at, now()) as created_at,
  coalesce(p.updated_at, now()) as updated_at
from public.profiles p
where p.role = 'customer'
  and not exists (
    select 1
    from public.customers c
    where c.phone = p.phone
  )
on conflict (phone) do update
set
  name = excluded.name,
  email = excluded.email,
  avatar_url = excluded.avatar_url,
  password_demo = excluded.password_demo,
  registered = excluded.registered,
  total_orders = excluded.total_orders,
  total_spent = excluded.total_spent,
  member_rank = excluded.member_rank,
  updated_at = coalesce(excluded.updated_at, now());

update public.profiles p
set
  name = address_profiles.receiver_name,
  updated_at = now(),
  metadata = p.metadata || jsonb_build_object(
    'name_source_table', 'customer_addresses',
    'name_filled_at', now()
  )
from (
  select distinct on (ca.customer_phone)
    trim(ca.customer_phone) as customer_phone,
    nullif(trim(coalesce(ca.receiver_name, '')), '') as receiver_name
  from public.customer_addresses ca
  where nullif(trim(ca.customer_phone), '') is not null
    and nullif(trim(coalesce(ca.receiver_name, '')), '') is not null
  order by ca.customer_phone, ca.is_default desc, ca.updated_at desc nulls last
) address_profiles
where p.phone = address_profiles.customer_phone
  and p.role = 'customer'
  and nullif(trim(p.name), '') is null;

insert into public.profiles (
  phone,
  name,
  registered,
  role,
  status,
  metadata
)
select
  loyalty_phones.customer_phone as phone,
  '' as name,
  false as registered,
  'customer' as role,
  'active' as status,
  jsonb_build_object(
    'source_table', loyalty_phones.source_table,
    'migrated_at', now()
  ) as metadata
from (
  select distinct trim(la.customer_phone) as customer_phone, 'loyalty_accounts' as source_table
  from public.loyalty_accounts la
  where nullif(trim(la.customer_phone), '') is not null
  union
  select distinct trim(ll.customer_phone) as customer_phone, 'loyalty_ledger' as source_table
  from public.loyalty_ledger ll
  where nullif(trim(ll.customer_phone), '') is not null
) loyalty_phones
where not exists (
  select 1
  from public.profiles p
  where p.phone = loyalty_phones.customer_phone
)
on conflict (phone) do nothing;

-- Example after creating a Supabase Auth admin/staff account:
-- update public.profiles
-- set
--   email = 'admin@yourdomain.com',
--   role = 'admin',
--   status = 'active',
--   registered = true,
--   auth_user_id = (
--     select id
--     from auth.users
--     where email = 'admin@yourdomain.com'
--     limit 1
--   ),
--   updated_at = now()
-- where phone = '0900000000';

-- Verification queries.
-- These should be checked after running the migration.

select
  'customers_count' as check_name,
  count(*) as value
from public.customers;

select
  'profiles_customer_count' as check_name,
  count(*) as value
from public.profiles
where role = 'customer';

select
  'missing_profiles_from_customers' as check_name,
  count(*) as value
from public.customers c
left join public.profiles p on p.phone = c.phone
where nullif(trim(c.phone), '') is not null
  and p.phone is null;

select
  role,
  status,
  count(*) as total
from public.profiles
group by role, status
order by role, status;

select
  'privileged_profiles_count' as check_name,
  count(*) as value
from public.profiles
where role in ('admin', 'staff', 'kitchen', 'shipper');

select
  'privileged_profiles_linked_auth' as check_name,
  count(*) as value
from public.profiles
where role in ('admin', 'staff', 'kitchen', 'shipper')
  and auth_user_id is not null;

select
  'customer_profiles_missing_legacy_customers' as check_name,
  count(*) as value
from public.profiles p
left join public.customers c on c.phone = p.phone
where p.role = 'customer'
  and nullif(trim(p.phone), '') is not null
  and c.phone is null;

select
  'orders_without_profile' as check_name,
  count(*) as value
from public.orders o
left join public.profiles p
  on p.phone = o.customer_phone
 and p.role = 'customer'
where nullif(trim(o.customer_phone), '') is not null
  and p.phone is null;

select
  'orders_with_profile' as check_name,
  count(*) as value
from public.orders o
join public.profiles p
  on p.phone = o.customer_phone
 and p.role = 'customer'
where nullif(trim(o.customer_phone), '') is not null;

select
  'addresses_without_profile' as check_name,
  count(*) as value
from public.customer_addresses ca
left join public.profiles p
  on p.phone = ca.customer_phone
 and p.role = 'customer'
where nullif(trim(ca.customer_phone), '') is not null
  and p.phone is null;

select
  'addresses_with_profile' as check_name,
  count(*) as value
from public.customer_addresses ca
join public.profiles p
  on p.phone = ca.customer_phone
 and p.role = 'customer'
where nullif(trim(ca.customer_phone), '') is not null;

select
  'loyalty_accounts_without_profile' as check_name,
  count(*) as value
from public.loyalty_accounts la
left join public.profiles p
  on p.phone = la.customer_phone
 and p.role = 'customer'
where nullif(trim(la.customer_phone), '') is not null
  and p.phone is null;

select
  'loyalty_accounts_with_profile' as check_name,
  count(*) as value
from public.loyalty_accounts la
join public.profiles p
  on p.phone = la.customer_phone
 and p.role = 'customer'
where nullif(trim(la.customer_phone), '') is not null;

select
  'loyalty_ledger_without_profile' as check_name,
  count(*) as value
from public.loyalty_ledger ll
left join public.profiles p
  on p.phone = ll.customer_phone
 and p.role = 'customer'
where nullif(trim(ll.customer_phone), '') is not null
  and p.phone is null;

select
  'loyalty_ledger_with_profile' as check_name,
  count(*) as value
from public.loyalty_ledger ll
join public.profiles p
  on p.phone = ll.customer_phone
 and p.role = 'customer'
where nullif(trim(ll.customer_phone), '') is not null;
