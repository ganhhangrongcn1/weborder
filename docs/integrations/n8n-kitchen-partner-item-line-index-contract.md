# n8n Partner Item Line Index Contract

Kitchen source of truth:

- Website / QR / POS orders: `public.orders` + `public.order_items`
- Partner orders: `public.partner_orders` + `public.partner_order_items`
- `raw_data.dishes` is audit/backfill data only, not the Kitchen runtime source.

For partner item sync, n8n should write each dish to `partner_order_items` with:

- `partner_order_id`: returned `partner_orders.id`
- `line_index`: zero-based dish position from the NexPOS/partner dish list
- `item_key`: stable display/debug key, but not the final identity
- `partner_item_name` / `web_product_name`
- `quantity`
- `unit_price`
- `line_total`
- `options`
- `note`
- `kitchen_item_status`

Current DB guard:

- `partner_order_items.partner_order_id + line_index` is unique when `line_index` is not null.
- This prevents the same dish line from being inserted twice with different `item_key` formats.

Recommended n8n flow:

1. Upsert `partner_orders` by `partner_source + nexpos_order_id`.
2. Get the returned `partner_orders.id`.
3. Build one item row per dish with `line_index = dish array index`.
4. Prefer delete/reinsert all `partner_order_items` for that `partner_order_id`, or upsert by `partner_order_id + line_index`.
5. Do not use `order_code` or display code as item identity.
6. Keep `raw_data` for debugging only.

Important:

- If n8n still tries to insert the same `line_index` twice for one order, Supabase will reject it. That is expected and protects Kitchen from duplicate cards.
- Do not set customer `registered = true` from n8n partner order ingestion.
