grant insert (adjustment_direction), update (adjustment_direction)
on table public.inventory_document_lines
to authenticated;

revoke insert (adjustment_direction), update (adjustment_direction)
on table public.inventory_document_lines
from anon;

notify pgrst, 'reload schema';
