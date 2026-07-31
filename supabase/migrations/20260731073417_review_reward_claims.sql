create table if not exists public.review_reward_settings (
  id text primary key default 'default' check (id = 'default'),
  enabled boolean not null default true,
  reward_points integer not null default 5000 check (reward_points between 1 and 100000),
  claim_window_hours integer not null default 48 check (claim_window_hours between 1 and 168),
  proof_retention_days integer not null default 3 check (proof_retention_days between 2 and 3),
  platforms jsonb not null default '{"grabfood":true,"shopeefood":true,"xanhngon":true}'::jsonb,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.review_reward_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.review_reward_claims (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  customer_phone text not null,
  partner_order_id uuid not null references public.partner_orders(id),
  partner_source text not null check (partner_source in ('grabfood', 'shopeefood', 'xanhngon')),
  branch_uuid uuid,
  order_code text,
  reward_points integer not null check (reward_points > 0),
  required_rating smallint not null default 5 check (required_rating = 5),
  proof_path text not null,
  proof_size_bytes integer,
  proof_sha256 text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'approved', 'rejected')),
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  proof_delete_after timestamptz,
  proof_deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_reward_claims_one_per_order unique (partner_order_id)
);

create unique index if not exists review_reward_claims_proof_sha256_unique
  on public.review_reward_claims (proof_sha256)
  where proof_sha256 is not null;
create index if not exists review_reward_claims_status_submitted_idx
  on public.review_reward_claims (status, submitted_at desc);
create index if not exists review_reward_claims_customer_idx
  on public.review_reward_claims (auth_user_id, submitted_at desc);
create index if not exists review_reward_claims_cleanup_idx
  on public.review_reward_claims (proof_delete_after)
  where proof_deleted_at is null;

alter table public.review_reward_settings enable row level security;
alter table public.review_reward_claims enable row level security;
revoke all on public.review_reward_settings from anon, authenticated;
revoke all on public.review_reward_claims from anon, authenticated;
grant select, insert, update, delete on public.review_reward_settings to service_role;
grant select, insert, update, delete on public.review_reward_claims to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-reward-proofs',
  'review-reward-proofs',
  false,
  1048576,
  array['image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
