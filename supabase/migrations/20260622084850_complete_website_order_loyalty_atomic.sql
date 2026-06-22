-- Complete a website order and settle its loyalty earn in one transaction.
-- The client only supplies order identity and idempotency identity. Amounts,
-- phone and points are always read from the immutable order snapshot.

begin;

create or replace function public.complete_website_order_with_loyalty(
  p_order_id text,
  p_idempotency_key text
)
returns table (
  order_id text,
  order_status text,
  kitchen_status text,
  loyalty_applied boolean,
  points_delta integer,
  balance_after integer,
  result_message text
)
language plpgsql
security invoker
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_order public.orders%rowtype;
  v_loyalty record;
  v_order_id text := trim(coalesce(p_order_id, ''));
  v_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  v_completed_at timestamptz := now();
begin
  if v_order_id = '' then
    raise exception 'Thiếu định danh đơn hàng.';
  end if;

  if v_idempotency_key = '' or length(v_idempotency_key) > 200 then
    raise exception 'Idempotency key không hợp lệ.';
  end if;

  if not public.is_ghr_staff()
    and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin')
  then
    raise exception 'Tài khoản hiện tại không được phép hoàn tất đơn hàng.';
  end if;

  select *
  into v_order
  from public.orders o
  where o.id = v_order_id
  for update;

  if not found then
    raise exception 'Không tìm thấy đơn trong orders.';
  end if;

  if lower(trim(coalesce(v_order.status, ''))) in ('cancelled', 'canceled', 'cancel', 'refunded') then
    raise exception 'Không thể hoàn tất đơn đã hủy hoặc hoàn tiền.';
  end if;

  if lower(trim(coalesce(v_order.status, ''))) not in (
    'ready_for_pickup',
    'delivering',
    'done',
    'completed',
    'hoan_tat',
    'hoan tat'
  ) then
    raise exception 'Đơn chưa ở trạng thái sẵn sàng để hoàn tất.';
  end if;

  update public.orders
  set
    status = 'done',
    kitchen_status = 'done',
    kitchen_done_at = coalesce(kitchen_done_at, v_completed_at),
    updated_at = v_completed_at
  where id = v_order.id
  returning * into v_order;

  select *
  into v_loyalty
  from public.process_order_loyalty(
    'ORDER',
    v_order.id::text,
    'SETTLE_EARN',
    v_idempotency_key
  );

  return query
  select
    v_order.id::text,
    v_order.status::text,
    v_order.kitchen_status::text,
    coalesce(v_loyalty.applied, false)::boolean,
    coalesce(v_loyalty.points_delta, 0)::integer,
    coalesce(v_loyalty.balance_after, 0)::integer,
    coalesce(v_loyalty.message, 'Đơn đã hoàn tất và điểm đã được cập nhật.')::text;
end;
$$;

revoke all on function public.complete_website_order_with_loyalty(text, text)
from public, anon;

grant execute on function public.complete_website_order_with_loyalty(text, text)
to authenticated, service_role;

comment on function public.complete_website_order_with_loyalty(text, text) is
'Atomically completes an eligible website order and settles its loyalty snapshot.';

notify pgrst, 'reload schema';

commit;
