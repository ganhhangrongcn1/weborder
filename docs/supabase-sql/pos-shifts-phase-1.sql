-- POS shifts - Phase 1
-- Chạy toàn bộ file này một lần trong Supabase SQL Editor.
-- Phase này chỉ tạo nền tảng dữ liệu, chưa bắt buộc POS phải mở ca.

begin;

create table if not exists public.pos_shifts (
  id uuid primary key default gen_random_uuid(),
  branch_uuid uuid not null references public.branches(branch_uuid)
    on update cascade
    on delete restrict,
  branch_name text not null default '',
  register_key text not null default 'main',
  status text not null default 'open',
  cashier_name text not null default '',
  opened_by_profile_id uuid references public.profiles(id)
    on update cascade
    on delete set null,
  opened_by_auth_user_id uuid not null,
  opening_cash numeric(14, 0) not null default 0,
  opening_note text not null default '',
  opened_at timestamptz not null default now(),
  closed_by_profile_id uuid references public.profiles(id)
    on update cascade
    on delete set null,
  closed_by_auth_user_id uuid,
  closing_cash_counted numeric(14, 0),
  closing_note text not null default '',
  closed_at timestamptz,
  paid_order_count integer not null default 0,
  cash_order_count integer not null default 0,
  qr_order_count integer not null default 0,
  cancelled_order_count integer not null default 0,
  cash_sales_snapshot numeric(14, 0) not null default 0,
  qr_sales_snapshot numeric(14, 0) not null default 0,
  cancelled_amount_snapshot numeric(14, 0) not null default 0,
  cash_refund_snapshot numeric(14, 0) not null default 0,
  qr_refund_snapshot numeric(14, 0) not null default 0,
  expected_cash_snapshot numeric(14, 0) not null default 0,
  cash_difference numeric(14, 0)
    generated always as (
      case
        when closing_cash_counted is null then null
        else closing_cash_counted - expected_cash_snapshot
      end
    ) stored,
  closing_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_shifts_register_key_not_blank
    check (btrim(register_key) <> ''),
  constraint pos_shifts_status_valid
    check (status in ('open', 'closed')),
  constraint pos_shifts_opening_cash_non_negative
    check (opening_cash >= 0),
  constraint pos_shifts_closing_cash_non_negative
    check (closing_cash_counted is null or closing_cash_counted >= 0),
  constraint pos_shifts_order_counts_non_negative
    check (
      paid_order_count >= 0
      and cash_order_count >= 0
      and qr_order_count >= 0
      and cancelled_order_count >= 0
    ),
  constraint pos_shifts_amount_snapshots_non_negative
    check (
      cash_sales_snapshot >= 0
      and qr_sales_snapshot >= 0
      and cancelled_amount_snapshot >= 0
      and cash_refund_snapshot >= 0
      and qr_refund_snapshot >= 0
      and expected_cash_snapshot >= 0
    ),
  constraint pos_shifts_closing_summary_is_object
    check (jsonb_typeof(closing_summary) = 'object'),
  constraint pos_shifts_lifecycle_valid
    check (
      (
        status = 'open'
        and closed_at is null
        and closed_by_auth_user_id is null
        and closing_cash_counted is null
      )
      or (
        status = 'closed'
        and closed_at is not null
        and closed_by_auth_user_id is not null
        and closing_cash_counted is not null
        and closed_at >= opened_at
      )
    )
);

comment on table public.pos_shifts is
  'Ca làm việc POS theo chi nhánh và quầy. Tổng kết đóng ca được lưu dạng snapshot để phục vụ đối soát.';

comment on column public.pos_shifts.register_key is
  'Mã quầy hoặc thiết bị POS trong chi nhánh. Phase đầu dùng main.';

comment on column public.pos_shifts.opening_cash is
  'Tiền mặt thực có trong két khi mở ca.';

comment on column public.pos_shifts.expected_cash_snapshot is
  'Tiền mặt hệ thống dự kiến tại thời điểm đóng ca.';

comment on column public.pos_shifts.cash_difference is
  'Chênh lệch tự tính: tiền thực đếm trừ tiền dự kiến.';

comment on column public.pos_shifts.closing_summary is
  'Thông tin tổng kết mở rộng tại thời điểm đóng ca; không thay thế các cột số liệu chuẩn.';

create unique index if not exists pos_shifts_one_open_per_register_unique
  on public.pos_shifts (branch_uuid, register_key)
  where status = 'open';

