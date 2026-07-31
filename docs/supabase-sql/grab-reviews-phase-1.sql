-- Grab Reviews - Phase 1
-- Safe to run multiple times.
-- Creates server-only tables for Grab account mapping, reviews, and sync logs.

create extension if not exists pgcrypto;

create table if not exists public.grab_review_sources (
  id uuid primary key default gen_random_uuid(),
  account_key text not null,
  merchant_id text,
  merchant_name text not null,
  branch_code text not null,
  branch_uuid uuid references public.branches(branch_uuid) on update cascade on delete restrict,
  is_active boolean not null default true,
  last_token_refresh_at timestamptz,
  last_sync_at timestamptz,
  last_sync_status text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grab_review_sources_account_key_unique unique (account_key),
  constraint grab_review_sources_branch_code_check check (branch_code in ('304', 'TQD', 'LHP'))
);

create unique index if not exists grab_review_sources_merchant_id_unique
on public.grab_review_sources (merchant_id)
where merchant_id is not null and merchant_id <> '';

create index if not exists grab_review_sources_branch_idx
on public.grab_review_sources (branch_code, is_active);

create table if not exists public.grab_reviews (
  id uuid primary key default gen_random_uuid(),
  review_id text not null,
  source_id uuid not null references public.grab_review_sources(id) on update cascade on delete restrict,
  merchant_id text not null,
  merchant_name text not null default '',
  branch_code text not null,
  branch_uuid uuid references public.branches(branch_uuid) on update cascade on delete restrict,
  rating smallint,
  description text not null default '',
  eater_name text not null default '',
  order_id text,
  booking_code text,
  service_type text not null default 'DELIVERY',
  review_status text,
  is_new boolean not null default false,
  ordered_items jsonb not null default '[]'::jsonb,
  recommended_items jsonb not null default '[]'::jsonb,
  review_aspects jsonb not null default '[]'::jsonb,
  review_replies jsonb not null default '[]'::jsonb,
  image_urls jsonb not null default '[]'::jsonb,
  review_created_at timestamptz,
  content_last_modified_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grab_reviews_review_id_unique unique (review_id),
  constraint grab_reviews_rating_check check (rating is null or rating between 1 and 5),
  constraint grab_reviews_branch_code_check check (branch_code in ('304', 'TQD', 'LHP'))
);

create index if not exists grab_reviews_branch_created_idx
on public.grab_reviews (branch_code, review_created_at desc);

create index if not exists grab_reviews_source_created_idx
on public.grab_reviews (source_id, review_created_at desc);

create index if not exists grab_reviews_rating_created_idx
on public.grab_reviews (rating, review_created_at desc);

create table if not exists public.grab_review_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.grab_review_sources(id) on update cascade on delete set null,
  status text not null default 'running',
  fetched_count integer not null default 0,
  upserted_count integer not null default 0,
  next_token text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint grab_review_sync_runs_status_check
    check (status in ('running', 'success', 'partial', 'failed'))
);

create index if not exists grab_review_sync_runs_source_started_idx
on public.grab_review_sync_runs (source_id, started_at desc);

alter table public.grab_review_sources enable row level security;
alter table public.grab_reviews enable row level security;
alter table public.grab_review_sync_runs enable row level security;

revoke all on table public.grab_review_sources from anon, authenticated;
revoke all on table public.grab_reviews from anon, authenticated;
revoke all on table public.grab_review_sync_runs from anon, authenticated;

grant select, insert, update, delete on table public.grab_review_sources to service_role;
grant select, insert, update, delete on table public.grab_reviews to service_role;
grant select, insert, update, delete on table public.grab_review_sync_runs to service_role;

insert into public.grab_review_sources (
  account_key,
  merchant_name,
  branch_code,
  branch_uuid,
  updated_at
)
select
  source.account_key,
  source.merchant_name,
  source.branch_code,
  branch.branch_uuid,
  now()
from (
  values
    ('grab_304_primary', 'Bánh Tráng Trộn - Gánh Hàng Rong', '304'),
    ('grab_304_secondary', 'Bánh Tráng Trộn - Gánh Hàng Rong - Đường 30/4', '304'),
    ('grab_tqd', 'Bánh Tráng Trộn - Gánh Hàng Rong - 277 Thích Quảng Đức', 'TQD'),
    ('grab_lhp', 'Bánh Tráng Trộn - Gánh Hàng Rong - 306A Lê Hồng Phong', 'LHP')
) as source(account_key, merchant_name, branch_code)
left join lateral (
  select b.branch_uuid
  from public.branches b
  where upper(coalesce(b.branch_code, '')) = source.branch_code
     or (source.branch_code = '304' and (
       coalesce(b.name, '') ilike '%30/4%'
       or coalesce(b.address, '') ilike '%30/4%'
     ))
     or (source.branch_code = 'TQD' and (
       coalesce(b.name, '') ilike '%Thích Quảng Đức%'
       or coalesce(b.address, '') ilike '%Thích Quảng Đức%'
     ))
     or (source.branch_code = 'LHP' and (
       coalesce(b.name, '') ilike '%Lê Hồng Phong%'
       or coalesce(b.address, '') ilike '%Lê Hồng Phong%'
     ))
  order by case when upper(coalesce(b.branch_code, '')) = source.branch_code then 0 else 1 end
  limit 1
) as branch on true
on conflict (account_key) do update
set
  merchant_name = excluded.merchant_name,
  branch_code = excluded.branch_code,
  branch_uuid = coalesce(excluded.branch_uuid, public.grab_review_sources.branch_uuid),
  updated_at = now();

notify pgrst, 'reload schema';

select
  account_key,
  merchant_name,
  branch_code,
  branch_uuid,
  merchant_id,
  is_active
from public.grab_review_sources
order by account_key;
