create table public.nexpos_wss_inspection_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check(status in ('active','captured','finished','failed')),
  hubs text[] not null,
  leased_until timestamptz,
  messages integer not null default 0,
  observations jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  check(expires_at>started_at and expires_at<=started_at+interval '10 minutes'),
  check(jsonb_typeof(observations)='array' and jsonb_array_length(observations)<=20)
);
alter table public.nexpos_wss_inspection_runs enable row level security;
revoke all on public.nexpos_wss_inspection_runs from public,anon,authenticated;
grant all on public.nexpos_wss_inspection_runs to service_role;
notify pgrst,'reload schema';
