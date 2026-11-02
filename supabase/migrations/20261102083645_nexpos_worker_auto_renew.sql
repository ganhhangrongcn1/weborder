-- Renew only on an authenticated report accepted by the existing broker.
-- Keep token, enabled state, HUB scope and expiry revocation authoritative.
alter table public.nexpos_event_workers
  add column if not exists auto_renew_enabled boolean not null default false,
  add column if not exists auto_renewed_at timestamptz;

create or replace function public.nexpos_renew_worker_on_report()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare stamp timestamptz := clock_timestamp();
begin
  if old.auto_renew_enabled and new.auto_renew_enabled
    and old.enabled and new.enabled
    and old.sync_enabled and new.sync_enabled
    and old.id_sync_enabled and new.id_sync_enabled
    and new.worker_id = old.worker_id
    and new.token_sha256 = old.token_sha256
    and new.hub_ids is not distinct from old.hub_ids
    and new.expires_at is not distinct from old.expires_at
    and old.expires_at > stamp
    and old.expires_at <= stamp + interval '4 days'
    and new.last_seen_at > coalesce(old.last_seen_at, '-infinity'::timestamptz)
    and new.last_seen_at between stamp - interval '1 minute' and stamp + interval '5 seconds'
    and new.last_report->>'connected' = 'true'
  then
    new.expires_at := stamp + interval '7 days';
    new.auto_renewed_at := stamp;
  end if;
  return new;
end $$;

revoke all on function public.nexpos_renew_worker_on_report() from public, anon, authenticated;
grant execute on function public.nexpos_renew_worker_on_report() to service_role;

drop trigger if exists nexpos_worker_auto_renew on public.nexpos_event_workers;
create trigger nexpos_worker_auto_renew
before update of last_seen_at on public.nexpos_event_workers
for each row execute function public.nexpos_renew_worker_on_report();

-- Explicit opt-in for the authorized worker only; do not resurrect an expiry.
update public.nexpos_event_workers set auto_renew_enabled = true
where worker_id = 'vncloud-primary' and enabled and sync_enabled
  and id_sync_enabled and expires_at > clock_timestamp();

notify pgrst, 'reload schema';
