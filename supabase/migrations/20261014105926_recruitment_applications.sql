-- Server-only recruitment intake. No applicant data is readable through public clients.
create table if not exists public.recruitment_applications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  phone text not null check (phone ~ '^0[35789][0-9]{8}$'),
  application jsonb not null check (jsonb_typeof(application) = 'object'),
  submitted_at timestamptz not null default now(),
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sending', 'sent', 'failed')),
  notification_attempts integer not null default 0,
  notification_next_attempt_at timestamptz not null default now(),
  notification_lease uuid,
  notification_lease_until timestamptz,
  notification_last_error text,
  notified_at timestamptz
);
create index if not exists recruitment_phone_time_idx on public.recruitment_applications(phone, submitted_at desc);
create index if not exists recruitment_ip_time_idx on public.recruitment_applications(ip_hash, submitted_at desc);
create index if not exists recruitment_notification_queue_idx
  on public.recruitment_applications(notification_next_attempt_at) where notification_status <> 'sent';
alter table public.recruitment_applications enable row level security;
revoke all on public.recruitment_applications from public, anon, authenticated;
grant select, insert, update on public.recruitment_applications to service_role;

create or replace function public.submit_recruitment_application(
  p_request_id uuid, p_fingerprint text, p_ip_hash text, p_application jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  existing public.recruitment_applications%rowtype;
  new_id uuid;
  applicant_phone text := p_application->>'phone';
begin
  -- Low-volume intake: one transaction lock makes admission/rate checks race-safe.
  perform pg_advisory_xact_lock(hashtextextended('ghr-recruitment-intake', 0));
  if p_request_id is null or p_fingerprint is null or p_ip_hash is null
    or p_fingerprint !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$'
    or applicant_phone is null or applicant_phone !~ '^0[35789][0-9]{8}$'
    or jsonb_typeof(p_application) is distinct from 'object' then
    raise exception 'INVALID_APPLICATION';
  end if;
  select * into existing from public.recruitment_applications where request_id = p_request_id;
  if found then
    if existing.fingerprint <> p_fingerprint then raise exception 'REQUEST_CONFLICT'; end if;
    return jsonb_build_object('applicationId', existing.id, 'duplicate', true);
  end if;
  -- Also protects refresh/resubmission of the identical application with a new key.
  select * into existing from public.recruitment_applications
    where phone = applicant_phone and fingerprint = p_fingerprint
      and submitted_at > now() - interval '24 hours' limit 1;
  if found then return jsonb_build_object('applicationId', existing.id, 'duplicate', true); end if;
  if (select count(*) from public.recruitment_applications
      where phone = applicant_phone and submitted_at > now() - interval '24 hours') >= 3
    or (select count(*) from public.recruitment_applications
      where ip_hash = p_ip_hash and submitted_at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.recruitment_applications(request_id, fingerprint, ip_hash, phone, application)
    values(p_request_id, p_fingerprint, p_ip_hash, applicant_phone, p_application) returning id into new_id;
  return jsonb_build_object('applicationId', new_id, 'duplicate', false);
end $$;
revoke all on function public.submit_recruitment_application(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_recruitment_application(uuid, text, text, jsonb) to service_role;

create or replace function public.claim_recruitment_notifications()
returns setof public.recruitment_applications language sql security invoker set search_path = '' as $$
  update public.recruitment_applications a
    set notification_status = 'sending', notification_attempts = notification_attempts + 1,
        notification_lease = gen_random_uuid(), notification_lease_until = now() + interval '2 minutes'
    where a.id in (
      select id from public.recruitment_applications
      where notification_status <> 'sent' and notification_attempts < 5
        and notification_next_attempt_at <= now()
        and (notification_lease_until is null or notification_lease_until < now())
      order by submitted_at limit 10 for update skip locked
    ) returning a.*;
$$;
revoke all on function public.claim_recruitment_notifications() from public, anon, authenticated;
grant execute on function public.claim_recruitment_notifications() to service_role;
notify pgrst, 'reload schema';
