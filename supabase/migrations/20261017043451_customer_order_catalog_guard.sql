-- Only new customer web/QR orders are checked. Existing order updates, POS,
-- partner integrations, loyalty and payment transitions keep their current flow.
-- SECURITY INVOKER retains the existing public catalog SELECT/RLS contract.
-- Rollout: deploy the frontend with P4002 popup handling before enabling this
-- trigger. Rollback: drop trigger customer_order_catalog_guard on public.orders;
create or replace function public.check_customer_order_catalog()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  unavailable jsonb;
begin
  if coalesce(new.metadata->>'source', new.metadata->>'orderSource', '')
    not in ('online', 'web', 'website', 'qr_counter', 'qr') then
    return new;
  end if;

  -- BEFORE INSERT also runs on an upsert that updates an existing order.
  -- Do not block payment/status retries after a dish is removed from the menu.
  if exists (select 1 from public.orders where id = new.id) then
    return new;
  end if;

  select jsonb_agg(jsonb_build_object('id', item->>'id', 'name', item->>'name'))
  into unavailable
  from jsonb_array_elements(
    case when jsonb_typeof(new.metadata->'items') = 'array'
      then new.metadata->'items' else '[]'::jsonb end
  ) item
  where coalesce(item->>'autoGiftByPromo', 'false') <> 'true'
    and coalesce(item->>'stampGift', 'false') <> 'true'
    and not exists (
      select 1 from public.products p
      where p.id = coalesce(nullif(item->>'productId', ''), nullif(item->>'product_id', ''), item->>'id')
        and coalesce(p.active, true) and coalesce(p.visible, true)
        and coalesce(p.metadata->>'active', 'true') <> 'false'
        and coalesce(p.metadata->>'visible', 'true') <> 'false'
    );

  if unavailable is not null then
    raise exception using errcode = 'P4002', message = 'ORDER_ITEMS_UNAVAILABLE', detail = unavailable::text;
  end if;
  return new;
end;
$$;

drop trigger if exists customer_order_catalog_guard on public.orders;
create trigger customer_order_catalog_guard
before insert on public.orders
for each row execute function public.check_customer_order_catalog();

revoke all on function public.check_customer_order_catalog() from public;
notify pgrst, 'reload schema';
