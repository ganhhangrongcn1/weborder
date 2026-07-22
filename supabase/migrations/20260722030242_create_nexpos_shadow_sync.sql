create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

create table if not exists public.nexpos_shadow_sync_control (
  control_key text primary key,
  mode text not null default 'compare_only',
  cron_secret text not null default gen_random_uuid()::text,
  locked_until timestamptz,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_success_at timestamptz,
  consecutive_failures integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint nexpos_shadow_sync_control_mode_check
    check (mode in ('disabled', 'compare_only'))
);

insert into public.nexpos_shadow_sync_control (control_key, mode)
values ('nexpos_partner_orders', 'compare_only')
on conflict (control_key) do nothing;

create table if not exists public.nexpos_shadow_orders (
  id uuid primary key default gen_random_uuid(),
  partner_source text not null,
  nexpos_order_id text not null,
  display_order_code text,
  nexpos_status text,
  nexpos_hub_id text,
  nexpos_site_id text,
  order_time timestamptz,
  total_amount numeric,
  item_count integer not null default 0,
  payload_hash text not null,
  raw_data jsonb not null default '{}'::jsonb,
  comparison_status text not null default 'pending',
  comparison_differences jsonb not null default '[]'::jsonb,
  matched_partner_order_id uuid references public.partner_orders(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_compared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nexpos_shadow_orders_comparison_status_check
    check (comparison_status in ('pending', 'matched', 'mismatch', 'missing_in_n8n')),
  constraint nexpos_shadow_orders_source_order_unique
    unique (partner_source, nexpos_order_id)
);

create index if not exists nexpos_shadow_orders_last_seen_idx
on public.nexpos_shadow_orders (last_seen_at desc);

create index if not exists nexpos_shadow_orders_comparison_idx
on public.nexpos_shadow_orders (comparison_status, last_seen_at desc);

create table if not exists public.nexpos_shadow_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  hub_count integer not null default 0,
  request_count integer not null default 0,
  observed_count integer not null default 0,
  matched_count integer not null default 0,
  mismatch_count integer not null default 0,
  missing_count integer not null default 0,
  skipped_reason text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint nexpos_shadow_sync_runs_status_check
    check (status in ('running', 'success', 'partial', 'failed', 'skipped'))
);

create index if not exists nexpos_shadow_sync_runs_started_idx
on public.nexpos_shadow_sync_runs (started_at desc);

alter table public.nexpos_shadow_sync_control enable row level security;
alter table public.nexpos_shadow_orders enable row level security;
alter table public.nexpos_shadow_sync_runs enable row level security;

revoke all on table public.nexpos_shadow_sync_control from anon, authenticated;
revoke all on table public.nexpos_shadow_orders from anon, authenticated;
revoke all on table public.nexpos_shadow_sync_runs from anon, authenticated;
grant all on table public.nexpos_shadow_sync_control to service_role;
grant all on table public.nexpos_shadow_orders to service_role;
grant all on table public.nexpos_shadow_sync_runs to service_role;

comment on table public.nexpos_shadow_orders is
'Compare-only NexPOS observations. This table never drives Kitchen or partner order operations.';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'nexpos-shadow-sync-every-30-seconds') then
    perform cron.unschedule('nexpos-shadow-sync-every-30-seconds');
  end if;
end
$$;

select cron.schedule(
  'nexpos-shadow-sync-every-30-seconds',
  '30 seconds',
  $cron$
    select net.http_post(
      url := 'https://qjaklysckgzdfjthzkzu.supabase.co/functions/v1/nexpos-order-shadow-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select cron_secret
          from public.nexpos_shadow_sync_control
          where control_key = 'nexpos_partner_orders'
        )
      ),
      body := jsonb_build_object('trigger', 'supabase_cron'),
      timeout_milliseconds := 20000
    );
  $cron$
);

notify pgrst, 'reload schema';
