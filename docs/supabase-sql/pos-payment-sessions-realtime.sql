-- POS payment sessions - Realtime
-- Chạy file này một lần trong Supabase SQL Editor.
-- Mục tiêu:
-- 1. Cho admin/staff/kitchen đọc phiên thanh toán đúng chi nhánh.
-- 2. Bật Realtime cho bảng pos_payment_sessions.

begin;

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
      and lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen')
      and (
        lower(coalesce(p.role, '')) = 'admin'
        or p.branch_uuid = pos_payment_sessions.branch_uuid
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
      and tablename = 'pos_payment_sessions'
  ) then
    alter publication supabase_realtime
      add table public.pos_payment_sessions;
  end if;
end
$$;

commit;

-- Kiểm tra nhanh sau khi chạy.
select
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'pos_payment_sessions';

select
  policyname,
  roles,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'pos_payment_sessions'
order by policyname;
