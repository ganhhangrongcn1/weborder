create or replace function private.inventory_requeue_sales_event_from_order_item()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
  v_status text;
  v_branch_uuid uuid;
  v_updated_at timestamptz;
begin
  select lower(coalesce(status, '')), branch_uuid, updated_at
  into v_status, v_branch_uuid, v_updated_at
  from public.orders
  where id = v_order_id;

  if v_status = 'done' then
    perform private.inventory_queue_sales_event(
      'order',
      v_order_id::text,
      v_order_id,
      'sale',
      v_status,
      v_branch_uuid,
      v_updated_at
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
  v_status text;
  v_branch_uuid uuid;
  v_updated_at timestamptz;
begin
  select lower(coalesce(status, '')), branch_uuid, updated_at
  into v_status, v_branch_uuid, v_updated_at
  from public.partner_orders
  where id = v_partner_order_id;

  if v_status = 'completed' then
    perform private.inventory_queue_sales_event(
      'partner_order',
      v_partner_order_id::text,
      v_partner_order_id,
      'sale',
      v_status,
      v_branch_uuid,
      v_updated_at
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists inventory_requeue_sales_event_from_order_item on public.order_items;
create trigger inventory_requeue_sales_event_from_order_item
after insert or update or delete on public.order_items
for each row execute function private.inventory_requeue_sales_event_from_order_item();

drop trigger if exists inventory_requeue_sales_event_from_partner_item on public.partner_order_items;
create trigger inventory_requeue_sales_event_from_partner_item
after insert or update or delete on public.partner_order_items
for each row execute function private.inventory_requeue_sales_event_from_partner_item();

drop function if exists private.inventory_requeue_sales_event_from_line();

revoke all on function private.inventory_requeue_sales_event_from_order_item() from public, anon, authenticated;
revoke all on function private.inventory_requeue_sales_event_from_partner_item() from public, anon, authenticated;

notify pgrst, 'reload schema';
