create table if not exists public.partner_grab_marketing_keywords (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.partner_review_sources(id) on delete cascade,
  branch_uuid uuid null,
  branch_code text null,
  advertiser_id text not null,
  report_from date not null,
  report_to date not null,
  keyword_key text not null,
  keyword_text text not null,
  currency text not null default 'VND',
  spend_amount bigint not null default 0,
  sales_amount bigint not null default 0,
  orders_count integer not null default 0,
  impressions_count integer not null default 0,
  clicks_count integer not null default 0,
  source_row_count integer not null default 0,
  raw_rows jsonb not null default '[]'::jsonb,
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, report_from, report_to, keyword_key)
);
create index if not exists partner_grab_marketing_keywords_period_idx on public.partner_grab_marketing_keywords (report_from, report_to, source_id);
create table if not exists public.partner_grab_marketing_api_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.partner_review_sources(id) on delete cascade,
  branch_uuid uuid null,
  branch_code text null,
  advertiser_id text not null,
  report_from date not null,
  report_to date not null,
  endpoint_key text not null,
  request_url text not null,
  request_body jsonb not null default '{}'::jsonb,
  response_body jsonb not null default '{}'::jsonb,
  response_shape jsonb not null default '{}'::jsonb,
  row_count integer not null default 0,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, report_from, report_to, endpoint_key)
);
create index if not exists partner_grab_marketing_api_snapshots_period_idx on public.partner_grab_marketing_api_snapshots (report_from, report_to, source_id);
alter table public.partner_grab_marketing_keywords enable row level security;
alter table public.partner_grab_marketing_api_snapshots enable row level security;
revoke all on table public.partner_grab_marketing_keywords from anon, authenticated;
revoke all on table public.partner_grab_marketing_api_snapshots from anon, authenticated;
grant select, insert, update, delete on table public.partner_grab_marketing_keywords to service_role;
grant select, insert, update, delete on table public.partner_grab_marketing_api_snapshots to service_role;;
