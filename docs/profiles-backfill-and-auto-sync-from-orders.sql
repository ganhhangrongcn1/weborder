-- Backfill missing customer profiles from website + partner orders
-- and keep profiles auto-synced for new incoming orders.
--
-- Goal:
-- 1. Every valid customer phone that appears in public.orders or public.partner_orders
--    must have a stub customer row in public.profiles.
-- 2. Future inserts/updates on orders and partner_orders auto-upsert profiles.
-- 3. Keep auth_user_id null and registered = false for guest/partner customers.
--
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create or replace function public.normalize_vietnam_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  if digits = '' then
    return '';
  end if;

  if left(digits, 4) = '0084' then
    digits := '84' || substring(digits from 5);
  end if;

  if left(digits, 2) = '84' then
    digits := '0' || substring(digits from 3);
  elsif left(digits, 1) <> '0' and length(digits) = 9 then
    digits := '0' || digits;
  end if;

  if digits ~ '^0[0-9]{9}$' then
    return digits;
  end if;

  return '';
end;
$$;

create or replace function public.sync_customer_profile_from_order_row()
returns trigger
language plpgsql
as $$
declare
  v_phone text;
  v_name text;
  v_source_table text;
  v_last_order_at timestamptz;
begin
  if tg_table_name = 'partner_orders' then
    v_phone := public.normalize_vietnam_phone(
      coalesce(
        nullif(new.customer_phone_key, ''),
        nullif(new.customer_phone, '')
      )
    );
    v_name := coalesce(nullif(trim(new.customer_name), ''), '');
    v_source_table := 'partner_orders';
    v_last_order_at := coalesce(new.order_time, new.created_at, now());
  else
    v_phone := public.normalize_vietnam_phone(
      coalesce(
        nullif(new.customer_phone, '')
      )
    );
    v_name := coalesce(
      nullif(trim(new.customer_name), ''),
      ''
    );
    v_source_table := 'orders';
    v_last_order_at := coalesce(new.created_at, now());
  end if;

  if v_phone = '' then
    return new;
  end if;

  insert into public.profiles (
    phone,
    name,
    registered,
    role,
    status,
    metadata,
    created_at,
    updated_at
  )
  values (
    v_phone,
    v_name,
    false,
    'customer',
    'active',
    jsonb_build_object(
      'source_table', v_source_table,
      'lastOrderAt', v_last_order_at,
      'profileAutoSyncedAt', now()
    ),
    now(),
    now()
  )
  on conflict (phone) do update
  set
    name = case
      when nullif(trim(public.profiles.name), '') is null and excluded.name <> '' then excluded.name
      else public.profiles.name
    end,
    role = case
      when public.profiles.role in ('admin', 'staff', 'kitchen', 'shipper') then public.profiles.role
      else 'customer'
    end,
    status = case
      when public.profiles.status = 'blocked' then public.profiles.status
      else 'active'
    end,
    metadata = coalesce(public.profiles.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_customer_profile_from_orders on public.orders;
create trigger trg_sync_customer_profile_from_orders
after insert or update of customer_phone, customer_name, created_at
on public.orders
for each row
execute function public.sync_customer_profile_from_order_row();

drop trigger if exists trg_sync_customer_profile_from_partner_orders on public.partner_orders;
create trigger trg_sync_customer_profile_from_partner_orders
after insert or update of customer_phone, customer_phone_key, customer_name, order_time
on public.partner_orders
for each row
execute function public.sync_customer_profile_from_order_row();

with missing_customer_profiles as (
  select distinct on (src.phone)
    src.phone,
    src.customer_name,
    src.source_table,
    src.last_order_at
  from (
    select
      public.normalize_vietnam_phone(
        coalesce(
          nullif(trim(o.customer_phone), '')
        )
      ) as phone,
      coalesce(
        nullif(trim(o.customer_name), ''),
        ''
      ) as customer_name,
      'orders' as source_table,
      coalesce(o.created_at, now()) as last_order_at
    from public.orders o

    union all

    select
      public.normalize_vietnam_phone(
        coalesce(
          nullif(trim(po.customer_phone_key), ''),
          nullif(trim(po.customer_phone), '')
        )
      ) as phone,
      coalesce(nullif(trim(po.customer_name), ''), '') as customer_name,
      'partner_orders' as source_table,
      coalesce(po.order_time, po.created_at, now()) as last_order_at
    from public.partner_orders po
  ) src
  left join public.profiles p
    on p.phone = src.phone
   and p.role = 'customer'
  where src.phone <> ''
    and p.phone is null
  order by src.phone, src.last_order_at desc
),
inserted_profiles as (
  insert into public.profiles (
    phone,
    name,
    registered,
    role,
    status,
    metadata,
    created_at,
    updated_at
  )
  select
    phone,
    customer_name,
    false,
    'customer',
    'active',
    jsonb_build_object(
      'source_table', source_table,
      'lastOrderAt', last_order_at,
      'backfilledAt', now()
    ),
    coalesce(last_order_at, now()),
    now()
  from missing_customer_profiles
  on conflict (phone) do nothing
  returning phone
)
select
  'profiles_backfilled_from_orders' as check_name,
  count(*) as inserted_profiles
from inserted_profiles;

select
  'partner_order_phones_missing_profiles_after_sync' as check_name,
  count(*) as value
from (
  select distinct
    public.normalize_vietnam_phone(
      coalesce(
        nullif(trim(customer_phone_key), ''),
        nullif(trim(customer_phone), '')
      )
    ) as phone
  from public.partner_orders
) po
left join public.profiles p
  on p.phone = po.phone
 and p.role = 'customer'
where po.phone <> ''
  and p.phone is null;
