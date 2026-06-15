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
