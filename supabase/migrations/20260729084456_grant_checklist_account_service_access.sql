begin;

grant select, insert, update, delete
on table public.checklist_user_access
to service_role;

grant select
on table public.branches
to service_role;

grant select, insert, update, delete
on table public.profiles
to service_role;

commit;
