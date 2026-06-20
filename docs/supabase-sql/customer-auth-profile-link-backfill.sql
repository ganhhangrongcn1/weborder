-- Link existing customer profiles to Supabase Auth users.
-- Use this when an Auth user already exists with email like 0976315938@phone.ghr.vn
-- but public.profiles.auth_user_id is still null.
--
-- Safe to run multiple times.

update public.profiles p
set
  auth_user_id = u.id,
  email = coalesce(nullif(p.email, ''), u.email),
  registered = true,
  updated_at = now()
from auth.users u
where p.role = 'customer'
  and nullif(trim(p.phone), '') is not null
  and p.auth_user_id is null
  and lower(u.email) = lower(trim(p.phone) || '@phone.ghr.vn');

-- Verification: remaining customer profiles with Auth-style email but no link.
select
  p.phone,
  p.name,
  p.email,
  p.auth_user_id,
  u.id as matching_auth_user_id
from public.profiles p
left join auth.users u
  on lower(u.email) = lower(trim(p.phone) || '@phone.ghr.vn')
where p.role = 'customer'
  and p.auth_user_id is null
  and u.id is not null
order by p.updated_at desc;
