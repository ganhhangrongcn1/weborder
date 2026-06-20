create table if not exists public.sepay_webhook_logs (
  id bigserial primary key,
  provider text not null default 'sepay',
  webhook_code text not null default '',
  transfer_type text not null default '',
  transfer_amount numeric not null default 0,
  account_number text not null default '',
  gateway text not null default '',
  matched_order_id text,
  processed_result text not null default '',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sepay_webhook_logs_created_at_idx
  on public.sepay_webhook_logs (created_at desc);

create index if not exists sepay_webhook_logs_webhook_code_idx
  on public.sepay_webhook_logs (webhook_code);

alter table public.sepay_webhook_logs enable row level security;

drop policy if exists sepay_webhook_logs_admin_read on public.sepay_webhook_logs;
create policy sepay_webhook_logs_admin_read
on public.sepay_webhook_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and lower(coalesce(p.status, '')) = 'active'
      and lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen')
  )
);
