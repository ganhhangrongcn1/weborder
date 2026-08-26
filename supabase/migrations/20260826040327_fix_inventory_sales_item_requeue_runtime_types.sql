create or replace function private.inventory_requeue_sales_event_from_order_item()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_order_id text := coalesce(new.order_id, old.order_id);
  v_order record;
  v_status text;
begin
  select * into v_order
  from public.orders
  where id = v_order_id;

  if not found then
    return coalesce(new, old);
  end if;

  v_status := lower(btrim(coalesce(v_order.status, '')));
  if v_status in ('done', 'cancelled') then
    perform private.inventory_queue_sales_event(
      'order',
      v_order.id,
      v_order.id,
      case when v_status = 'done' then 'sale' else 'reversal' end,
      v_status,
      coalesce(
        v_order.branch_uuid,
        v_order.pickup_branch_uuid,
        v_order.delivery_branch_uuid,
        v_order.branch_id,
        v_order.pickup_branch_id,
        v_order.delivery_branch_id
      ),
      coalesce(v_order.updated_at, v_order.created_at, now())
    );
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function private.inventory_requeue_sales_event_from_partner_item()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_partner_order_id uuid := coalesce(new.partner_order_id, old.partner_order_id);
  v_order record;
  v_status text;
begin
  select * into v_order
  from public.partner_orders
  where id = v_partner_order_id;

  if not found then
    return coalesce(new, old);
  end if;

  v_status := lower(btrim(coalesce(v_order.order_status, '')));
  if v_status in ('completed', 'cancelled') then
    perform private.inventory_queue_sales_event(
      'partner_order',
      lower(btrim(coalesce(v_order.partner_source, 'other'))) || ':' ||
        coalesce(nullif(btrim(v_order.nexpos_order_id), ''), v_order.id::text),
      v_order.id::text,
      case when v_status = 'completed' then 'sale' else 'reversal' end,
      v_status,
      v_order.branch_uuid,
      coalesce(v_order.updated_at, v_order.order_time, v_order.created_at, now())
    );
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.inventory_requeue_sales_event_from_order_item() from public, anon, authenticated;
revoke all on function private.inventory_requeue_sales_event_from_partner_item() from public, anon, authenticated;

notify pgrst, 'reload schema';
