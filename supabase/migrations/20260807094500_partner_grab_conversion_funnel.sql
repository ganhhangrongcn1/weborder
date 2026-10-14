create table if not exists public.partner_grab_conversion_funnel_daily (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.partner_review_sources(id) on delete cascade,
  branch_uuid uuid references public.branches(branch_uuid) on delete set null,
  branch_code text,
  metric_date date not null,
  reach_count bigint not null default 0,
  visit_count bigint not null default 0,
  basket_count bigint not null default 0,
  order_count bigint not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_grab_conversion_funnel_counts_nonnegative check (
    reach_count >= 0
    and visit_count >= 0
    and basket_count >= 0
    and order_count >= 0
  ),
  constraint partner_grab_conversion_funnel_source_date_key unique (source_id, metric_date)
);
create index if not exists partner_grab_conversion_funnel_branch_date_idx
  on public.partner_grab_conversion_funnel_daily(branch_uuid, metric_date desc);
create index if not exists partner_grab_conversion_funnel_date_idx
  on public.partner_grab_conversion_funnel_daily(metric_date desc);
alter table public.partner_grab_conversion_funnel_daily enable row level security;
grant select, insert, update on public.partner_grab_conversion_funnel_daily to service_role;
revoke all on public.partner_grab_conversion_funnel_daily from anon, authenticated;
drop policy if exists "deny direct access to partner grab conversion funnel"
  on public.partner_grab_conversion_funnel_daily;
create policy "deny direct access to partner grab conversion funnel"
  on public.partner_grab_conversion_funnel_daily
  for all to anon, authenticated using (false) with check (false);
comment on table public.partner_grab_conversion_funnel_daily is
  'Server-only daily Grab customer reach and conversion funnel collected by the partner review worker.';
notify pgrst, 'reload schema';
