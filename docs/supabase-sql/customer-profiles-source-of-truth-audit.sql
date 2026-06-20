-- Customer Profiles Source Of Truth - Phase 1 Audit
-- Muc tieu: kiem tra profiles cua khach hang dang duoc tao/sync the nao.
-- Script nay chi doc du lieu, khong update/insert/delete.

-- 1) Kiem tra cot lien quan trong profiles
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in (
    'id',
    'phone',
    'name',
    'email',
    'auth_user_id',
    'registered',
    'role',
    'status',
    'total_orders',
    'total_spent',
    'member_rank',
    'metadata',
    'created_at',
    'updated_at'
  )
order by ordinal_position;

-- 2) Kiem tra unique/index/foreign key lien quan profiles
select
  con.conname as constraint_name,
  rel.relname as table_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'profiles'
order by con.conname;

-- 3) Snapshot role trong profiles
select
  lower(coalesce(role, '(null)')) as role,
  lower(coalesce(status, '(null)')) as status,
  count(*) as total
from public.profiles
group by lower(coalesce(role, '(null)')), lower(coalesce(status, '(null)'))
order by role, status;

-- 4) Customer profiles tong quan
select
  count(*) as total_customer_profiles,
  count(*) filter (where coalesce(registered, false) = true) as registered_profiles,
  count(*) filter (where nullif(trim(coalesce(auth_user_id::text, '')), '') is not null) as linked_auth_profiles,
  count(*) filter (where nullif(trim(coalesce(email, '')), '') is not null) as profiles_with_email,
  count(*) filter (where nullif(trim(coalesce(name, '')), '') is not null) as profiles_with_name
from public.profiles
where lower(coalesce(role, 'customer')) = 'customer';

-- 5) Customer profiles co auth_user_id bi trung
select
  auth_user_id,
  count(*) as total
from public.profiles
where lower(coalesce(role, 'customer')) = 'customer'
  and auth_user_id is not null
group by auth_user_id
having count(*) > 1
order by total desc;

-- 6) Customer profiles co phone khong hop le sau normalize co ban
select
  id,
  phone,
  name,
  email,
  registered,
  auth_user_id,
  updated_at
from public.profiles
where lower(coalesce(role, 'customer')) = 'customer'
  and (
    nullif(trim(coalesce(phone, '')), '') is null
    or trim(phone) !~ '^0[0-9]{9}$'
  )
order by updated_at desc
limit 100;

-- 7) Customer profiles registered nhung chua co auth/email
select
  id,
  phone,
  name,
  email,
  registered,
  auth_user_id,
  total_orders,
  total_spent,
  updated_at
from public.profiles
where lower(coalesce(role, 'customer')) = 'customer'
  and coalesce(registered, false) = true
  and nullif(trim(coalesce(auth_user_id::text, '')), '') is null
  and nullif(trim(coalesce(email, '')), '') is null
order by updated_at desc
limit 100;

-- 8) Customer profiles co auth_user_id nhung ten/email rong
select
  id,
  phone,
  name,
  email,
  registered,
  auth_user_id,
  updated_at
from public.profiles
where lower(coalesce(role, 'customer')) = 'customer'
  and auth_user_id is not null
  and (
    nullif(trim(coalesce(name, '')), '') is null
    or nullif(trim(coalesce(email, '')), '') is null
  )
order by updated_at desc
limit 100;

-- 9) Khach co web orders 30 ngay gan nhat nhung chua co profile customer
with order_phones as (
  select distinct
    trim(coalesce(customer_phone, '')) as phone
  from public.orders
  where created_at >= now() - interval '30 days'
    and nullif(trim(coalesce(customer_phone, '')), '') is not null
)
select
  op.phone
from order_phones op
left join public.profiles p
  on trim(coalesce(p.phone, '')) = op.phone
  and lower(coalesce(p.role, 'customer')) = 'customer'
where p.id is null
order by op.phone
limit 100;

-- 10) Khach co partner orders 30 ngay gan nhat nhung chua co profile customer
with partner_phones as (
  select distinct
    trim(coalesce(customer_phone_key, '')) as phone
  from public.partner_orders
  where created_at >= now() - interval '30 days'
    and nullif(trim(coalesce(customer_phone_key, '')), '') is not null
)
select
  pp.phone
from partner_phones pp
left join public.profiles p
  on trim(coalesce(p.phone, '')) = pp.phone
  and lower(coalesce(p.role, 'customer')) = 'customer'
where p.id is null
order by pp.phone
limit 100;

