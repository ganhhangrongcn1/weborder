begin;

create table if not exists public.pos_payment_sessions (
  id uuid primary key default gen_random_uuid(),
  payment_reference text not null,
  request_key text,
  provider text not null default 'sepay',
  provider_transaction_id text,
  source text not null default 'pos',
  status text not null default 'draft',
  branch_uuid uuid,
  branch_name text not null default '',
  cashier_name text not null default '',
  customer_name text not null default '',
  customer_phone text,
  pager_number text,
  currency text not null default 'VND',
  amount_expected numeric(14, 0) not null default 0,
  amount_paid numeric(14, 0) not null default 0,
  cart_snapshot jsonb not null default '[]'::jsonb,
  checkout_snapshot jsonb not null default '{}'::jsonb,
  provider_payload jsonb not null default '{}'::jsonb,
  order_id text,
  failure_reason text not null default '',
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_payment_sessions_payment_reference_not_blank
    check (btrim(payment_reference) <> ''),
  constraint pos_payment_sessions_provider_not_blank
    check (btrim(provider) <> ''),
  constraint pos_payment_sessions_source_valid
    check (source in ('pos', 'web', 'qr_order')),
  constraint pos_payment_sessions_status_valid
    check (
      status in (
        'draft',
        'pending_payment',
        'paid',
        'cancelled',
        'expired',
        'converting',
        'converted',
        'failed'
      )
    ),
  constraint pos_payment_sessions_amount_expected_non_negative
    check (amount_expected >= 0),
  constraint pos_payment_sessions_amount_paid_non_negative
    check (amount_paid >= 0),
  constraint pos_payment_sessions_cart_snapshot_is_array
    check (jsonb_typeof(cart_snapshot) = 'array'),
  constraint pos_payment_sessions_checkout_snapshot_is_object
    check (jsonb_typeof(checkout_snapshot) = 'object'),
  constraint pos_payment_sessions_provider_payload_is_object
    check (jsonb_typeof(provider_payload) = 'object')
);

comment on table public.pos_payment_sessions is
  'Phiên thanh toán tạm thời cho POS/web/QR order. Chỉ tạo orders sau khi thanh toán được xác nhận.';

comment on column public.pos_payment_sessions.payment_reference is
  'Mã chuyển khoản duy nhất dùng để đối soát webhook thanh toán.';

comment on column public.pos_payment_sessions.request_key is
  'Khóa idempotency do client/server tạo để tránh tạo trùng phiên thanh toán.';

comment on column public.pos_payment_sessions.cart_snapshot is
  'Ảnh chụp giỏ hàng tại thời điểm tạo phiên; không phải dữ liệu đơn hàng cuối cùng.';

comment on column public.pos_payment_sessions.checkout_snapshot is
  'Thông tin giảm giá, loyalty, khách hàng và fulfillment dùng khi chuyển thành đơn.';

create unique index if not exists pos_payment_sessions_payment_reference_unique
  on public.pos_payment_sessions (upper(btrim(payment_reference)));

create unique index if not exists pos_payment_sessions_request_key_unique
  on public.pos_payment_sessions (request_key)
  where request_key is not null and btrim(request_key) <> '';

create unique index if not exists pos_payment_sessions_provider_transaction_unique
  on public.pos_payment_sessions (provider, provider_transaction_id)
  where provider_transaction_id is not null
    and btrim(provider_transaction_id) <> '';

create index if not exists pos_payment_sessions_status_created_at_idx
  on public.pos_payment_sessions (status, created_at desc);

create index if not exists pos_payment_sessions_branch_status_created_at_idx
  on public.pos_payment_sessions (branch_uuid, status, created_at desc);

create index if not exists pos_payment_sessions_pending_expires_at_idx
  on public.pos_payment_sessions (expires_at)
  where status = 'pending_payment';

create index if not exists pos_payment_sessions_order_id_idx
  on public.pos_payment_sessions (order_id)
  where order_id is not null;

alter table if exists public.sepay_webhook_logs
  add column if not exists matched_payment_session_id uuid;

create index if not exists sepay_webhook_logs_payment_session_idx
  on public.sepay_webhook_logs (matched_payment_session_id)
  where matched_payment_session_id is not null;

alter table public.pos_payment_sessions enable row level security;

revoke all on table public.pos_payment_sessions from anon;
revoke all on table public.pos_payment_sessions from authenticated;

grant select on table public.pos_payment_sessions to authenticated;
grant select, insert, update, delete on table public.pos_payment_sessions to service_role;

drop policy if exists pos_payment_sessions_staff_read
  on public.pos_payment_sessions;

create policy pos_payment_sessions_staff_read
on public.pos_payment_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and lower(coalesce(p.status, '')) = 'active'
      and lower(coalesce(p.role, '')) in ('admin', 'staff')
      and (
        lower(coalesce(p.role, '')) = 'admin'
        or p.branch_uuid = pos_payment_sessions.branch_uuid
      )
  )
);

commit;
