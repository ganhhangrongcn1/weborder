create table if not exists public.partner_grab_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.partner_review_sources(id) on delete cascade,
  branch_uuid uuid null,
  branch_code text null,
  transaction_id text not null,
  store_id text null,
  transaction_date date not null,
  transaction_updated_at timestamptz null,
  transaction_category text null,
  transaction_sub_category text null,
  transaction_status text null,
  currency text not null default 'VND',
  net_total bigint not null default 0,
  net_sales bigint not null default 0,
  order_value bigint not null default 0,
  merchant_discount bigint not null default 0,
  voucher_amount bigint not null default 0,
  offer_amount bigint not null default 0,
  advertising_amount bigint not null default 0,
  advertising_tax bigint not null default 0,
  service_fee bigint not null default 0,
  channel_commission bigint not null default 0,
  delivery_commission bigint not null default 0,
  commission_tax bigint not null default 0,
  vat_amount bigint not null default 0,
  withholding_tax bigint not null default 0,
  merchant_charges bigint not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_grab_finance_transactions_source_transaction_key unique (source_id, transaction_id)
);

create index if not exists partner_grab_finance_transactions_source_date_idx
  on public.partner_grab_finance_transactions (source_id, transaction_date desc);

create index if not exists partner_grab_finance_transactions_branch_date_idx
  on public.partner_grab_finance_transactions (branch_uuid, transaction_date desc);

alter table public.partner_grab_finance_transactions enable row level security;

revoke all on table public.partner_grab_finance_transactions from anon, authenticated;
grant select, insert, update on table public.partner_grab_finance_transactions to service_role;
