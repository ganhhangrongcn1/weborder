-- Preserve the submitted unit. The server still validates the unit against the
-- item's configured units and calculates the trusted conversion factor.
-- No historical documents, movements, or balances are changed.
create or replace function private.inventory_normalize_document_line_unit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.conversion_to_base := private.inventory_item_unit_to_base(new.item_id, new.unit_id);
  return new;
end;
$$;

notify pgrst, 'reload schema';
