-- POS shifts - Phase 2 RLS patch for shared POS account
-- Chạy file này một lần trong Supabase SQL Editor nếu mở ca bị lỗi RLS.
-- Mục tiêu:
-- 1. Cho tài khoản vận hành dùng chung role admin/staff/kitchen mở và đọc ca POS.
-- 2. Vẫn giới hạn theo chi nhánh, trừ admin toàn hệ thống.

begin;

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

commit;

-- Kiểm tra nhanh sau khi chạy.
select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'pos_shifts'
order by policyname;
