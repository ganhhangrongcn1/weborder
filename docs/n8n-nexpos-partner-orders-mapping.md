# Mapping NexPOS -> Supabase Partner Orders

## Order fields

| Supabase column | NexPOS field | Note |
| --- | --- | --- |
| `order_code` | `order_id` | Use `order_id` first. Example `GF-054`, `20056-494832040`. |
| `nexpos_order_id` | `id` | Internal NexPOS/platform id. Keep for debug. |
| `nexpos_status` | `status` | Raw NexPOS status, for example `DOING`, `PICK`, `FINISH`. |
| `partner_source` | `source` | Normalize: `grab` -> `grabfood`, `shopee_food` -> `shopeefood`. |
| `branch_id` | `site_id` | Stable store/site id from NexPOS. |
| `branch_name` | `site_name` | Display branch name. |
| `nexpos_hub_id` | `hub_id` | NexPOS hub id. Useful for branch mapping. |
| `nexpos_hub_name` | `hub_name` | NexPOS hub name. |
| `nexpos_site_id` | `site_id` | NexPOS site id. |
| `nexpos_site_name` | `site_name` | NexPOS site name. |
| `branch_code` | n8n mapping | Set from `hub_id`/`site_id`, for example `TQD`, `LHP`, `304`. |
| `branch_uuid` | n8n mapping | Optional, only if you map to `branches.branch_uuid`. |
| `customer_name` | `customer_name` | Keep original. |
| `customer_phone` | `customer_phone` | Keep original. |
| `customer_phone_key` | normalized `customer_phone` | Normalize to `0xxxxxxxxx`. |
| `subtotal` | `finance_data.original_price` or `total` | Recommended: `finance_data.original_price`; fallback `total`. |
| `discount_amount` | `finance_data.total_promotion_price` | Fallback `total_discount` if needed, but some Grab rows are negative. |
| `shipping_fee` | `finance_data.shipping_fee` or `shipment_fee` | Usually `0` in current samples. |
| `total_amount` | `total` | Customer order menu total before platform settlement. |
| `net_received_amount` | `finance_data.real_received`, then `finance_data.net_received`, then `total_for_biz` | Canonical amount actually received by the restaurant. Leave `null` when reconciliation data is missing. Never fall back to `total`. |
| `points_base_amount` | copy `net_received_amount`; use `0` while missing | Loyalty snapshot only. Zero safely blocks legacy clients from falling back to the order total. The database trigger maintains this field. |
| `loyalty_hold_reason` | database managed | `missing_partner_net_received` when reconciliation data is unavailable. Do not write a fake amount to clear it. |
| `order_status` | `status` | Business status bucket used by app/admin/customer. See mapping below. |
| `kitchen_status` | `status` | Compatibility field only. Must follow current DB contract, not invent new kitchen meanings. |
| `kitchen_work_status` | internal app flow | Internal kitchen execution state. Default `pending`, kitchen marks `done` later. |
| `point_status` | static | Use `pending` for new/upserted orders unless already claimed. |
| `order_time` | `order_time` | ISO time. |
| `raw_data` | whole order object | Store full JSON for debugging. |

## Upsert rule

Do not upsert `partner_orders` by `order_code`.

Grab/Shopee display codes such as `GF-406` can repeat or be reused, so `order_code`
must be treated as a display/search code only. Use this conflict target instead:

```txt
partner_source + nexpos_order_id
```

Recommended n8n/Supabase flow:

```txt
1. Upsert partner_orders on conflict (partner_source, nexpos_order_id).
2. Read/return the inserted partner_orders.id.
3. Delete existing partner_order_items where partner_order_id = returned id.
4. Insert the current dishes again with that partner_order_id.
5. Best-effort hydrate customer profile by calling RPC upsert_customer_stub_profile.
```

When the incoming `nexpos_order_id` is different, even if `order_code` is the same,
it must create a new `partner_orders` row.

## Customer profile hydration

Partner order ingest must not write directly to `profiles`, and must not rely on a
`partner_orders` trigger to write `profiles`.

After `partner_orders` and `partner_order_items` are synced, call this RPC as a
separate best-effort n8n step:

```txt
POST /rest/v1/rpc/upsert_customer_stub_profile
```

Body:

