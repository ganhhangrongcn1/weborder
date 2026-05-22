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
| `points_base_amount` | `finance_data.sell_price` | Recommended for loyalty after item/platform menu discount. Fallback `total`. |
| `order_status` | `status` | See status mapping below. |
| `kitchen_status` | `status` | See status mapping below. |
| `point_status` | static | Use `pending` for new/upserted orders unless already claimed. |
| `order_time` | `order_time` | ISO time. |
| `raw_data` | whole order object | Store full JSON for debugging. |

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
DOING  -> order_status = preparing, kitchen_status = cooking
PRE_ORDER -> order_status = preorder, kitchen_status = preorder
FINISH -> order_status = completed, kitchen_status = served
CANCEL/CANCELLED -> order_status = cancelled, kitchen_status = cancelled
```

For kitchen screens, if you want finished historical orders not to appear as active kitchen work, only show:

```txt
kitchen_status in ('pending', 'cooking', 'ready')
```

Current kitchen screen also reads `partner_orders.nexpos_status` and `raw_data.status` directly:

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
