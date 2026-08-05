create table if not exists public.partner_grab_finance_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.partner_review_sources(id) on delete cascade,
  branch_uuid uuid references public.branches(branch_uuid) on delete set null,
  branch_code text,
  snapshot_date date not null,
  currency text not null default 'VND',
  net_revenue_amount bigint,
  net_income_amount bigint not null,
  raw_data jsonb not null default '{}'::jsonb,
  first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_grab_finance_currency_length check (char_length(currency) between 1 and 10),
  constraint partner_grab_finance_branch_code_length check (branch_code is null or char_length(branch_code) <= 64),
  constraint partner_grab_finance_source_date_key unique (source_id, snapshot_date)
);

create index if not exists partner_grab_finance_branch_date_idx on public.partner_grab_finance_snapshots(branch_uuid, snapshot_date desc);
create index if not exists partner_grab_finance_date_idx on public.partner_grab_finance_snapshots(snapshot_date desc);
alter table public.partner_grab_finance_snapshots enable row level security;
grant select, insert, update on public.partner_grab_finance_snapshots to service_role;
revoke all on public.partner_grab_finance_snapshots from anon, authenticated;
drop policy if exists "deny direct access to partner grab finance" on public.partner_grab_finance_snapshots;
create policy "deny direct access to partner grab finance" on public.partner_grab_finance_snapshots
  for all to anon, authenticated using (false) with check (false);
comment on table public.partner_grab_finance_snapshots is 'Server-only Grab merchant finance snapshots collected by the existing partner review worker.';
notify pgrst, 'reload schema';
