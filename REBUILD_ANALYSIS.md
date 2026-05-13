# REBUILD ANALYSIS

## 1) Tổng quan project hiện tại

- Mục tiêu hiện tại: web order đồ ăn (customer app) + admin quản trị dữ liệu demo.
- Công nghệ: React + Vite, state chủ yếu local (`useState/useMemo`), persistence bằng `localStorage` qua `loadMock/saveMock`.
- Chế độ/nhánh chính:
  - Customer mode: render trong [`src/App.jsx`](src/App.jsx) qua [`src/pages/customer/CustomerShell.jsx`](src/pages/customer/CustomerShell.jsx).
  - Admin mode: route theo `window.location.pathname.startsWith('/admin')`, render [`src/pages/admin/AdminApp.jsx`](src/pages/admin/AdminApp.jsx).
- Luồng chính customer:
  1. Home -> 2. Menu/Detail -> 3. Cart/Checkout -> 4. Success -> 5. Tracking/Account/Loyalty.
- Luồng chính admin:
  1. Sidebar nhóm chức năng -> 2. Chỉnh cấu hình (menu/promo/ship/zalo/CRM) -> 3. Lưu localStorage -> 4. Customer đọc lại config khi checkout/home.

## 2) Danh sách tính năng hiện có

### Customer / Home
- Hero + search + banner slider ảnh: `Home` trong [`src/App.jsx`](src/App.jsx), component con `src/pages/customer/home/*`.
- Tab chọn hình thức nhận hàng ngay từ Home (Giao hàng/Tự đến lấy) và preset sang checkout.
- Flash sale khung giờ + countdown.
- Category section + featured product section.

### Menu / Product
- Danh sách món theo category, lọc món `visible !== false`.
- Modal tùy chọn món/topping/spice/ghi chú: [`src/components/customer/OptionModal.jsx`](src/components/customer/OptionModal.jsx), detail modal: [`src/pages/customer/product/ProductDetailModal.jsx`](src/pages/customer/product/ProductDetailModal.jsx).

### Cart
- Thêm/sửa/xóa món trong giỏ, quantity +/-.
- Tách xử lý giỏ vào hook [`src/hooks/useCart.js`](src/hooks/useCart.js) nhưng orchestration vẫn ở `App.jsx`.

### Checkout
- Hỗ trợ Delivery/Pickup.
- Delivery: chọn địa chỉ, gợi ý Goong/manual distance, phí ship.
- Pickup: chọn chi nhánh + thời gian lấy.
- Áp coupon + dùng điểm + tổng tiền realtime.
- Tạo đơn hàng + cập nhật loyalty + lưu address mới.

### Shipping / Delivery
- Cấu hình ship trong admin lưu key `ghr_shipping_config`: [`src/services/shippingService.js`](src/services/shippingService.js).
- Tính phí hiện tại: 0-3km base fee, >3km cộng theo km.
- Có ngưỡng hỗ trợ ship/freeship theo config/promotion.

### Zalo order flow
- Template tin nhắn Zalo có biến động (`{{customer_name}}`, `{{items}}`, `{{total}}`...): [`src/services/zaloService.js`](src/services/zaloService.js).
- Build link `https://zalo.me/{phone}?text=...`.

### Account / Profile
- Đăng nhập demo theo phone/password.
- Lookup số điện thoại + claim account từ lịch sử đơn.
- Quản lý profile + địa chỉ + lịch sử đơn.

### Loyalty / Points
- Mode đơn giản qua feature flags (check-in/lucky/comeback/milestone đang OFF): [`src/constants/featureFlags.js`](src/constants/featureFlags.js).
- Điểm từ đơn hàng + lịch sử điểm + voucher history.
- CRM admin có cộng/trừ/reset điểm thủ công.

### Admin
- Store: giao diện, chi nhánh, ship, zalo.
- Menu: quản lý món/topping/category, modal CRUD món.
- Promotions: 6 tab (coupon, giảm ship, khách mới, gạch giá, flashsale, đủ mốc tặng quà).
- Orders: danh sách đơn + đổi trạng thái.
- CRM/Loyalty settings: quản lý khách, điểm, voucher tặng demo.

