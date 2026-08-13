-- Sổ gửi thông báo Zalo cho đơn website.
-- Chỉ Supabase Edge Functions dùng service role được đọc/ghi bảng này.

create table if not exists public.web_order_notifications (
  event_key text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in ('web_order_created', 'web_order_paid')),
  status text not null check (status in ('processing', 'sent', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  webhook_status integer,
  last_error text,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_order_notifications_order_id_created_at_idx
  on public.web_order_notifications (order_id, created_at desc);

create index if not exists web_order_notifications_status_created_at_idx
  on public.web_order_notifications (status, created_at desc);

alter table public.web_order_notifications enable row level security;

revoke all on table public.web_order_notifications from anon, authenticated;

comment on table public.web_order_notifications is
  'Nhật ký chống gửi trùng thông báo Zalo cho đơn website; chỉ Edge Function service role truy cập.';

notify pgrst, 'reload schema';
