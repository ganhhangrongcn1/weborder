begin;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'admin', 'staff', 'kitchen', 'shipper', 'supervisor'));

notify pgrst, 'reload schema';

commit;