### CRM
- Build snapshot khách từ orders (`totalOrders`, `totalSpent`, `lastOrderAt`, `daysSinceLastOrder`, điểm auto/manual): [`src/services/crmService.js`](src/services/crmService.js).

### Data / Storage
- Hệ lưu trữ chính: `localStorage`.
- Seed data: [`src/data/products.js`](src/data/products.js), [`src/data/defaultData.js`](src/data/defaultData.js).

### UI / Theme
- CSS tập trung lớn tại [`src/styles.css`](src/styles.css) (4,369 dòng).
- Có hệ component UI app/admin đã tách dần nhưng chưa hoàn toàn.

## 3) Logic quan trọng cần giữ lại

- Giỏ hàng:
  - Cấu trúc cart item gồm `unitTotal`, `lineTotal`, `quantity`, `toppings`, `spice`, `note`.
  - Sửa item theo `cartId`, món addon không mở popup edit.
- Phí ship:
  - Dùng `loadShippingConfig()` + `calculateBaseShippingFeeByConfig()`.
  - Hỗ trợ ship/freeship dựa trên config + promotion active.
- Tạo đơn:
  - `createOrder()` trong [`src/services/orderService.js`](src/services/orderService.js).
  - Lưu `orders_by_phone`, cập nhật loyalty, profile, address mặc định.
- Zalo message:
  - `renderZaloTemplate()` + `buildZaloLink()` trong [`src/services/zaloService.js`](src/services/zaloService.js).
- Loyalty:
  - Điểm kiếm từ `pointsBaseAmount / currencyPerPoint * pointPerUnit`.
  - Dữ liệu loyalty per-phone + pointHistory.
- Admin -> Customer config flow:
  - Admin cập nhật keys (`ghr_*`) -> Customer đọc lại ở Home/Checkout/Loyalty.

## 4) Những vấn đề của code hiện tại

### File quá lớn / rủi ro
- `src/App.jsx`: 3,199 dòng -> **nguy hiểm** (ôm routing, orchestration, business logic lớn).
- `src/styles.css`: 4,369 dòng -> **nguy hiểm** (khó kiểm soát regression UI).
- >300 dòng hiện tại: chỉ có 2 file trên.

### Component/hàm làm quá nhiều việc
- `App()` trong `App.jsx`: state toàn app + data wiring + page routing + business flow checkout/order/account/loyalty/admin bridge.
- `Checkout` (định nghĩa trong `App.jsx`): vừa UI vừa tính giá/ship/coupon/points vừa submit đơn.
- `Loyalty` + `Account` trong `App.jsx`: logic dày, nhiều nhánh.

### Logic trùng/lặp
- Branch defaults bị lặp ở Home và Checkout.
- Loyalty ratio `ghr_loyalty` được load ở nhiều nơi (`Checkout`, `Loyalty`, `orderService`, `crmService`).
- Mapping promotion/coupon hiển thị và điều kiện xử lý phân tán.

### State khó kiểm soát
- Nhiều `useState` cục bộ trong các function component nằm ngay trong `App.jsx`.
- Một số container hiện chỉ wrapper (`CheckoutContainer`, `AccountContainer`, `TrackingContainer`), chưa giảm thực chất orchestration ở App.

### localStorage keys đang dùng (khá nhiều, thiếu chuẩn namespace)
- User/session: `ghr_users`, `ghr_current_phone`, `ghr_user_profile`, legacy `ghr_users_demo`, `ghr_user_demo`.
- Cart/order: `ghr_cart`, `ghr_order_status`, `ghr_orders_by_phone`.
- Catalog/content: `ghr_products`, `ghr_toppings`, `ghr_promos`, `ghr_banners`, `ghr_home_content`, `ghr_categories`.
- Promotion: `ghr_coupons`, `ghr_smart_promotions`, `ghr_campaigns`.
- Store config: `ghr_branches`, `ghr_hours`, `ghr_zones`, `ghr_shipping_config`, `ghr_zalo_config`.
- Loyalty/CRM: `ghr_loyalty`, `ghr_loyalty_demo`, `ghr_loyalty_by_phone`, `ghr_customers`.
- Goong keys: `ghr_goong_api_key`, `ghr_goong_maptiles_key`.

