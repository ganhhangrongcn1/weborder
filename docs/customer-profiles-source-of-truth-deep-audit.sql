-- Customer Profiles Source Of Truth - Phase 2 Deep Audit
-- Muc tieu: dao sau cac issue vua lo ra o Phase 1 de chot rule hydrate/refactor.
-- Script nay chi doc du lieu, khong update/insert/delete.

-- 1) Chi tiet 4 profile customer co phone khong hop le
select
  p.id,
  p.phone as raw_phone,
  regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') as digits_only,
  case
    when regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '84%' then
      '0' || substr(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 3)
    when regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '0084%' then
      '0' || substr(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 5)
    when length(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')) = 9 then
      '0' || regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
    else regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
  end as guessed_phone_key,
  p.name,
  p.email,
  p.registered,
  p.auth_user_id,
  p.total_orders,
  p.total_spent,
  p.member_rank,
  p.metadata,
  p.updated_at
from public.profiles p
where lower(coalesce(p.role, 'customer')) = 'customer'
  and (
    nullif(trim(coalesce(p.phone, '')), '') is null
    or trim(p.phone) !~ '^0[0-9]{9}$'
  )
order by p.updated_at desc;

-- 2) Profile registered nhung chua co auth/email:
-- xem co loyalty/order hay partner order nao dang "nuoi" profile nay khong
with
web_stats as (
  select
    trim(coalesce(customer_phone, '')) as phone,
    count(*) as web_order_count,
    max(created_at) as last_web_order_at
  from public.orders
  where nullif(trim(coalesce(customer_phone, '')), '') is not null
  group by trim(coalesce(customer_phone, ''))
),
partner_stats as (
  select
    trim(coalesce(customer_phone_key, '')) as phone,
    count(*) as partner_order_count,
    max(created_at) as last_partner_order_at
  from public.partner_orders
  where nullif(trim(coalesce(customer_phone_key, '')), '') is not null
  group by trim(coalesce(customer_phone_key, ''))
),
loyalty_stats as (
  select
    trim(coalesce(customer_phone, '')) as phone,
    count(*) as loyalty_account_count,
    max(updated_at) as last_loyalty_at
  from public.loyalty_accounts
  where nullif(trim(coalesce(customer_phone, '')), '') is not null
  group by trim(coalesce(customer_phone, ''))
)
select
  p.id,
  p.phone,
  p.name,
  p.email,
  p.registered,
  p.auth_user_id,
  p.total_orders,
  p.total_spent,
  coalesce(w.web_order_count, 0) as web_order_count,
  w.last_web_order_at,
  coalesce(po.partner_order_count, 0) as partner_order_count,
  po.last_partner_order_at,
  coalesce(l.loyalty_account_count, 0) as loyalty_account_count,
  l.last_loyalty_at,
  p.updated_at
from public.profiles p
left join web_stats w on w.phone = trim(coalesce(p.phone, ''))
left join partner_stats po on po.phone = trim(coalesce(p.phone, ''))
left join loyalty_stats l on l.phone = trim(coalesce(p.phone, ''))
where lower(coalesce(p.role, 'customer')) = 'customer'
  and coalesce(p.registered, false) = true
  and nullif(trim(coalesce(p.auth_user_id::text, '')), '') is null
  and nullif(trim(coalesce(p.email, '')), '') is null
order by p.updated_at desc;

-- 3) Web order 30 ngay thieu customer profile: xem row cu the
with order_phones as (
  select
    trim(coalesce(customer_phone, '')) as phone,
    min(created_at) as first_seen_at,
    max(created_at) as last_seen_at,
    count(*) as total_orders
  from public.orders
  where created_at >= now() - interval '30 days'
    and nullif(trim(coalesce(customer_phone, '')), '') is not null
  group by trim(coalesce(customer_phone, ''))
)
select
  op.phone,
  op.total_orders,
  op.first_seen_at,
  op.last_seen_at
from order_phones op
left join public.profiles p
  on trim(coalesce(p.phone, '')) = op.phone
  and lower(coalesce(p.role, 'customer')) = 'customer'
where p.id is null
order by op.last_seen_at desc;

-- 4) Partner phones 30 ngay thieu customer profile:
-- thong ke theo source + branch de biet no la legacy hay live issue rong
with partner_missing as (
  select
    trim(coalesce(po.customer_phone_key, '')) as phone,
    po.partner_source,
    coalesce(nullif(trim(coalesce(po.branch_name, '')), ''), '(unknown branch)') as branch_name,
    count(*) as total_orders,
    min(po.created_at) as first_seen_at,
    max(po.created_at) as last_seen_at
  from public.partner_orders po
  left join public.profiles p
    on trim(coalesce(p.phone, '')) = trim(coalesce(po.customer_phone_key, ''))
    and lower(coalesce(p.role, 'customer')) = 'customer'
  where po.created_at >= now() - interval '30 days'
    and nullif(trim(coalesce(po.customer_phone_key, '')), '') is not null
    and p.id is null
  group by
    trim(coalesce(po.customer_phone_key, '')),
    po.partner_source,
    coalesce(nullif(trim(coalesce(po.branch_name, '')), ''), '(unknown branch)')
)
select
  partner_source,
  branch_name,
  count(*) as total_missing_phones,
  sum(total_orders) as total_partner_orders,
  min(first_seen_at) as first_seen_at,
  max(last_seen_at) as last_seen_at
