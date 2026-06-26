-- Kitchen partner item line_index trigger
-- Keeps existing n8n flows safer while they migrate to explicitly sending line_index.
-- If line_index is missing, derive it from item_key suffix like GF-060-4.

create or replace function public.set_partner_order_item_line_index_from_key()
returns trigger
language plpgsql
as $$
begin
  if new.line_index is null
    and coalesce(new.item_key, '') ~ '-[0-9]+$'
  then
    new.line_index := substring(new.item_key from '-([0-9]+)$')::integer;
  end if;

  return new;
end;
$$;

drop trigger if exists partner_order_items_set_line_index_from_key
on public.partner_order_items;

create trigger partner_order_items_set_line_index_from_key
before insert or update of item_key, line_index
on public.partner_order_items
for each row
execute function public.set_partner_order_item_line_index_from_key();

notify pgrst, 'reload schema';

select
  'partner_order_items_set_line_index_from_key' as check_name,
  tgname as trigger_name
from pg_trigger
where tgname = 'partner_order_items_set_line_index_from_key';
