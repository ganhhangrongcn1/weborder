create extension if not exists pgcrypto;

alter table public.branches
  add column if not exists branch_uuid uuid;

alter table public.branches
  alter column branch_uuid set default gen_random_uuid();

update public.branches
set branch_uuid = gen_random_uuid()
where branch_uuid is null;

create unique index if not exists branches_branch_uuid_unique
on public.branches (branch_uuid);

notify pgrst, 'reload schema';
