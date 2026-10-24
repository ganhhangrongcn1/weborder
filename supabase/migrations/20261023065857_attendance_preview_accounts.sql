-- Isolated Testing data. Not the production payroll/HR source of truth.
create table if not exists public.attendance_preview_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  employee_code text not null unique,
  role text not null default 'employee' check (role = 'employee'),
  is_active boolean not null default true,
  state jsonb not null default '{"version":1,"records":[],"requests":[],"phones":{}}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  constraint attendance_preview_state_valid check (
    state->>'version' = '1'
    and jsonb_typeof(state->'records') = 'array'
    and jsonb_typeof(state->'requests') = 'array'
    and jsonb_typeof(state->'phones') = 'object'
    and octet_length(state::text) <= 1048576
  )
);
alter table public.attendance_preview_accounts enable row level security;
revoke all on public.attendance_preview_accounts from public, anon, authenticated;
grant select on public.attendance_preview_accounts to authenticated;
grant update (state,revision) on public.attendance_preview_accounts to authenticated;
create policy attendance_preview_self_read on public.attendance_preview_accounts
  for select to authenticated using (user_id = (select auth.uid()) and is_active);
create policy attendance_preview_self_update on public.attendance_preview_accounts
  for update to authenticated
  using (user_id = (select auth.uid()) and is_active)
  with check (user_id = (select auth.uid()) and is_active);
comment on table public.attendance_preview_accounts is 'Zalo attendance Testing only; isolated from employee and payroll tables; provision accounts server-side.';
notify pgrst, 'reload schema';
