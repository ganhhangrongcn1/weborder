-- POS shifts - Phase 3 cash breakdown audit
-- Chay sau file pos-shifts-phase-3-cash-breakdown.sql.

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

select
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid = 'public.pos_shifts'::regclass
  and conname in (
    'pos_shifts_opening_cash_breakdown_is_object',
    'pos_shifts_closing_cash_breakdown_is_object'
  )
order by conname;
