create table if not exists public.partner_review_worker_settings (
  id text primary key default 'default',
  sync_interval_minutes integer not null default 60,
  last_worker_cycle_at timestamptz,
  next_worker_cycle_at timestamptz,
  last_worker_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_review_worker_settings_singleton_check check (id = 'default'),
  constraint partner_review_worker_settings_interval_check check (sync_interval_minutes between 5 and 1440)
);

alter table public.partner_review_worker_settings enable row level security;
revoke all on table public.partner_review_worker_settings from anon, authenticated;
grant select, insert, update on table public.partner_review_worker_settings to service_role;

insert into public.partner_review_worker_settings (id, sync_interval_minutes)
values ('default', 60)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