### Encoding / text quality
- Vẫn còn chuỗi mojibake trong nhiều file (đặc biệt admin/service) -> ảnh hưởng UX và độ tin cậy dữ liệu text.

### CSS / naming
- CSS quá lớn, class utility + component style đan xen.
- Naming chưa nhất quán: `demo*`, `store*`, `admin*`, `profile*` trộn giữa domain/state/UI.

### Điểm dễ bug khi sửa
- Checkout pricing pipeline (subtotal/promo/points/ship support) đang gom trong 1 component.
- Cross-effect order create: vừa ghi order vừa mutate profile/address/loyalty.
- Admin/customer chia route bằng `pathname` trong `App.jsx` (không qua router chuẩn).

## 5) Đề xuất kiến trúc project mới

```txt
src/
  app/
    router/
    providers/
    store/
    config/
  pages/
    customer/
    admin/
  components/
    ui/
    customer/
    admin/
  features/
    menu/
    cart/
    checkout/
    shipping/
    promotions/
    loyalty/
    account/
    orders/
    crm/
    store-settings/
  hooks/
  services/
    api/
    storage/
    mappers/
  utils/
  data/
  styles/
```

- `app/`: bootstrap, providers (query/client/auth), global route guard.
- `pages/`: chỉ composition theo route, không chứa business nặng.
- `components/`: presentational components thuần.
- `features/`: domain-first, mỗi feature có `components/hooks/services/model` riêng.
- `services/api`: Supabase client + repository layer.
- `services/storage`: local cache/offline fallback.
- `utils`: hàm thuần không side-effect.
- `styles`: tách base/tokens/layout/component styles.

## 6) Mapping từ code cũ sang code mới

| Tính năng cũ | File hiện tại | File mới đề xuất | Ghi chú |
|---|---|---|---|
| App orchestration tổng | `src/App.jsx` | `src/app/router/AppRouter.jsx` + `src/app/providers/AppProviders.jsx` | Refactor lớn, tách theo route + provider |
| Home flow | `App.jsx` + `pages/customer/home/*` | `features/home/*` + `pages/customer/HomePage.jsx` | Keep UI, rewrite state orchestration |
| Menu/product detail | `App.jsx`, `components/customer/OptionModal.jsx` | `features/menu/*`, `features/product-detail/*` | Keep logic option/topping, chuẩn hóa model |
| Cart logic | `hooks/useCart.js` + `App.jsx` | `features/cart/useCartStore.ts` + `features/cart/selectors.ts` | Keep công thức, rewrite state container |
| Checkout logic | `App.jsx` (`Checkout`) | `features/checkout/CheckoutPageContainer.jsx` + `features/checkout/pricing.ts` | Ưu tiên tách pricing engine độc lập |
| Shipping config + fee | `services/shippingService.js` + `App.jsx` | `features/shipping/domain.ts` + `services/api/storeSettingsRepo.ts` | Keep công thức, tách IO khỏi domain |
| Order create | `services/orderService.js` | `features/orders/createOrder.ts` + `services/api/ordersRepo.ts` | Keep payload, tách side-effect chain |
| Zalo template/link | `services/zaloService.js` | `features/checkout/zaloMessage.ts` + `services/api/storeSettingsRepo.ts` | Keep template vars |
| Account/auth demo | `App.jsx`, `services/customerService.js` | `features/account/*` | Rewrite nhẹ, chuẩn hóa session model |
| Loyalty | `App.jsx`, `services/loyaltyService.js`, `services/crmService.js` | `features/loyalty/*` + `features/crm/*` | Keep simple mode, bỏ game mechanics |
| Admin shell | `pages/admin/AdminApp.jsx` | `pages/admin/AdminLayout.jsx` + từng feature page | Keep điều hướng nhóm lớn |
| Promotion manager | `pages/admin/promotions/*` | `features/promotions/admin/*` | Keep 6 chương trình MVP |
| CSS global | `src/styles.css` | `styles/tokens.css`, `styles/base.css`, `styles/components/*.css` | Tách dần để giảm blast radius |