-- 11) Customer profiles co order/partner order nhung ten van placeholder
with order_stats as (
  select
    trim(coalesce(customer_phone, '')) as phone,
    count(*) as web_order_count
  from public.orders
  where nullif(trim(coalesce(customer_phone, '')), '') is not null
  group by trim(coalesce(customer_phone, ''))
),
partner_stats as (
  select
    trim(coalesce(customer_phone_key, '')) as phone,
    count(*) as partner_order_count
  from public.partner_orders
  where nullif(trim(coalesce(customer_phone_key, '')), '') is not null
  group by trim(coalesce(customer_phone_key, ''))
)
select
  p.id,
  p.phone,
  p.name,
  p.email,
  p.registered,
  coalesce(os.web_order_count, 0) as web_order_count,
  coalesce(ps.partner_order_count, 0) as partner_order_count,
  p.updated_at
from public.profiles p
left join order_stats os on os.phone = trim(coalesce(p.phone, ''))
left join partner_stats ps on ps.phone = trim(coalesce(p.phone, ''))
where lower(coalesce(p.role, 'customer')) = 'customer'
  and (coalesce(os.web_order_count, 0) > 0 or coalesce(ps.partner_order_count, 0) > 0)
  and lower(trim(coalesce(p.name, ''))) in ('', 'khach', 'khach hang', 'khach vang lai', 'khách', 'khách hàng', 'khách vãng lai')
order by p.updated_at desc
limit 100;

-- 12) Customer profiles khong co order, khong co partner order, khong co loyalty
with order_phones as (
  select distinct trim(coalesce(customer_phone, '')) as phone
  from public.orders
  where nullif(trim(coalesce(customer_phone, '')), '') is not null
),
partner_phones as (
  select distinct trim(coalesce(customer_phone_key, '')) as phone
  from public.partner_orders
  where nullif(trim(coalesce(customer_phone_key, '')), '') is not null
),
loyalty_phones as (
  select distinct trim(coalesce(customer_phone, '')) as phone
  from public.loyalty_accounts
  where nullif(trim(coalesce(customer_phone, '')), '') is not null
)
select
  p.id,
  p.phone,
  p.name,
  p.email,
  p.registered,
  p.auth_user_id,
  p.updated_at
from public.profiles p
left join order_phones o on o.phone = trim(coalesce(p.phone, ''))
left join partner_phones po on po.phone = trim(coalesce(p.phone, ''))
left join loyalty_phones l on l.phone = trim(coalesce(p.phone, ''))
where lower(coalesce(p.role, 'customer')) = 'customer'
  and o.phone is null
  and po.phone is null
  and l.phone is null
order by p.updated_at desc
limit 100;

-- 13) Tong hop issue chinh truoc phase write-path/refactor
with
duplicate_auth as (
  select count(*) as total
  from (
    select auth_user_id
    from public.profiles
    where lower(coalesce(role, 'customer')) = 'customer'
      and auth_user_id is not null
    group by auth_user_id
    having count(*) > 1
  ) x
),
invalid_phone as (
  select count(*) as total
  from public.profiles
  where lower(coalesce(role, 'customer')) = 'customer'
    and (
      nullif(trim(coalesce(phone, '')), '') is null
      or trim(phone) !~ '^0[0-9]{9}$'
    )
),
registered_without_auth as (
  select count(*) as total
  from public.profiles
  where lower(coalesce(role, 'customer')) = 'customer'
    and coalesce(registered, false) = true
    and nullif(trim(coalesce(auth_user_id::text, '')), '') is null
    and nullif(trim(coalesce(email, '')), '') is null
),
web_missing_profile as (
  select count(*) as total
  from (
    with order_phones as (
      select distinct trim(coalesce(customer_phone, '')) as phone
      from public.orders
      where created_at >= now() - interval '30 days'
        and nullif(trim(coalesce(customer_phone, '')), '') is not null
    )
    select op.phone
    from order_phones op
    left join public.profiles p
      on trim(coalesce(p.phone, '')) = op.phone
      and lower(coalesce(p.role, 'customer')) = 'customer'
    where p.id is null
  ) x
),
partner_missing_profile as (
  select count(*) as total
  from (
    with partner_phones as (
      select distinct trim(coalesce(customer_phone_key, '')) as phone
      from public.partner_orders
      where created_at >= now() - interval '30 days'
        and nullif(trim(coalesce(customer_phone_key, '')), '') is not null
    )
    select pp.phone
    from partner_phones pp
    left join public.profiles p
      on trim(coalesce(p.phone, '')) = pp.phone
      and lower(coalesce(p.role, 'customer')) = 'customer'
    where p.id is null
  ) x
)
select 'customer_profiles_duplicate_auth_user_id' as issue, total from duplicate_auth
union all
select 'customer_profiles_invalid_phone', total from invalid_phone
union all
select 'registered_customer_profiles_without_auth_or_email', total from registered_without_auth
union all
select 'web_order_phones_30d_missing_customer_profile', total from web_missing_profile
union all
select 'partner_order_phones_30d_missing_customer_profile', total from partner_missing_profile
order by issue;
