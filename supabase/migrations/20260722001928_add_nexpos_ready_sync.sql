alter table public.partner_orders
  add column if not exists nexpos_ready_sync_status text not null default 'not_requested',
  add column if not exists nexpos_ready_synced_at timestamptz,
  add column if not exists nexpos_ready_sync_attempts integer not null default 0,
  add column if not exists nexpos_ready_sync_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_orders_nexpos_ready_sync_status_check'
      and conrelid = 'public.partner_orders'::regclass
  ) then
    alter table public.partner_orders
      add constraint partner_orders_nexpos_ready_sync_status_check
      check (nexpos_ready_sync_status in ('not_requested', 'pending', 'success', 'failed'));
  end if;
end
$$;

create index if not exists partner_orders_nexpos_ready_sync_retry_idx
on public.partner_orders (nexpos_ready_sync_status, updated_at desc)
where nexpos_ready_sync_status in ('pending', 'failed');

create table if not exists public.integration_sessions (
  integration_key text primary key,
  session_value text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.integration_sessions enable row level security;

revoke all on table public.integration_sessions from anon, authenticated;
grant all on table public.integration_sessions to service_role;

comment on table public.integration_sessions is
'Server-only integration sessions. Values are readable only with the Supabase service role.';

comment on column public.integration_sessions.session_value is
'Sensitive server-side session value. Never expose this column through frontend queries.';

notify pgrst, 'reload schema';
