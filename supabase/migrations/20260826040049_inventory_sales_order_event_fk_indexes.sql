create index if not exists inventory_sales_order_event_lines_item_idx
  on public.inventory_sales_order_event_lines (item_id)
  where item_id is not null;

create index if not exists inventory_sales_order_event_lines_recipe_idx
  on public.inventory_sales_order_event_lines (recipe_id)
  where recipe_id is not null;

create index if not exists inventory_sales_order_events_reversal_idx
  on public.inventory_sales_order_events (reverses_event_id)
  where reverses_event_id is not null;

create index if not exists inventory_sales_order_events_warehouse_idx
  on public.inventory_sales_order_events (warehouse_id, created_at desc)
  where warehouse_id is not null;
