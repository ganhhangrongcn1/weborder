alter table public.partner_review_sources
  add column if not exists store_control_action text,
  add column if not exists store_control_status text not null default 'idle',
  add column if not exists store_control_requested_at timestamptz,
  add column if not exists store_control_finished_at timestamptz,
  add column if not exists store_control_error text;

alter table public.partner_review_sources
  drop constraint if exists partner_review_sources_store_control_action_check;

alter table public.partner_review_sources
  add constraint partner_review_sources_store_control_action_check
  check (store_control_action is null or store_control_action in ('busy', 'normal'));

alter table public.partner_review_sources
  drop constraint if exists partner_review_sources_store_control_status_check;

alter table public.partner_review_sources
  add constraint partner_review_sources_store_control_status_check
  check (store_control_status in ('idle', 'pending', 'running', 'success', 'error'));

create index if not exists partner_review_sources_store_control_pending_idx
  on public.partner_review_sources (store_control_requested_at)
  where store_control_status = 'pending';

comment on column public.partner_review_sources.store_control_action is
  'Latest explicit Grab store-state command requested by an admin: busy or normal.';

notify pgrst, 'reload schema';
