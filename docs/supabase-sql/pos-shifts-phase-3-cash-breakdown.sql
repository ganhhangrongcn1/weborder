-- POS shifts - Phase 3 cash breakdown
-- Chay file nay mot lan trong Supabase SQL Editor truoc khi test.
-- Muc tieu:
-- 1. Luu co cau menh gia tien dau ca.
-- 2. Luu co cau menh gia tien cuoi ca.
-- 3. Giup POS doi soat va in phieu ket ca day du hon.

begin;

alter table if exists public.pos_shifts
  add column if not exists opening_cash_breakdown jsonb not null default '{}'::jsonb;

alter table if exists public.pos_shifts
  add column if not exists closing_cash_breakdown jsonb not null default '{}'::jsonb;

comment on column public.pos_shifts.opening_cash_breakdown is
  'Co cau menh gia tien mat dau ca, luu dang jsonb theo menh gia -> so luong to.';

comment on column public.pos_shifts.closing_cash_breakdown is
  'Co cau menh gia tien mat cuoi ca, luu dang jsonb theo menh gia -> so luong to.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pos_shifts_opening_cash_breakdown_is_object'
      and conrelid = 'public.pos_shifts'::regclass
  ) then
    alter table public.pos_shifts
      add constraint pos_shifts_opening_cash_breakdown_is_object
      check (jsonb_typeof(opening_cash_breakdown) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pos_shifts_closing_cash_breakdown_is_object'
      and conrelid = 'public.pos_shifts'::regclass
  ) then
    alter table public.pos_shifts
      add constraint pos_shifts_closing_cash_breakdown_is_object
      check (jsonb_typeof(closing_cash_breakdown) = 'object');
  end if;
end
$$;

commit;

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'pos_shifts'
  and column_name in ('opening_cash_breakdown', 'closing_cash_breakdown')
order by column_name;