## 7) Đề xuất Supabase schema

> Gợi ý dùng `uuid` PK, `created_at`, `updated_at` chuẩn cho tất cả bảng.

### `customers`
- Mục đích: hồ sơ khách + định danh.
- Field gợi ý:
  - `id uuid pk`
  - `phone text unique not null`
  - `name text`
  - `email text null`
  - `default_address text null`
  - `total_orders int default 0`
  - `total_spent numeric default 0`
  - `points_balance int default 0`
  - `last_order_at timestamptz null`
- Quan hệ: 1-n với `orders`, 1-n với `loyalty_events`.

### `orders`
- Mục đích: header đơn hàng.
- Field:
  - `id uuid pk`
  - `order_code text unique`
  - `customer_id uuid fk -> customers.id`
  - `status text` (`new|doing|done|pending_zalo|confirmed` map dần)
  - `fulfillment_type text` (`delivery|pickup`)
  - `customer_name text`
  - `customer_phone text`
  - `delivery_address text`
  - `lat numeric null`, `lng numeric null`
  - `distance_km numeric null`
  - `subtotal numeric`
  - `shipping_fee numeric`
  - `shipping_support_discount numeric`
  - `promo_discount numeric`
  - `points_discount numeric`
  - `total_amount numeric`
  - `payment_method text`
  - `branch_id uuid null`
  - `pickup_time_text text null`
  - `zalo_message text null`
- Quan hệ: 1-n `order_items`, n-1 `customers`.

### `order_items`
- Mục đích: item của đơn.
- Field:
  - `id uuid pk`
  - `order_id uuid fk -> orders.id`
  - `menu_item_id uuid null fk -> menu_items.id`
  - `name_snapshot text`
  - `spice text null`
  - `toppings_json jsonb`
  - `note text`
  - `quantity int`
  - `unit_total numeric`
  - `line_total numeric`
  - `is_addon boolean default false`

### `menu_items`
- Mục đích: món bán.
- Field:
  - `id uuid pk`
  - `category_id uuid fk -> categories.id`
  - `name text`
  - `description text`
  - `image_url text`
  - `price numeric`
  - `visible boolean default true`
  - `badge text null`
  - `option_groups jsonb null`

### `categories`
- Mục đích: danh mục món.
- Field:
  - `id uuid pk`
  - `name text unique`
  - `slug text unique`
  - `sort_order int`
  - `active boolean default true`

### `banners`
- Mục đích: slider trang chủ.
- Field:
  - `id uuid pk`
  - `title text`
  - `subtitle text`
  - `image_url text`
  - `active boolean`
  - `sort_order int`

### `promotions`
- Mục đích: 6 chương trình MVP thống nhất.
- Field:
  - `id uuid pk`
  - `type text` (`coupon|shipping_discount|new_customer|strike_price|flash_sale|gift_threshold`)
  - `name text`
  - `active boolean`
  - `condition_json jsonb`
  - `reward_json jsonb`
  - `start_at timestamptz`
  - `end_at timestamptz`
  - `priority int`
  - `display_places text[]`

### `store_settings`
- Mục đích: config vận hành cửa hàng.
- Field:
  - `id uuid pk`
  - `key text unique` (vd: `shipping_config`, `zalo_config`, `branches`, `hours`, `delivery_zones`)
  - `value_json jsonb`

