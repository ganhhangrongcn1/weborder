# UI SCREEN PATTERN

Phạm vi tài liệu này: pattern theo từng màn hình và hành vi UI ở cấp screen-flow.
Không lặp lại design token/màu/chữ/shadow đã ghi trong `docs/DESIGN_SYSTEM.md`.

## Home

### Layout structure
- `CustomerShell` bọc toàn màn với khung mobile cố định (`main` max 430).
- Home dùng cấu trúc dọc theo section: `HomeHero` -> pickup mode card -> `HomeFlashSale` -> `HomeCategorySection` -> `HomeFeaturedProducts`.
- Một số interaction mở dạng bottom sheet/modal ngay trong màn (pickup planner, flash sheet).

### Component chính
- `HomeHero` (greeting, search entry, banner carousel + dots).
- `HomeFlashSale` (deal nổi bật + sheet danh sách flash).
- `HomeCategorySection` (category bubble ngang, chọn nhanh).
- `HomeFeaturedProducts` (grid sản phẩm 2 cột với `ProductCard`).

### Spacing riêng
- Screen shell dùng nhịp dọc dày (`home2026-shell`), tách section rõ theo block.
- Section head luôn có khoảng cách giữa title/action trước nội dung.
- Banner track và category track dùng padding ngang để đồng bộ lề với shell.
- Dành khoảng trống đáy lớn để không đụng `BottomNav` + floating cart.

### Pattern UI đặc trưng
- Home ưu tiên discovery: carousel + flash + category chips + featured grid.
- Mô hình “quick decision” đầu màn: chọn `Giao hàng`/`Tự đến lấy` trước khi vào menu.
- Flash sale có 2 tầng: teaser card trong màn + full sheet để xem nhiều item.
- Horizontal scroll xuất hiện ở nhiều cụm (banner, category) để tăng mật độ nội dung mà không tăng chiều dọc.

## Menu

### Layout structure
- Header quay lại Home.
- Thân màn gồm 3 cụm chính: sticky tools -> product grid -> addon/topping horizontal list.
- Cuối màn vẫn thuộc flow đặt món, không tách khỏi checkout ecosystem.

### Component chính
- `AppHeader`.
- Sticky tools: `menu-search`, category chips, quick filter row.
- Product area: danh sách `ProductCard` dạng grid 2 cột.
- Addon area: `ToppingMenuCard` với stepper riêng cho topping.

### Spacing riêng
- Container chính dùng `space-y-4`, `px-4`, `pb-32` để chừa CTA nổi/điều hướng.
- Grid món giữ khoảng cách đều giữa 2 cột và giữa card.
- Addon section tách rõ bằng một block riêng dưới grid món.

### Pattern UI đặc trưng
- Mẫu “browse then customize”: bấm món mở option, bấm nhanh để thêm trực tiếp.
- Tồn tại song song 2 kiểu lựa chọn:
  - Món chính theo grid card.
  - Topping theo rail ngang và stepper compact.
- Sticky tool bar giữ context lọc/tìm trong lúc cuộn.

## Cart

### Layout structure
- Không phải màn độc lập; Cart là một module trong Checkout + một trigger nổi ở các màn khác.
- Trigger: `FloatingCartBar` (hiển thị khi có món, trừ màn checkout/success).
- Nội dung cart chi tiết nằm trong `AppCart` (render qua `CheckoutCard`).

### Component chính
- `CustomerFloatingCartBar` (entry point vào checkout).
- `AppCart` + `checkout-cart-item`.
- Control tăng/giảm/xóa: `qty-btn`, `checkout-remove`.

### Spacing riêng
- Floating cart có khoảng cách tách khỏi đáy nav (tránh chồng `BottomNav`).
- Trong cart list, mỗi item có nhịp dọc riêng: tên -> option/topping -> qty/line total.
- Khoảng cách giữa cart items thống nhất để đọc nhanh danh sách dài.

### Pattern UI đặc trưng
- Cart theo mô hình “editable summary”: chỉnh trực tiếp số lượng ngay trong list.
- Item món chính có thể bấm để mở lại editor; addon item được khóa chỉnh option.
- Có hành động batch (`Xóa tất cả`) ở header của card cart.

## Checkout

### Layout structure
- Header -> stack nhiều `CheckoutCard` -> sticky CTA đáy màn.
- Nhánh điều kiện theo fulfillment:
  - `delivery`: card địa chỉ.
  - `pickup`: card chọn chi nhánh + card chọn thời gian lấy.
- Modal phụ trợ: promo modal, address modal, delivery fee modal.

### Component chính
- `CheckoutCard` (wrapper chuẩn cho từng khối).
- `AppCart` (giỏ hàng trong checkout).
- `CheckoutMilestoneSuggest` (upsell/reward milestone).
- `CheckoutTotalCard` (tính tiền + discount lines).
- `PromoModal`, `DeliveryFeeModal`, `AddressModal`.

### Spacing riêng
- Container dùng `space-y-4`, `px-4`, `pb-28` để nhường chỗ sticky CTA.
- Các card nội dung có khoảng cách đều, cùng nhịp scan từ trên xuống.
- Sticky CTA tách thành một lớp riêng, luôn neo đáy để action chính luôn khả dụng.

### Pattern UI đặc trưng
- Progressive checkout: người dùng hoàn thiện từng block độc lập (địa chỉ -> giỏ -> ưu đãi -> thanh toán).
- Mỗi block có thể mở rộng qua modal thay vì rời màn (giữ ngữ cảnh).
- Mẫu “cost transparency”: tổng tiền hiển thị theo line-item (ship, promo, điểm, tiết kiệm).
- CTA cuối luôn phản ánh tổng tiền hiện tại theo thời gian thực.

## Admin

### Layout structure
- Desktop 2 cột rõ rệt: sidebar điều hướng trái + workspace phải (`admin-shell`).
- Workspace gồm topbar + section content theo module (`menu`, `promo`, `orders`, `crm`, `store`, `shipping`, `zalo`).
- Mỗi module theo pattern panel stack (`admin-panel`, `admin-stack`).

### Component chính
- Khung chung: sidebar nav nhóm chức năng + topbar action.
- Menu module: `MenuManager`, `AdminProductModal`.
- Promotion module: `PromotionTabsManager`, `CouponManager`, `FreeshipManager`.
- Orders module: `OrderManager` + `AdminOrderDetailModal`.
- CRM module: `CustomerCRM`, `LoyaltySettings`.
- Store/Zalo/Shipping: `BranchSettings`, `AppearanceSettings`, `ZaloSettings`, `ShippingSettings`.

### Spacing riêng
- Workspace có padding lớn hơn customer flow để đọc bảng/form tốt hơn.
- Panel grid dày đặc nhưng giữ gutter nhất quán (`admin-mini-grid`, `admin-product-grid`).
- Module-level spacing ưu tiên chia tầng: topbar -> tab/filter -> list/form -> modal.

### Pattern UI đặc trưng
- Information-dense quản trị: tab/filter/search + editable cards cùng một màn.
- CRUD inline mạnh: sửa trực tiếp trong card/grid, không bắt buộc rời màn.
- Dùng modal cho tác vụ sâu (chi tiết đơn, sửa sản phẩm) để giữ trạng thái list nền.
- Navigation theo domain nghiệp vụ (Store/Customer/Menu/Orders/Promo) thay vì theo loại component.
