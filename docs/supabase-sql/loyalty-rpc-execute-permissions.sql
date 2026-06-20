-- Giới hạn RPC cộng/trừ điểm cho tài khoản vận hành đã đăng nhập.
-- An toàn khi chạy lại nhiều lần.

revoke execute on function public.can_apply_loyalty_event(text, text)
from public, anon;

revoke execute on function public.apply_loyalty_event(
  text,
  text,
  integer,
  text,
  numeric,
  text,
  text,
  jsonb,
  timestamptz
)
from public, anon;

grant execute on function public.can_apply_loyalty_event(text, text)
to authenticated;

grant execute on function public.apply_loyalty_event(
  text,
  text,
  integer,
  text,
  numeric,
  text,
  text,
  jsonb,
  timestamptz
)
to authenticated;

select
  routine_name,
  string_agg(grantee, ',' order by grantee) as execute_grantees
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('apply_loyalty_event', 'can_apply_loyalty_event')
  and privilege_type = 'EXECUTE'
group by routine_name
order by routine_name;
