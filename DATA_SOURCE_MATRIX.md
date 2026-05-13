# DATA SOURCE MATRIX

Cập nhật ngày: 2026-05-11

## Trạng thái migration hiện tại

### Supabase-first-with-local-fallback
- `menu/catalog`: `products`, `categories`, `toppings`
- `marketing`: `promotions`, `smart_promotions`, `coupons`, `campaigns`
- `customers`
- `customer_addresses`
- `orders` + `order_items`
- `loyalty_accounts` + `loyalty_ledger`
- `appConfigs` runtime keys (`ghr_shipping_config`, `ghr_zalo_config`, `ghr_hours`, `ghr_home_content`, `ghr_banners`, `ghr_branches`, `ghr_zones`, `ghr_loyalty`, `ghr_menu_schema`, `ghr_option_group_presets`)

## Phân tách nguồn dữ liệu chuẩn (tránh trùng/ghi đè)

### Giữ trong `app_configs` (config thuần)
- `ghr_shipping_config`
- `ghr_zalo_config`
- `ghr_hours`
- `ghr_loyalty`
- `ghr_menu_schema`
- `ghr_option_group_presets`
- `ghr_goong_config`
- `ghr_goong_api_key`
- `ghr_goong_maptiles_key`
- `ghr_loyalty_ui_text`
- `ghr_loyalty_rule_rows`
- `ghr_loyalty_bonus_display`
- `ghr_loyalty_milestones`

### Không lưu trong `app_configs` (đã có bảng chuẩn)
- `ghr_products` -> `products`
- `ghr_categories` -> `categories`
- `ghr_toppings` -> `toppings`
- `ghr_promos` -> `promotions`
- `ghr_smart_promotions` -> `smart_promotions`
- `ghr_coupons` -> `coupons`
- `ghr_campaigns` -> `campaigns`
- `ghr_banners` -> `home_banners`
- `ghr_home_content` -> `home_content`
- `ghr_branches` -> `branches`
- `ghr_zones` -> `delivery_zones`

### Local-only
- `localSession` (state tạm UI/session)

## Audit localStorage/loadMock/saveMock (giữ làm fallback)

### localStorage dùng trực tiếp
- `src/features/home/useHomeEffects.js`
- `src/services/storageService.js`
- `src/services/adapters/supabaseConfigAdapter.js`
- `src/services/repositories/appConfigRepository.js`

### loadMock/saveMock
- `src/services/adapters/localStorageAdapter.js`
- Repository liên quan: `orderRepository`, `adminConfigRepository`, `appConfigRepository`, `repositoryRuntime`

Kết luận: localStorage vẫn là lớp fallback an toàn khi Supabase lỗi/mất kết nối.

## Realtime đã bật

### Core realtime
- `orders`, `order_items`
- `loyalty_accounts`, `loyalty_ledger`
- `customer_addresses`
- `customers`

### Catalog/marketing realtime
- `ghr_products` -> `products`
- `ghr_categories` -> `categories`
- `ghr_toppings` -> `toppings`
- `ghr_promos` -> `promotions`
- `ghr_smart_promotions` -> `smart_promotions`
- `ghr_coupons` -> `coupons`
- `ghr_campaigns` -> `campaigns`
- `ghr_home_content` -> `home_content`
- `ghr_banners` -> `home_banners`
- `ghr_branches` -> `branches`
- `ghr_zones` -> `delivery_zones`

## SQL nguồn chuẩn
- `docs/supabase-phase-b2-unified-schema.sql`

## Smoke test
- Core smoke đã pass: `npm run smoke:supabase-core` (chạy bằng Node 22 khi cần tránh lỗi Node 24 trên Windows runtime của agent).
