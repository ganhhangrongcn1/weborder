alter table public.partner_orders
  add column if not exists ingested_by text not null default 'n8n',
  add column if not exists first_ingested_at timestamptz not null default now(),
  add column if not exists last_nexpos_observed_at timestamptz,
  add column if not exists payload_version text not null default 'n8n-v1',
  add column if not exists sync_conflict boolean not null default false,
  add column if not exists nexpos_original_price numeric,
  add column if not exists nexpos_sell_price numeric,
  add column if not exists nexpos_gross_received numeric,
  add column if not exists nexpos_net_received numeric,
  add column if not exists nexpos_total_promotion numeric,
  add column if not exists nexpos_cofund_promotion numeric,
  add column if not exists nexpos_other_promotion numeric,
  add column if not exists nexpos_commission numeric,
  add column if not exists nexpos_commission_tax numeric,
  add column if not exists nexpos_transaction_fee numeric,
  add column if not exists nexpos_tax numeric,
  add column if not exists nexpos_other_fee numeric,
  add column if not exists nexpos_adjustment_fee numeric,
  add column if not exists nexpos_additional_income numeric,
  add column if not exists nexpos_shipping_discount numeric,
  add column if not exists nexpos_finance_data jsonb not null default '{}'::jsonb,
  add column if not exists nexpos_promotion_data jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_orders_ingested_by_check'
      and conrelid = 'public.partner_orders'::regclass
  ) then
    alter table public.partner_orders
      add constraint partner_orders_ingested_by_check
      check (ingested_by in ('n8n', 'supabase')) not valid;
  end if;
end
$$;

alter table public.partner_order_items
  add column if not exists original_unit_price numeric,
  add column if not exists discounted_unit_price numeric,
  add column if not exists item_discount_amount numeric,
  add column if not exists platform_discount_amount numeric,
  add column if not exists seller_discount_amount numeric,
  add column if not exists promotion_data jsonb not null default '{}'::jsonb;

alter table public.nexpos_shadow_orders
  add column if not exists normalized_display_order_code text,
  add column if not exists normalized_data jsonb not null default '{}'::jsonb,
  add column if not exists business_comparison_status text not null default 'pending',
  add column if not exists business_comparison_differences jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nexpos_shadow_orders_business_status_check'
      and conrelid = 'public.nexpos_shadow_orders'::regclass
  ) then
    alter table public.nexpos_shadow_orders
      add constraint nexpos_shadow_orders_business_status_check
      check (business_comparison_status in ('pending', 'matched', 'mismatch', 'missing_in_n8n')) not valid;
  end if;
end
$$;

create index if not exists nexpos_shadow_orders_business_comparison_idx
  on public.nexpos_shadow_orders (business_comparison_status, last_seen_at desc);

create index if not exists partner_orders_ingested_by_time_idx
  on public.partner_orders (ingested_by, order_time desc);

create table if not exists public.partner_order_promotions (
  id uuid primary key default gen_random_uuid(),
  partner_order_id uuid not null references public.partner_orders(id) on delete cascade,
  promotion_key text not null,
  promotion_code text,
  campaign_id text,
  promotion_name text,
  promotion_type text,
  funding_source text,
  discount_amount numeric not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_order_id, promotion_key)
);

create index if not exists partner_order_promotions_order_idx
  on public.partner_order_promotions (partner_order_id);

alter table public.partner_order_promotions enable row level security;
revoke all on table public.partner_order_promotions from anon, authenticated;
grant all on table public.partner_order_promotions to service_role;

comment on column public.partner_orders.net_received_amount is
  'Canonical restaurant net receipt used by loyalty. Existing behavior must not be replaced by NexPOS gross totals.';
comment on column public.partner_orders.nexpos_original_price is
  'NexPOS finance_data.original_price snapshot; informational and not used by loyalty.';
comment on column public.partner_orders.nexpos_finance_data is
  'Normalized copy of NexPOS finance_data for reconciliation without overwriting raw_data from n8n.';
