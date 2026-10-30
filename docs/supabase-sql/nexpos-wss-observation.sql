-- Observation only. Does not alter polling, orders, loyalty, inventory or print jobs.
create table if not exists public.nexpos_event_workers (
  worker_id text primary key,
  token_sha256 text not null check (token_sha256 ~ '^[a-f0-9]{64}$'),
  hub_ids text[] not null check (cardinality(hub_ids) between 1 and 4),
  enabled boolean not null default false,
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  last_bootstrap_at timestamptz,
  last_report jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.nexpos_event_workers enable row level security;
revoke all on public.nexpos_event_workers from public, anon, authenticated;
grant select, insert, update, delete on public.nexpos_event_workers to service_role;
comment on table public.nexpos_event_workers is
  'Metadata-only WSS observation enrollment. No permission to ingest orders.';