create index if not exists pos_shifts_branch_opened_at_idx
  on public.pos_shifts (branch_uuid, opened_at desc);

create index if not exists pos_shifts_branch_status_opened_at_idx
  on public.pos_shifts (branch_uuid, status, opened_at desc);

create index if not exists pos_shifts_opened_by_auth_user_idx
  on public.pos_shifts (opened_by_auth_user_id, opened_at desc);

alter table public.orders
  add column if not exists pos_shift_id uuid;

alter table public.pos_payment_sessions
  add column if not exists pos_shift_id uuid;

comment on column public.orders.pos_shift_id is
  'Ca POS đã tạo đơn này. Có thể null với đơn cũ hoặc đơn không phát sinh từ POS.';

comment on column public.pos_payment_sessions.pos_shift_id is
  'Ca POS sở hữu phiên thanh toán. Có thể null với phiên cũ hoặc nguồn ngoài POS.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_pos_shift_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_pos_shift_id_fkey
      foreign key (pos_shift_id)
      references public.pos_shifts(id)
      on update cascade
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pos_payment_sessions_pos_shift_id_fkey'
      and conrelid = 'public.pos_payment_sessions'::regclass
  ) then
    alter table public.pos_payment_sessions
      add constraint pos_payment_sessions_pos_shift_id_fkey
      foreign key (pos_shift_id)
      references public.pos_shifts(id)
      on update cascade
      on delete restrict;
  end if;
end
$$;

create index if not exists orders_pos_shift_id_created_at_idx
  on public.orders (pos_shift_id, created_at desc)
  where pos_shift_id is not null;

create index if not exists pos_payment_sessions_shift_status_created_at_idx
  on public.pos_payment_sessions (pos_shift_id, status, created_at desc)
  where pos_shift_id is not null;

create or replace function public.set_pos_shift_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pos_shifts_set_updated_at
  on public.pos_shifts;

create trigger pos_shifts_set_updated_at
before update on public.pos_shifts
for each row
execute function public.set_pos_shift_updated_at();

alter table public.pos_shifts enable row level security;

revoke all on table public.pos_shifts from anon;
revoke all on table public.pos_shifts from authenticated;

grant select, insert, update on table public.pos_shifts to authenticated;
grant select, insert, update, delete on table public.pos_shifts to service_role;

drop policy if exists pos_shifts_staff_read
  on public.pos_shifts;

create policy pos_shifts_staff_read
on public.pos_shifts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and lower(coalesce(p.status, '')) = 'active'
      and lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen')
      and (
        lower(coalesce(p.role, '')) = 'admin'
        or p.branch_uuid = pos_shifts.branch_uuid
      )
  )
);

drop policy if exists pos_shifts_staff_insert
  on public.pos_shifts;

create policy pos_shifts_staff_insert
on public.pos_shifts
for insert
to authenticated
with check (
  opened_by_auth_user_id = (select auth.uid())
  and status = 'open'
  and exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and lower(coalesce(p.status, '')) = 'active'
      and lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen')
      and (
        lower(coalesce(p.role, '')) = 'admin'
        or p.branch_uuid = pos_shifts.branch_uuid
      )
  )
);

drop policy if exists pos_shifts_staff_update
  on public.pos_shifts;

create policy pos_shifts_staff_update
on public.pos_shifts
for update
to authenticated
using (
  status = 'open'
  and exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and lower(coalesce(p.status, '')) = 'active'
      and lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen')
      and (
        lower(coalesce(p.role, '')) = 'admin'
        or (
          p.branch_uuid = pos_shifts.branch_uuid
          and pos_shifts.opened_by_auth_user_id = (select auth.uid())
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and lower(coalesce(p.status, '')) = 'active'
      and lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen')
      and (
        lower(coalesce(p.role, '')) = 'admin'
        or (
          p.branch_uuid = pos_shifts.branch_uuid
          and pos_shifts.opened_by_auth_user_id = (select auth.uid())
          and (
            pos_shifts.status = 'open'
            or pos_shifts.closed_by_auth_user_id = (select auth.uid())
          )
        )
      )
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pos_shifts'
  ) then
    alter publication supabase_realtime
      add table public.pos_shifts;
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;

-- Kiểm tra nhanh sau khi chạy.
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    table_name = 'pos_shifts'
    or (table_name in ('orders', 'pos_payment_sessions') and column_name = 'pos_shift_id')
  )
order by table_name, ordinal_position;
