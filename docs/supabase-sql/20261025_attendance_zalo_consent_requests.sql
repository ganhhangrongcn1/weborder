-- Only verified webhook events enter this inbox. No public/client access.
-- No Zalo-to-Auth mapping exists in the demo: never guess a user to delete.
create table if not exists public.attendance_zalo_consent_requests (
  event_key text primary key check (event_key ~ '^[a-f0-9]{64}$'),
  app_id text not null check (app_id = '2442731166050783503'),
  zalo_user_id text not null check (zalo_user_id ~ '^[0-9]{1,64}$'),
  event_timestamp bigint,
  status text not null default 'pending_identity_review'
    check (status in ('pending_identity_review', 'completed')),
  received_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'completed') = (completed_at is not null))
);
alter table public.attendance_zalo_consent_requests enable row level security;
revoke all on public.attendance_zalo_consent_requests from public, anon, authenticated;
grant select, insert, update, delete on public.attendance_zalo_consent_requests to service_role;
comment on table public.attendance_zalo_consent_requests is
  'Verified Zalo revocation inbox. Pending means not deleted. Restricted to server-side processing.';