### `loyalty_events`
- Mục đích: ledger điểm minh bạch.
- Field:
  - `id uuid pk`
  - `customer_id uuid fk -> customers.id`
  - `order_id uuid null fk -> orders.id`
  - `event_type text` (`earn|redeem|manual_adjust|reset|voucher_gift`)
  - `points_delta int`
  - `balance_after int`
  - `meta_json jsonb`

## 8) Kế hoạch build lại theo phase

### Phase 1: Setup project + architecture
- Tạo skeleton theo `app/pages/features/services`.
- Thiết lập Router chuẩn, route separation customer/admin.
- Thiết lập coding conventions + lint + type strategy (có thể TS dần).

### Phase 2: Customer home/menu/cart
- Port Home/Menu/Detail trước (UI giữ nguyên).
- Dựng cart store và cart selectors độc lập.

### Phase 3: Checkout + Zalo flow
- Tách pricing engine thuần (`subtotal/promo/ship/points`).
- Tách order payload builder + zalo message builder.

### Phase 4: Account + loyalty
- Đưa auth/session + profile + loyalty ledger theo module.
- Giữ loyalty MVP đơn giản (coupon/freeship/points).

### Phase 5: Admin local config
- Dựng admin pages theo module.
- Dữ liệu vẫn local repo/service để test UX.

### Phase 6: CRM dashboard
- Build CRM read model từ orders + loyalty events.
- Form cộng/trừ/reset điểm + history.

### Phase 7: Supabase integration
- Tạo schema + policies + repos.
- Migrate từ `localStorage` sang Supabase theo adapter 2 chiều.

### Phase 8: Cleanup + deploy
- Xóa dead code/legacy keys.
- Chuẩn hóa encoding VN 100%.
- Tối ưu CSS bundle, QA regression, deploy.

## 9) Prompt tiếp theo cho Codex (copy dùng ngay)

1. `Phase 1 - Setup`: 
   - "Tạo skeleton project mới theo kiến trúc feature-first (app/pages/components/features/hooks/services/utils/data/styles), setup React Router cho customer/admin, chưa migrate logic business."

2. `Phase 2 - Home/Menu/Cart`: 
   - "Port Home + Menu + Product Detail + Cart từ project cũ sang project mới, giữ nguyên UI/logic hiển thị, chưa làm checkout."

3. `Phase 3 - Checkout/Zalo`: 
   - "Tạo checkout module với pricing engine thuần (ship/coupon/points) + builder tin nhắn Zalo, giữ hành vi như code cũ."

4. `Phase 4 - Account/Loyalty`: 
   - "Build Account + Loyalty MVP (điểm đơn giản), chỉ giữ coupon/freeship/points, không bật lại check-in/lucky/milestone."

5. `Phase 5 - Admin local`: 
   - "Dựng Admin module theo nhóm: store/customers/menu/orders/promotions, dữ liệu localStorage adapter trước."

6. `Phase 6 - CRM`: 
   - "Tạo CRM dashboard đọc từ orders + loyalty events, hỗ trợ cộng/trừ/reset điểm và xem lịch sử khách."

7. `Phase 7 - Supabase`: 
   - "Tạo Supabase schema + repository layer theo bảng customers/orders/order_items/menu_items/categories/banners/promotions/store_settings/loyalty_events, tích hợp dần từng module."

8. `Phase 8 - Cleanup`: 
   - "Dọn legacy localStorage keys, chuẩn hóa text tiếng Việt UTF-8, tách CSS theo tokens/base/components, chạy QA regression."

---

## Phụ lục nhanh

### File nặng hiện tại
- `src/styles.css`: 4369 lines (**nguy hiểm**)
- `src/App.jsx`: 3199 lines (**nguy hiểm**)

### Mức sẵn sàng rebuild
- Đánh giá tổng thể: **6.5/10**
- Điểm mạnh: đã có tách module admin/customer từng phần, nhiều service/hook đã hình thành.
- Điểm yếu: orchestration dồn ở `App.jsx`, state flow phân tán, localStorage key nhiều và lẫn vai trò, encoding chưa sạch hoàn toàn.
