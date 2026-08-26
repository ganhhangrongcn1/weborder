-- Cover the two lookup foreign keys reported by the Supabase performance advisor.
create index if not exists inventory_sales_recipe_components_item_idx
  on public.inventory_sales_recipe_components (item_id);

create index if not exists inventory_sales_recipe_components_unit_idx
  on public.inventory_sales_recipe_components (unit_id);
