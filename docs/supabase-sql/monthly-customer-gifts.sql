-- Monthly customer gift program for GHR kitchen.
-- Goal:
-- 1. Track the "3 orders in one month = 1 gift" program.
-- 2. Count orders by a stable customer key, usually phone.
-- 3. Allow only one claimed gift per customer per month per gift code.
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

create or replace function public.is_ghr_staff()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.status = 'active'
      and p.role in ('admin', 'staff', 'kitchen')
      and (
        p.auth_user_id = auth.uid()
        or lower(coalesce(p.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

create table if not exists public.monthly_customer_gifts (
  id uuid primary key default gen_random_uuid(),

  customer_key text not null,
  customer_key_type text not null default 'phone',
  customer_name text not null default '',
  customer_phone text not null default '',

  reward_month text not null,
  order_count_at_claim integer not null default 0,

  gift_code text not null default 'MONTHLY_3_ORDERS',
  gift_name text not null default 'Quà khách quen tháng',

  claimed_order_source text not null default '',
  claimed_order_id text not null default '',
  claimed_order_code text not null default '',

  claimed_by_profile_id uuid references public.profiles(id) on delete set null,
  claimed_by_name text not null default '',
  claimed_at timestamptz not null default now(),

  note text not null default '',
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint monthly_customer_gifts_customer_key_check check (length(trim(customer_key)) > 0),
  constraint monthly_customer_gifts_key_type_check check (customer_key_type in ('phone', 'name', 'customer_id', 'external_id')),
  constraint monthly_customer_gifts_reward_month_check check (reward_month ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint monthly_customer_gifts_order_count_check check (order_count_at_claim >= 0),
  constraint monthly_customer_gifts_unique unique (customer_key, reward_month, gift_code)
);

create index if not exists monthly_customer_gifts_customer_month_idx
on public.monthly_customer_gifts (customer_key, reward_month);

create index if not exists monthly_customer_gifts_reward_month_idx
on public.monthly_customer_gifts (reward_month desc);

create index if not exists monthly_customer_gifts_claimed_at_idx
on public.monthly_customer_gifts (claimed_at desc);

drop trigger if exists monthly_customer_gifts_set_updated_at on public.monthly_customer_gifts;
create trigger monthly_customer_gifts_set_updated_at
before update on public.monthly_customer_gifts
for each row
execute function public.set_updated_at();

alter table public.monthly_customer_gifts enable row level security;

grant select on public.monthly_customer_gifts to anon, authenticated;
grant insert, update on public.monthly_customer_gifts to authenticated;

drop policy if exists monthly_customer_gifts_staff_select on public.monthly_customer_gifts;
create policy monthly_customer_gifts_staff_select
on public.monthly_customer_gifts
for select
to authenticated
using (public.is_ghr_staff());

drop policy if exists monthly_customer_gifts_staff_insert on public.monthly_customer_gifts;
create policy monthly_customer_gifts_staff_insert
on public.monthly_customer_gifts
for insert
to authenticated
with check (public.is_ghr_staff());

drop policy if exists monthly_customer_gifts_staff_update on public.monthly_customer_gifts;
create policy monthly_customer_gifts_staff_update
on public.monthly_customer_gifts
for update
to authenticated
using (public.is_ghr_staff())
with check (public.is_ghr_staff());

-- Temporary read policy for the current kitchen board if it still runs with anon select.
-- Drop this after all kitchen accounts are fully authenticated.
drop policy if exists monthly_customer_gifts_public_select_until_kitchen_auth on public.monthly_customer_gifts;
create policy monthly_customer_gifts_public_select_until_kitchen_auth
on public.monthly_customer_gifts
for select
to anon
using (true);

-- Verification queries.
select
  'monthly_customer_gifts_table_ready' as check_name,
  count(*) as total_claimed_gifts
from public.monthly_customer_gifts;

select
  'monthly_customer_gifts_by_month' as check_name,
  reward_month,
  count(*) as total_claimed_gifts
from public.monthly_customer_gifts
group by reward_month
order by reward_month desc;