from partner_missing
group by partner_source, branch_name
order by total_missing_phones desc, total_partner_orders desc, partner_source, branch_name;

-- 5) Lay sample 20 phone partner thieu profile de review thu cong
with partner_missing as (
  select
    trim(coalesce(po.customer_phone_key, '')) as phone,
    min(po.partner_source) as partner_source,
    min(coalesce(nullif(trim(coalesce(po.branch_name, '')), ''), '(unknown branch)')) as branch_name,
    count(*) as total_orders,
    min(po.created_at) as first_seen_at,
    max(po.created_at) as last_seen_at,
    max(coalesce(nullif(trim(coalesce(po.customer_name, '')), ''), '')) as sample_customer_name
  from public.partner_orders po
  left join public.profiles p
    on trim(coalesce(p.phone, '')) = trim(coalesce(po.customer_phone_key, ''))
    and lower(coalesce(p.role, 'customer')) = 'customer'
  where po.created_at >= now() - interval '30 days'
    and nullif(trim(coalesce(po.customer_phone_key, '')), '') is not null
    and p.id is null
  group by trim(coalesce(po.customer_phone_key, ''))
)
select
  phone,
  partner_source,
  branch_name,
  sample_customer_name,
  total_orders,
  first_seen_at,
  last_seen_at
from partner_missing
order by total_orders desc, last_seen_at desc, phone
limit 20;

-- 6) Trong 307 phone partner thieu profile, bao nhieu so da co loyalty_account?
with partner_missing as (
  select distinct
    trim(coalesce(po.customer_phone_key, '')) as phone
  from public.partner_orders po
  left join public.profiles p
    on trim(coalesce(p.phone, '')) = trim(coalesce(po.customer_phone_key, ''))
    and lower(coalesce(p.role, 'customer')) = 'customer'
  where po.created_at >= now() - interval '30 days'
    and nullif(trim(coalesce(po.customer_phone_key, '')), '') is not null
    and p.id is null
),
loyalty_match as (
  select distinct
    trim(coalesce(customer_phone, '')) as phone
  from public.loyalty_accounts
  where nullif(trim(coalesce(customer_phone, '')), '') is not null
)
select
  count(*) as total_missing_partner_phones,
  count(*) filter (where lm.phone is not null) as already_has_loyalty_account,
  count(*) filter (where lm.phone is null) as no_loyalty_account_yet
from partner_missing pm
left join loyalty_match lm on lm.phone = pm.phone;

-- 7) Sample 20 phone partner thieu profile nhung da co loyalty_account
with partner_missing as (
  select distinct
    trim(coalesce(po.customer_phone_key, '')) as phone
  from public.partner_orders po
  left join public.profiles p
    on trim(coalesce(p.phone, '')) = trim(coalesce(po.customer_phone_key, ''))
    and lower(coalesce(p.role, 'customer')) = 'customer'
  where po.created_at >= now() - interval '30 days'
    and nullif(trim(coalesce(po.customer_phone_key, '')), '') is not null
    and p.id is null
)
select
  pm.phone,
  la.points,
  la.available_points,
  la.total_spent,
  la.total_orders,
  la.updated_at
from partner_missing pm
join public.loyalty_accounts la
  on trim(coalesce(la.customer_phone, '')) = pm.phone
order by la.updated_at desc
limit 20;

-- 8) Summary phuc vu quyet dinh phase tiep theo
with
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
web_missing as (
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
partner_missing as (
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
),
partner_missing_with_loyalty as (
  select count(*) as total
  from (
    with partner_missing_phones as (
      select distinct trim(coalesce(po.customer_phone_key, '')) as phone
      from public.partner_orders po
      left join public.profiles p
        on trim(coalesce(p.phone, '')) = trim(coalesce(po.customer_phone_key, ''))
        and lower(coalesce(p.role, 'customer')) = 'customer'
      where po.created_at >= now() - interval '30 days'
        and nullif(trim(coalesce(po.customer_phone_key, '')), '') is not null
        and p.id is null
    )
    select pm.phone
    from partner_missing_phones pm
    join public.loyalty_accounts la
      on trim(coalesce(la.customer_phone, '')) = pm.phone
  ) x
)
select 'customer_profiles_invalid_phone' as issue, total from invalid_phone
union all
select 'registered_customer_profiles_without_auth_or_email', total from registered_without_auth
union all
select 'web_order_phones_30d_missing_customer_profile', total from web_missing
union all
select 'partner_order_phones_30d_missing_customer_profile', total from partner_missing
union all
select 'partner_missing_customer_profile_but_has_loyalty_account', total from partner_missing_with_loyalty
order by issue;
