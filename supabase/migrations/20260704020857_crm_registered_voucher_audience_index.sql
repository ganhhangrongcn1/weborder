-- Speed up CRM voucher audience reads without indexing guest profiles.
create index if not exists profiles_registered_customer_phone_idx
on public.profiles (phone)
where registered = true
  and role = 'customer';

analyze public.profiles;
