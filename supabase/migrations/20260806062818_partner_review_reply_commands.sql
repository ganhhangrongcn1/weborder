create table if not exists public.partner_review_reply_commands (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.partner_reviews(id) on update cascade on delete cascade,
  source_id uuid not null references public.partner_review_sources(id) on update cascade on delete restrict,
  external_review_id text not null,
  merchant_id text not null,
  reply_text text not null,
  status text not null default 'pending',
  requested_by uuid not null,
  worker_id text,
  attempt_count integer not null default 0,
  claimed_at timestamptz,
  finished_at timestamptz,
  error_message text,
  response_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_review_reply_commands_status_check
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  constraint partner_review_reply_commands_reply_text_check
    check (char_length(btrim(reply_text)) between 1 and 500),
  constraint partner_review_reply_commands_attempt_count_check
    check (attempt_count between 0 and 3)
);

create unique index if not exists partner_review_reply_commands_active_review_key
  on public.partner_review_reply_commands (review_id)
  where status in ('pending', 'processing', 'succeeded');

create index if not exists partner_review_reply_commands_pending_idx
  on public.partner_review_reply_commands (created_at)
  where status = 'pending';

create index if not exists partner_review_reply_commands_source_created_idx
  on public.partner_review_reply_commands (source_id, created_at desc);

alter table public.partner_review_reply_commands enable row level security;
revoke all on table public.partner_review_reply_commands from anon, authenticated;
grant select, insert, update, delete on table public.partner_review_reply_commands to service_role;

comment on table public.partner_review_reply_commands is
  'Private idempotent queue for admin-authored partner review replies executed by the local Grab worker.';

notify pgrst, 'reload schema';
