-- Allow a signed-in supervisor to read only their own checklist access grants.

begin;

drop policy if exists checklist_access_self_read on public.checklist_user_access;
create policy checklist_access_self_read
on public.checklist_user_access
for select
to authenticated
using (auth_user_id = (select auth.uid()));

notify pgrst, 'reload schema';
commit;
