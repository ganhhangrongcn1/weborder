-- Scope check-in idempotency by authenticated account and server business date.
-- The public signature stays unchanged so already deployed clients keep working.

begin;

create or replace function public.process_loyalty_checkin(
  p_idempotency_key text
)
returns table (
  ok boolean,
  applied boolean,
  event_id text,
  action text,
  points_delta integer,
  balance_before integer,
  balance_after integer,
  checkin_streak integer,
  message text
)
language sql
security invoker
set search_path = pg_catalog, public, loyalty_private, auth
as $$
  select *
  from loyalty_private.checkin_internal(
    case
      when trim(coalesce(p_idempotency_key, '')) = ''
        or length(trim(coalesce(p_idempotency_key, ''))) > 200
      then trim(coalesce(p_idempotency_key, ''))
      else concat(
        'loyalty-v2:checkin:',
        coalesce(auth.uid()::text, 'missing-auth'),
        ':',
        timezone('Asia/Ho_Chi_Minh', now())::date::text
      )
    end
  );
$$;

revoke execute on function public.process_loyalty_checkin(text)
from public, anon;
grant execute on function public.process_loyalty_checkin(text)
to authenticated;

comment on function public.process_loyalty_checkin(text) is
  'Processes one customer check-in per authenticated account and Vietnam business date.';

notify pgrst, 'reload schema';

commit;
