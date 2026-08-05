alter table public.partner_grab_finance_transactions
  add column if not exists delivery_discount bigint not null default 0;