```json
{
  "p_phone": "{{ customer_phone_key || customer_phone }}",
  "p_name": "{{ customer_name }}",
  "p_source": "{{ partner_source }}",
  "p_source_ref": "{{ partner_order_id || nexpos_order_id }}"
}
```

Rules:

```txt
- Continue the order ingest even if this RPC fails.
- Never set registered = true from n8n.
- Never write auth_user_id, role, or operational profile fields from n8n.
- Use docs/supabase-sql/partner-order-profile-ingest-contract.sql to remove the old profile auto-sync trigger.
```

## Item fields

| Supabase column | NexPOS field | Note |
| --- | --- | --- |
| `partner_order_id` | inserted `partner_orders.id` | From order upsert result. |
| `order_code` | order `order_id` | Same as parent. |
| `partner_source` | order `source` | Normalized same as parent. |
| `branch_id` | order `site_id` | Same as parent. |
| `nexpos_hub_id` | order `hub_id` | Same as parent. |
| `nexpos_site_id` | order `site_id` | Same as parent. |
| `branch_code` | n8n mapping | Same as parent. |
| `branch_uuid` | n8n mapping | Same as parent if available. |
| `partner_item_id` | dish `item_id` or dish `model_id` | Often empty in sample. |
| `partner_item_sku` | dish `code` | Often empty in sample. |
| `partner_item_name` | dish `name` | Required. |
| `web_product_id` | mapping table result | Empty until mapped. |
| `web_product_name` | mapping table result | Empty until mapped. |
| `quantity` | dish `quantity` | Numeric. |
| `unit_price` | dish `discount_price / quantity` | If `discount_price` is total line amount. |
| `line_total` | dish `discount_price` | Recommended paid item line total. |
| `options` | dish `options` | Store as JSONB. |
| `note` | dish `note` | Item note. |
| `item_status` | static/status mapping | Usually `pending` for kitchen. |

## Source mapping

```txt
grab        -> grabfood
shopee_food -> shopeefood
xanh_ngon   -> xanhngon
other/empty  -> other
```

## Status mapping

```txt
DOING / PROCESSING / PREPARING
  -> nexpos_status = raw incoming value
  -> order_status = preparing
  -> kitchen_status = pending
  -> kitchen_work_status = pending

PICK / READY / READY_TO_PICKUP / READY_TO_SHIP
  -> nexpos_status = raw incoming value
  -> order_status = ready
  -> kitchen_status = pending
  -> kitchen_work_status = pending

PRE_ORDER / PREORDER / SCHEDULED
  -> nexpos_status = raw incoming value
  -> order_status = new
  -> kitchen_status = preorder
  -> kitchen_work_status = pending

FINISH / FINISHED / COMPLETED / DONE / SERVED
  -> nexpos_status = raw incoming value
  -> order_status = completed
  -> kitchen_status = served
  -> kitchen_work_status = done only when kitchen actually marks done

CANCEL / CANCELLED / CANCELED / REFUND / REFUNDED
  -> nexpos_status = raw incoming value
  -> order_status = cancelled or refunded
  -> kitchen_status = cancelled
  -> kitchen_work_status = pending unless kitchen had already finished work
```

Recommended long-term contract:

```txt
nexpos_status     = source-of-truth raw platform status
order_status      = source-of-truth business bucket used by app
kitchen_status    = compatibility field for current DB / legacy reads
kitchen_work_status = source-of-truth for internal kitchen progress
```

Current kitchen screen should prioritize `kitchen_work_status`, then use `order_status` + `nexpos_status` as fallback:

```txt
FINISH/COMPLETED/DONE -> show in Đã xong
PRE_ORDER             -> hide from Đang làm until NexPOS changes status
CANCEL/CANCELED/CANCELLED -> show in Đã hủy
```

## Branches seen in sample

```txt
hub_id 69e18c814673b293b04be1ab / site_id 69e194137bb514f91d4beca0 -> Chi nhánh 30/4
hub_id 69e58a284b940f84934e2f85 / site_id 69e58f0f42928c0aee4e316f or 69e5915e39b05ca9974e323a -> Chi nhánh Lê Hồng Phong
hub_id 69e589d15f07d302954e2f63 / site_id 69e58ef6162e5233d14e3162 or 69e5913c6e317b3e854e3230 -> Chi nhánh Thích Quảng Đức
```

Recommended branch codes:

```txt
304
LHP
TQD
```
