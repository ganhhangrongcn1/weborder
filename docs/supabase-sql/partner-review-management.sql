-- Partner review management for GrabFood, ShopeeFood, Xanh Ngon and future platforms.
-- Safe to run multiple times.

create extension if not exists pgcrypto;
create extension if not exists supabase_vault;

create table if not exists public.partner_review_sources (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  account_key text not null,
  display_name text not null,
  merchant_id text,
  branch_uuid uuid references public.branches(branch_uuid) on update cascade on delete restrict,
  branch_code text not null default '',
  login_identifier_hint text not null default '',
  username_secret_id uuid,
  password_secret_id uuid,
  session_secret_id uuid,
  access_token_secret_id uuid,
  browser_profile_name text not null default '',
  auth_status text not null default 'not_configured',
  sync_status text not null default 'idle',
  sync_enabled boolean not null default true,
  auto_reply_enabled boolean not null default false,
  last_auth_at timestamptz,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_review_sources_platform_check
    check (platform in ('grabfood', 'shopeefood', 'xanhngon', 'other')),
  constraint partner_review_sources_auth_status_check
    check (auth_status in ('not_configured', 'ready', 'expired', 'error')),
  constraint partner_review_sources_sync_status_check
    check (sync_status in ('idle', 'running', 'success', 'partial', 'failed')),
  constraint partner_review_sources_account_unique unique (platform, account_key)
);

create unique index if not exists partner_review_sources_merchant_unique
on public.partner_review_sources(platform, merchant_id)
where merchant_id is not null and merchant_id <> '';

create index if not exists partner_review_sources_branch_idx
on public.partner_review_sources(branch_uuid, platform, sync_enabled);

create table if not exists public.partner_reviews (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  external_review_id text not null,
  source_id uuid not null references public.partner_review_sources(id) on update cascade on delete restrict,
  branch_uuid uuid references public.branches(branch_uuid) on update cascade on delete restrict,
  branch_code text not null default '',
  rating smallint,
  content text not null default '',
  customer_display_name text not null default '',
  external_order_id text,
  booking_code text,
  review_status text,
  is_new boolean not null default false,
  ordered_items jsonb not null default '[]'::jsonb,
  aspects jsonb not null default '[]'::jsonb,
  replies jsonb not null default '[]'::jsonb,
  image_urls jsonb not null default '[]'::jsonb,
  review_created_at timestamptz,
  content_modified_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_reviews_platform_check
    check (platform in ('grabfood', 'shopeefood', 'xanhngon', 'other')),
  constraint partner_reviews_rating_check check (rating is null or rating between 1 and 5),
  constraint partner_reviews_external_unique unique (platform, external_review_id)
);

create index if not exists partner_reviews_branch_created_idx
on public.partner_reviews(branch_uuid, review_created_at desc);

create index if not exists partner_reviews_source_created_idx
on public.partner_reviews(source_id, review_created_at desc);

create table if not exists public.partner_review_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.partner_review_sources(id) on update cascade on delete set null,
  platform text not null,
  status text not null default 'running',
  fetched_count integer not null default 0,
  upserted_count integer not null default 0,
  cursor_value text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint partner_review_sync_runs_status_check
    check (status in ('running', 'success', 'partial', 'failed'))
);

create index if not exists partner_review_sync_runs_source_started_idx
on public.partner_review_sync_runs(source_id, started_at desc);

alter table public.partner_review_sources enable row level security;
alter table public.partner_reviews enable row level security;
alter table public.partner_review_sync_runs enable row level security;

revoke all on table public.partner_review_sources from anon, authenticated;
revoke all on table public.partner_reviews from anon, authenticated;
revoke all on table public.partner_review_sync_runs from anon, authenticated;
grant select, insert, update, delete on table public.partner_review_sources to service_role;
grant select, insert, update, delete on table public.partner_reviews to service_role;
grant select, insert, update, delete on table public.partner_review_sync_runs to service_role;

create or replace function public.partner_review_store_secret(
  p_secret text,
  p_name text,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_secret), '') = '' then
    raise exception 'Secret must not be empty';
  end if;
  select id into v_id from vault.secrets where name = p_name limit 1;
  if v_id is null then
    select vault.create_secret(p_secret, p_name, p_description) into v_id;
  else
    perform vault.update_secret(v_id, p_secret, p_name, p_description);
  end if;
  return v_id;
end;
$$;

create or replace function public.partner_review_read_secret(p_secret_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_secret_id limit 1;
$$;

revoke all on function public.partner_review_store_secret(text, text, text) from public, anon, authenticated;
revoke all on function public.partner_review_read_secret(uuid) from public, anon, authenticated;
grant execute on function public.partner_review_store_secret(text, text, text) to service_role;
grant execute on function public.partner_review_read_secret(uuid) to service_role;

insert into public.partner_review_sources (
  platform, account_key, display_name, merchant_id, branch_uuid, branch_code,
  auth_status, sync_status, sync_enabled, last_auth_at, last_sync_at,
  last_error, created_at, updated_at
)
select
  'grabfood', source.account_key, source.merchant_name, source.merchant_id,
  source.branch_uuid, source.branch_code,
  case when source.last_token_refresh_at is null then 'not_configured' else 'ready' end,
  case
    when source.last_sync_status in ('running', 'success', 'partial', 'failed') then source.last_sync_status
    else 'idle'
  end,
  source.is_active, source.last_token_refresh_at, source.last_sync_at,
  source.last_error, source.created_at, now()
from public.grab_review_sources source
on conflict (platform, account_key) do update
set
  display_name = excluded.display_name,
  merchant_id = coalesce(excluded.merchant_id, public.partner_review_sources.merchant_id),
  branch_uuid = coalesce(excluded.branch_uuid, public.partner_review_sources.branch_uuid),
  branch_code = excluded.branch_code,
  sync_enabled = excluded.sync_enabled,
  updated_at = now();

notify pgrst, 'reload schema';
