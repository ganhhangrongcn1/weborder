begin;

grant usage on schema public to service_role;
grant select on table public.profiles to service_role;

notify pgrst, 'reload schema';

commit;
