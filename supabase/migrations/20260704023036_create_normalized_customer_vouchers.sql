-- Normalized voucher storage, phase 1.
-- Additive only: the current loyalty_accounts.vouchers flow remains unchanged.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.voucher_campaigns (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null unique,
  campaign_key text not null default '',
  campaign_label text not null default '',
  filter_value text not null default 'all',
  audience text not null default 'all',
  voucher_template_id bigint references public.coupons(id) on update cascade on delete set null,
  voucher_code text not null default '',
  voucher_name text not null default '',
  source_type text not null default 'crm_bulk',
  source_label text not null default 'CRM - gửi theo nhóm',
  status text not null default 'draft',
  requested_count integer not null default 0,
  granted_count integer not null default 0,
  duplicate_count integer not null default 0,
  failed_count integer not null default 0,
  unregistered_count integer not null default 0,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voucher_campaigns_status_check
    check (status in ('draft', 'scheduled', 'processing', 'completed', 'partially_completed', 'failed', 'canceled')),
  constraint voucher_campaigns_counts_check
    check (
      requested_count >= 0
      and granted_count >= 0
      and duplicate_count >= 0
      and failed_count >= 0
      and unregistered_count >= 0
    ),
  constraint voucher_campaigns_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.customer_vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_instance_id text not null,
  profile_id uuid not null references public.profiles(id) on update cascade on delete restrict,
  customer_phone text not null,
  voucher_template_id bigint references public.coupons(id) on update cascade on delete set null,
  campaign_id uuid references public.voucher_campaigns(id) on update cascade on delete set null,
  batch_id text not null default '',
  voucher_code text not null default '',
  voucher_name text not null default '',
  voucher_type text not null default 'loyalty',
  management_group text not null default '',
  discount_type text not null default 'fixed',
  discount_value numeric not null default 0,
  max_discount numeric not null default 0,
  min_order numeric not null default 0,
  valid_days_after_grant integer not null default 0,
  status text not null default 'active',
  source_type text not null default '',
  source_label text not null default '',
  campaign_key text not null default '',
  campaign_label text not null default '',
  audience text not null default 'all',
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz,
  used_order_id text,
  used_order_code text not null default '',
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_vouchers_instance_customer_unique
    unique (profile_id, voucher_instance_id),
  constraint customer_vouchers_status_check
    check (status in ('active', 'used', 'expired', 'canceled')),
  constraint customer_vouchers_amounts_check
    check (
      discount_value >= 0
      and max_discount >= 0
      and min_order >= 0
      and valid_days_after_grant >= 0
    ),
  constraint customer_vouchers_dates_check
    check (expires_at is null or expires_at >= granted_at),
  constraint customer_vouchers_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint customer_vouchers_legacy_payload_object_check
    check (jsonb_typeof(legacy_payload) = 'object')
);

create index if not exists voucher_campaigns_created_at_idx
  on public.voucher_campaigns (created_at desc);

create index if not exists voucher_campaigns_status_scheduled_idx
  on public.voucher_campaigns (status, scheduled_at)
  where status in ('draft', 'scheduled', 'processing');

create index if not exists customer_vouchers_profile_status_idx
  on public.customer_vouchers (profile_id, status, expires_at);

create index if not exists customer_vouchers_campaign_status_idx
  on public.customer_vouchers (campaign_id, status)
  where campaign_id is not null;

create index if not exists customer_vouchers_batch_idx
  on public.customer_vouchers (batch_id)
  where batch_id <> '';

create index if not exists customer_vouchers_active_expiry_idx
  on public.customer_vouchers (expires_at, profile_id)
  where status = 'active';

alter table public.voucher_campaigns enable row level security;
alter table public.customer_vouchers enable row level security;

drop policy if exists voucher_campaigns_select_staff on public.voucher_campaigns;
create policy voucher_campaigns_select_staff
on public.voucher_campaigns
for select
to authenticated
using (
  (select loyalty_private.is_active_staff(array['admin', 'staff', 'crm']::text[]))
);

drop policy if exists customer_vouchers_select_owner on public.customer_vouchers;
create policy customer_vouchers_select_owner
on public.customer_vouchers
for select
to authenticated
using (
  profile_id = (
    select p.id
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and lower(coalesce(p.status, '')) = 'active'
    limit 1
  )
);

drop policy if exists customer_vouchers_select_staff on public.customer_vouchers;
create policy customer_vouchers_select_staff
on public.customer_vouchers
for select
to authenticated
using (
  (select loyalty_private.is_active_staff(array['admin', 'staff', 'crm']::text[]))
);

revoke all on public.voucher_campaigns from public, anon, authenticated;
revoke all on public.customer_vouchers from public, anon, authenticated;

grant select on public.voucher_campaigns to authenticated;
grant select on public.customer_vouchers to authenticated;
grant select, insert, update, delete on public.voucher_campaigns to service_role;
grant select, insert, update, delete on public.customer_vouchers to service_role;

comment on table public.voucher_campaigns is
  'One row per scheduled or completed voucher campaign/batch.';
comment on table public.customer_vouchers is
  'Normalized customer voucher instances. Phase 1 is read-only until RPC dual-write is enabled.';
comment on column public.customer_vouchers.legacy_payload is
  'Original loyalty_accounts.vouchers JSON object retained for audit and rollback.';

notify pgrst, 'reload schema';

commit;
