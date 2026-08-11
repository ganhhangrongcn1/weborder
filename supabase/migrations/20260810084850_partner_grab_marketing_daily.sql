create table if not exists public.partner_grab_marketing_daily (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.partner_review_sources(id) on delete cascade,
  branch_uuid uuid null,
  branch_code text null,
  advertiser_id text not null,
  report_date date not null,
  channel text not null check (channel in ('keyword_ads', 'promo', 'spotlight')),
  campaign_key text not null,
  campaign_id text null,
  campaign_name text null,
  campaign_type text null,
  currency text not null default 'VND',
  spend_amount bigint not null default 0,
  sales_amount bigint not null default 0,
  orders_count integer not null default 0,
  impressions_count integer not null default 0,
  clicks_count integer not null default 0,
  grab_funded_amount bigint not null default 0,
  merchant_funded_amount bigint not null default 0,
  marketing_fee_amount bigint not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, report_date, channel, campaign_key)
);

create index if not exists partner_grab_marketing_daily_date_idx
  on public.partner_grab_marketing_daily (report_date desc);
create index if not exists partner_grab_marketing_daily_source_date_idx
  on public.partner_grab_marketing_daily (source_id, report_date desc);

alter table public.partner_grab_marketing_daily enable row level security;
revoke all on table public.partner_grab_marketing_daily from anon, authenticated;
grant select, insert, update, delete on table public.partner_grab_marketing_daily to service_role;
