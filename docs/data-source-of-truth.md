# Data Source Of Truth

Ghi chú nội bộ để khóa lại "nguồn sự thật" của hệ thống hiện tại.

Mục tiêu:
- Giảm tình trạng mỗi màn tự suy dữ liệu theo cách khác nhau.
- Có chung một quy ước trước khi refactor.
- Khi sửa app, n8n, Supabase, mọi người cùng bám theo một chuẩn.

## 0. Nguyên Tắc Refactor Source Of Truth

- Mục tiêu không phải chắp vá để chạy tạm, mà là tinh gọn dữ liệu, đúng cấu trúc, đúng kiến trúc và đúng logic nghiệp vụ.
- Mọi thay đổi phải hướng về source of truth rõ ràng cho từng domain.
- Không để UI tự ghép dữ liệu hoặc tự gọi Supabase nếu đã có service/repository tương ứng.
- Không tạo realtime/request tràn lan; realtime phải có scope rõ theo domain, chi nhánh, ngày, phone hoặc identity liên quan.
- Không dùng field hiển thị làm identity thật, ví dụ không dùng `display_order_code`/`order_code` để định danh partner order.
- Local cache chỉ là lớp hiển thị nhanh/fallback, không phải nguồn cuối.
- Khi refactor, phải audit nơi liên quan trước, nêu rủi ro, chia phase nhỏ, test regression rồi mới mở rộng.
- Nếu phát hiện domain phụ đang đọc sai source of truth, phải ghi backlog/contract để xử lý đúng sau, không âm thầm vá lan rộng.
- Supabase là backend source chuẩn; app phải kết nối qua service/repository/RPC đúng contract, hạn chế direct write từ UI hoặc workflow ngoài không kiểm soát.

## 1. Khách hàng

- Master: `public.profiles`
- Ý nghĩa:
  - Đây là hồ sơ khách hàng gốc của hệ thống.
  - Có thể là khách đã đăng ký hoặc khách stub theo số điện thoại.
  - `auth_user_id` có thể có hoặc không.

Quy ước:
- CRM phải lấy danh sách khách từ `profiles`.
- Không dùng `orders` hoặc `partner_orders` để tự đếm ra "tổng khách hàng" nếu không có chủ đích phân tích riêng.
- Các luồng khác nếu cần tìm khách thì ưu tiên map về `profiles.phone`.

## 2. Giao dịch

- Master: `public.orders` + `public.partner_orders`
- Ý nghĩa:
  - `orders`: đơn website / QR / pickup nội bộ weborder.
  - `partner_orders`: đơn đối tác như Grab, ShopeeFood, Xanh Ngon.

Quy ước:
- Admin dashboard, kitchen, guest lookup, tracking phải coi đây là nguồn giao dịch chính.
- Không dùng `profiles`, `loyalty_accounts`, `monthly_customer_gifts` để suy ngược ra giao dịch gốc.

## 3. Chi tiết món

- Master: `public.order_items` + `public.partner_order_items`
- Ý nghĩa:
  - `order_items` đi với `orders`
  - `partner_order_items` đi với `partner_orders`

Quy ước:
- Kitchen và màn chi tiết đơn phải đọc item từ hai bảng này.
- Không coi `raw_data.dishes` là nguồn chuẩn lâu dài nếu đã có `partner_order_items`.

## 4. Điểm khách hàng

- Master: `public.loyalty_accounts` + `public.loyalty_ledger`
- Ý nghĩa:
  - `loyalty_accounts`: số dư / snapshot hiện tại
  - `loyalty_ledger`: lịch sử cộng trừ điểm

Quy ước:
- Mọi màn hiển thị tổng điểm, điểm đã dùng, điểm đã cộng phải ưu tiên bám vào `loyalty_accounts` và `loyalty_ledger`.
- `orders` và `partner_orders` chỉ là nguồn đối chiếu điều kiện cộng điểm, không phải nguồn điểm cuối cùng.

## 5. Quà tháng

- Master: `public.monthly_customer_gifts`
- Ý nghĩa:
  - Đây là nguồn chuẩn cho việc khách đã được tặng quà tháng hay chưa.

Quy ước:
- `orders` và `partner_orders` chỉ dùng để tính khách có đủ điều kiện nhận quà hay không.
- Trạng thái "đã tặng" phải lấy từ `monthly_customer_gifts`.

## 6. Định danh đơn đối tác

- Master identity: `partner_source + nexpos_order_id`

Quy ước bắt buộc:
- Không dùng `order_code` làm identity thật cho `partner_orders`.
- `order_code` và `display_order_code` chỉ để hiển thị / tìm kiếm.
- n8n, Supabase REST, SQL migration, service code đều phải coi:
  - `partner_source + nexpos_order_id` là khóa nhận diện đúng

Ví dụ:
- Sai: upsert theo `order_code = GF-051`
- Đúng: upsert theo `partner_source = grabfood` + `nexpos_order_id = 001951915421-C76ZVZNHLE6HR6`

## 7. Quy tắc khi sửa hệ thống

Trước khi sửa bất kỳ luồng nào, luôn tự hỏi:

1. Dữ liệu này thuộc nguồn sự thật nào?
2. Màn này đang đọc đúng bảng master chưa?
3. Có đang tự suy lại dữ liệu từ nguồn phụ không?
4. Có đang dùng sai identity của partner order không?

## 8. Áp dụng hiện tại

Hiện tại chốt theo chuẩn sau:

- `profiles` = master khách hàng
- `orders` + `partner_orders` = master giao dịch
- `order_items` + `partner_order_items` = master chi tiết món
- `loyalty_accounts` + `loyalty_ledger` = master điểm
- `monthly_customer_gifts` = master quà tháng
- `partner_source + nexpos_order_id` = identity chuẩn của đơn đối tác

## 9. Ghi chú triển khai

Tài liệu này chỉ là quy ước kiến trúc.

Ở giai đoạn hiện tại:
- Chưa bắt buộc refactor toàn bộ app ngay.
- Ưu tiên bám quy ước này khi sửa bug hoặc thêm tính năng mới.
- Khi refactor sau này, mục tiêu là để mọi màn hình đi qua service/domain thống nhất thay vì tự ghép dữ liệu riêng.

## 9.1 Gift / Order Counting Rule

- `orders` + `partner_orders` là master cho:
  - tổng đơn
  - tổng chi tiêu
  - số đơn trong tháng
  - đơn thứ mấy trong tháng
- `monthly_customer_gifts` là master cho:
  - đã tặng quà tháng hay chưa
  - claim ở đơn nào
  - claim lúc nào
- Không dùng `profiles.total_orders` hoặc `profiles.total_spent` làm nguồn cuối để quyết định:
  - đủ điều kiện quà tháng
  - lần 1 / lần 2 / lần 3 trong tháng
- `profiles` chỉ là snapshot hỗ trợ hiển thị / fallback, không phải transaction truth.

Phase 2 runtime:
- `src/services/customerOrderCountingService.js` là shared contract hiện tại cho:
  - normalize status count
  - exclude status count
  - completed status count
  - `totalOrders`
  - `totalSpent`
  - monthly count map theo customer identity
- `src/services/orderSummaryService.js` và `src/services/kitchenCustomerRewardService.js` phải bám theo contract này, không tự định nghĩa rule count riêng.

Phase 3 runtime:
- `src/services/kitchenCustomerRewardService.js` không còn lấy `profiles.total_orders` / `profiles.total_spent` làm nguồn chính cho quà tháng.
- Kitchen reward identity không còn fallback theo `name-*`; nếu không có `phone` hoặc `external_id` ổn định thì không tự suy luận customer key.

Phase 4 runtime:
- `src/services/orderSummaryService.js` dùng shared counting contract giống kitchen reward.
- Tracking summary query theo phone variants chuẩn (`0xxxxxxxxx`, `84xxxxxxxxx`, `+84xxxxxxxxx`, `0084xxxxxxxxx`) để giảm sót đơn/điểm cũ do khác format phone.

Phase 5 runtime:
- `src/services/crmService.js` dùng cùng rule exclude order với shared counting contract.
- CRM `totalOrders`, `totalSpent`, `tier` phải ưu tiên transaction truth từ `orders + partner_orders`, không dùng snapshot register/profile để đè số giao dịch.

Regression:
- file checklist live cuối: `docs/source-of-truth-live-regression-checklist.md`

Phase 6 runtime:
- SQL aggregate mới nằm ở `docs/customer-order-counting-rpc.sql`
- `src/services/customerOrderCountingRpcService.js` là adapter gọi RPC aggregate
- Tracking summary ưu tiên `get_customer_order_count_summary(...)`
- Kitchen monthly gift ưu tiên `get_monthly_customer_gift_stats_by_phones(...)`
- Nếu RPC chưa có hoặc Supabase chưa deploy, app tự fallback về logic service-layer hiện tại

## 10. Runtime Source (áp dụng toàn app)

- `src/services/repositories/dataSource.js`: quyết định nguồn chạy (`supabase` hoặc `local`).
- `src/services/repositories/dataStrategyMatrix.js`: quyết định chiến lược theo key/table (hybrid cache, supabase-first, realtime, local-only).
- `src/services/repositories/repositoryRuntime.js`: adapter runtime cho repository.

Quy ước:
- Mọi luồng đọc/ghi phải đi qua `services/repositories/*`.
- Component không tự đọc localStorage hoặc gọi Supabase trực tiếp.

## 11. Source Of Truth Map v1

### 2.1 Orders

- Master table: `public.orders`
- Kênh áp dụng: weborder, website, QR, pickup nội bộ.
- Entry layer: `src/services/orderService.js` -> `src/services/repositories/orderRepository.js`

Read rule:
- Màn khách/admin/kitchen đọc đơn web từ `orderRepository` (được đồng bộ từ `public.orders`).
- Local cache chỉ là lớp tạm để hiển thị nhanh, không phải nguồn cuối.

Write rule:
- Tạo/sửa trạng thái đơn web đi qua `orderService`/`orderRepository`.
- Không ghi trực tiếp `ordersByPhone` từ UI.

### 2.2 Order Items

- Master table: `public.order_items`
- Quan hệ: `order_items.order_id` -> `orders.id`

Read rule:
- Màn chi tiết đơn và kitchen phải ưu tiên item từ `order_items`.
- Không coi `order.items` trong payload local là nguồn chuẩn lâu dài.

Write rule:
- Khi ghi đơn web, phải đảm bảo item được ghi đồng bộ theo `order_id`.

Order Item Schema v1:
- `id`: id hiển thị trong app, ưu tiên `product_id`/cart item id.
- `sourceItemId`: id row thật trong `order_items`, dùng cho kitchen update từng món.
- `orderId`: khóa liên kết về `orders.id`.
- `productId`: id sản phẩm web nếu có.
- `name`: tên món hiển thị.
- `quantity`: số lượng, luôn là số >= 1.
- `price`: đơn giá hiển thị.
- `unitTotal`: đơn giá sau lựa chọn/topping nếu có.
- `lineTotal`: tổng tiền dòng món.
- `note`: ghi chú món.
- `spice`: lựa chọn cay nếu có.
- `toppings`: danh sách topping gốc, giữ object `{ id, name, price, quantity }` nếu có.
- `optionGroups`: danh sách nhóm lựa chọn gốc.
- `options`: danh sách text đã flatten để kitchen/printer hiển thị nhanh.
- `kitchenItemStatus`: trạng thái bếp chuẩn (`pending`/`done`).
- `status`: alias UI cho `kitchenItemStatus`.
- `metadata`: payload gốc để tương thích dữ liệu cũ.

Quy ước:
- UI vẫn đọc qua `order.items`, nhưng `order.items` phải được build từ `order_items`.
- Kitchen update từng món bằng `sourceItemId`, không dùng `productId`.
- Printer ưu tiên `options`, fallback sang `toppings`/`optionGroups`.
- Không tính tiền lại từ text option, chỉ dùng `lineTotal`/`unitTotal`.

### 2.3 Partner Orders

- Master table: `public.partner_orders`
- Item table: `public.partner_order_items`
- Entry layer: `src/services/partnerOrderService.js`
- Identity chuẩn: `partner_source + nexpos_order_id`

Read rule:
- Guest lookup/tracking có thể merge web + partner để hiển thị.
- Nhưng dữ liệu partner phải đọc từ `partner_orders`/`partner_order_items`.

Write rule:
- Upsert đơn đối tác bắt buộc theo `partner_source + nexpos_order_id`.
- `order_code`/`display_order_code` chỉ để hiển thị, không dùng làm identity.

### 2.4 Loyalty

- Master tables: `public.loyalty_accounts` + `public.loyalty_ledger`
- Entry layer: `src/services/loyaltyService.js` + `src/services/repositories/loyaltyRepository.js`

Read rule:
- Tổng điểm hiển thị lấy từ `loyalty_accounts`.
- Lịch sử cộng/trừ điểm lấy từ `loyalty_ledger`.

Write rule:
- Cộng/trừ điểm chỉ đi qua `loyaltyService`.
- `orders` chỉ là điều kiện phát sinh điểm, không là nguồn điểm cuối.

## 12. Data Flow Chuẩn

`Component (UI) -> Hook -> Service -> Repository -> Supabase`

Không đi ngược flow.

## 13. Checklist Trước Khi Sửa Tính Năng

1. Dữ liệu này thuộc domain nào (`orders`, `order_items`, `partner_orders`, `loyalty`)?
2. Domain đó đang đọc đúng bảng master chưa?
3. Có đang lưu state trùng với nguồn chuẩn không?
4. Có dùng sai identity của partner order không?

## 14. Phạm vi v1

- Ưu tiên chuẩn hóa `orders` trước.
- Sau đó chuẩn hóa `loyalty`.
- `cart` hiện coi là draft state phía client, không phải giao dịch master.

## 15. Checklist Refactor Orders An Toàn

### Phase 1 - Chuẩn hóa Write Path

Trạng thái code: đã gom logic `updateOrder/updateOrderAsync` về helper chung trong `orderService`.

- [ ] Tạo đơn từ checkout vẫn lưu được vào `public.orders`.
- [ ] Cập nhật trạng thái đơn (pending -> confirmed/done) vẫn chạy đúng.
- [ ] Không có màn UI nào ghi trực tiếp `ordersByPhone`.
- [ ] Luồng external order vẫn tạo đơn thành công qua `orderService/orderRepository`.

### Phase 2 - Chuẩn hóa Read Path

Trạng thái code: đã chuẩn hóa output đọc từ `orderRepository` cho `getByPhone/getAll/getAllByPhone` sync/async.

- [ ] `getByPhone/getAll` trả về format ổn định, không thiếu field quan trọng (`id`, `orderCode`, `status`, `createdAt`, `items`).
- [ ] Tracking khách hiển thị đúng đơn web mới nhất.
- [ ] Account page hiển thị lịch sử đơn không bị trùng.
- [ ] Guest lookup trả đúng danh sách đơn theo số điện thoại.

### Phase 3 - Tách Side Effects (Loyalty/Address/Profile)

Trạng thái code: đã tách side effect sau khi tạo đơn thành helper riêng trong `orderService`.

- [ ] Sau khi tạo đơn, loyalty vẫn cộng/trừ đúng theo rule.
- [ ] Voucher loyalty dùng rồi vẫn đánh dấu `used` đúng.
- [ ] Address từ đơn giao hàng vẫn lưu vào danh sách địa chỉ khách.
- [ ] Không làm sai tổng điểm và lịch sử điểm đang có.

### Phase 4 - Realtime/Event Ổn định

Trạng thái code: đã thêm `changedPhones` cho event `ghr:orders-changed`, lọc refresh customer theo phone và debounce refresh admin.

- [ ] Event `ghr:orders-changed` vẫn trigger refresh cho customer session.
- [ ] Admin Orders nhận thay đổi mới mà không cần reload trang.
- [ ] Không bị spam refresh hoặc gọi lặp quá nhiều request.
- [ ] Realtime theo phone chỉ cập nhật đúng khách liên quan.

### Phase 5 - Regression Theo Màn Hình

Trạng thái kiểm tra tự động: `npm.cmd run build` pass, `npm.cmd run smoke:flows` pass, route `/home`, `/orders`, `/checkout`, `/admin/orders`, `/admin/customers`, `/kitchen` trả HTTP 200 trên dev server.

- [ ] Customer Checkout: tạo đơn thành công, clear cart đúng.
- [ ] Customer Tracking: thấy đúng trạng thái và timeline đơn.
- [ ] Account: lịch sử đơn + branch + total hiển thị đúng.
- [ ] Admin Orders: lọc ngày, đổi trạng thái, mở chi tiết đơn hoạt động bình thường.
- [ ] Admin CRM: tổng khách, tổng đơn, điểm loyalty không tụt bất thường.
- [ ] Kitchen: đơn web mới và chi tiết món vẫn lên đúng.

## 16. Điều kiện Pass Trước Khi Merge

- [ ] Không lỗi console nghiêm trọng liên quan `orderRepository/orderService`.
- [ ] Không có thay đổi schema đầu ra làm vỡ UI cũ.
- [ ] Không mất dữ liệu đơn cũ khi bật `supabase` mode.
- [ ] Không tăng request bất thường ở màn Admin/Tracking.

## 17. Checklist Refactor Order Items An Toàn

### Phase 1 - Audit Và Chốt Schema

Trạng thái code: đã chốt `Order Item Schema v1` trong tài liệu này.

- [ ] Web order item có đủ `id`, `sourceItemId`, `orderId`, `productId`, `name`, `quantity`, `lineTotal`.
- [ ] Kitchen item dùng `sourceItemId` để update từng món.
- [ ] Printer có dữ liệu `options`/`toppings`/`optionGroups` để in đúng lựa chọn.

### Phase 2 - Chuẩn hóa Read Mapper

Trạng thái code: đã chuẩn hóa read mapper cho `order_items` và `partner_order_items` ở repository, partner lookup, admin feed và kitchen.

- [ ] `order_items` đọc từ Supabase map về `Order Item Schema v1`.
- [ ] `partner_order_items` đọc từ Supabase map về format tương thích.
- [ ] Tracking/Admin/Kitchen/Printer đều nhận item không thiếu field.

### Phase 3 - Chuẩn hóa Write Mapper

Trạng thái code: đã gom mapper ghi `order_items` về helper riêng trong `coreSupabaseRepository`, ghi đủ topping/option group/metadata và có fallback nếu schema thiếu cột mới.

Ghi chú tối ưu sau:
- Hiện write path vẫn dùng chiến lược xóa toàn bộ `order_items` theo `order_id` rồi insert lại danh sách item mới.
- Chiến lược này đang được giữ để giảm rủi ro refactor, nhưng chưa phải tối ưu cuối.
- Khi tối ưu sâu hơn, nên chuyển sang upsert từng item theo `sourceItemId`/row id ổn định, xử lý riêng item thêm/xóa/sửa để không ảnh hưởng trạng thái bếp đang tick từng món.

- [ ] Checkout ghi đủ `order_items`.
- [ ] Topping/option group được lưu vào column riêng và `metadata`.
- [ ] Không mất item khi update trạng thái order.

### Phase 4 - Kitchen Item Status

Trạng thái code: đã nối thao tác tick từng món trên kitchen vào `updateKitchenOrderItemStatus`, ghi đúng bảng item theo source và subscribe realtime cho `order_items`/`partner_order_items`. Đơn không tự chuyển sang tab hoàn thành chỉ vì item đã tick đủ; phải đi qua nút xác nhận trạng thái đơn để tránh bỏ sót topping/local progress.

- [ ] Tick từng món web order cập nhật `order_items.kitchen_item_status`.
- [ ] Tick từng món partner order cập nhật `partner_order_items.kitchen_item_status`.
- [ ] Order chỉ ẩn khỏi tab đang xử lý khi trạng thái order đã được xác nhận xong, không tự ẩn chỉ vì item đã tick đủ.

### Phase 5 - Regression Theo Màn Hình

Trạng thái kiểm tra tự động: `npm.cmd run build` pass, `npm.cmd run smoke:flows` pass, route `/home`, `/orders`, `/checkout`, `/admin/orders`, `/admin/customers`, `/kitchen` trả HTTP 200 trên dev server.

- [ ] Checkout tạo đơn có món đúng trong Supabase.
- [ ] Admin mở chi tiết đơn thấy đủ món/topping/ghi chú.
- [ ] Customer tracking thấy đủ món.
- [ ] Kitchen tick từng món không ảnh hưởng món khác.
- [ ] In bill hiển thị đúng món, số lượng, topping, ghi chú, tổng tiền.

## 18. Audit Partner Orders Trước Refactor

### 18.1 Source Of Truth

- Master table: `public.partner_orders`
- Item table: `public.partner_order_items`
- Identity chuẩn: `partner_source + nexpos_order_id`
- Display/search only: `order_code`, `display_order_code`
- Entry layer app: `src/services/partnerOrderService.js`
- Entry layer external: n8n/NexPOS mapping theo `docs/n8n-nexpos-partner-orders-mapping.md`

Quy ước bắt buộc:
- Không upsert partner order bằng `order_code`.
- Không dùng `display_order_code` làm khóa nhận diện thật.
- Item phải gắn bằng `partner_order_items.partner_order_id -> partner_orders.id`.
- Kitchen update item bằng row `partner_order_items.id`/`sourceItemId`, không update theo tên món.

### 18.1.1 Partner Orders Contract v1

Order identity:
- `partner_source`: nguồn đã normalize (`grabfood`, `shopeefood`, `xanhngon`, `partner`).
- `nexpos_order_id`: id ổn định từ NexPOS/platform.
- Unique DB target: `partner_orders_source_nexpos_order_id_key`.
- Không coi `order_code` là unique vì mã hiển thị của Grab/Shopee có thể lặp.

Order display/search:
- `order_code`: mã hiển thị/tìm kiếm từ platform.
- `display_order_code`: mã hiển thị ưu tiên nếu có.
- Hai field này có thể dùng để search UI, không dùng để upsert/dedup identity.

Order customer:
- `customer_phone`: số gốc từ platform nếu có.
- `customer_phone_key`: số đã normalize, dùng lookup/tracking/claim điểm.
- Nếu `customer_phone_key` thiếu, guest lookup/account có thể không thấy partner order.

Order status layers:
- `nexpos_status`: trạng thái thô từ NexPOS/platform, chỉ phản ánh nguồn ngoài.
- `order_status`: trạng thái nghiệp vụ partner order trong app/admin/customer. Đây là bucket business chuẩn để UI/report/filter dùng.
- `kitchen_status`: compatibility field theo contract DB/legacy read hiện tại, không tự gán thêm nghĩa mới nếu schema chưa hỗ trợ.
- `kitchen_work_status`: trạng thái thao tác bếp nội bộ, không ghi đè `nexpos_status`, và là nguồn chuẩn cho tiến độ bếp.
- `point_status`: trạng thái claim điểm partner (`pending`/`claimed`/trạng thái RPC trả về).

Recommended long-term rule:
- `nexpos_status` = truth gốc từ platform.
- `order_status` = truth business của app.
- `kitchen_status` = field tương thích, chỉ map theo enum DB đang chấp nhận.
- `kitchen_work_status` = truth cho thao tác bếp nội bộ.

Recommended partner ingest mapping:
- `DOING` / `PROCESSING` / `PREPARING` -> `order_status = preparing`, `kitchen_status = pending`, `kitchen_work_status = pending`
- `PICK` / `READY` -> `order_status = ready`, `kitchen_status = pending`
- `PRE_ORDER` / `PREORDER` / `SCHEDULED` -> `order_status = new`, `kitchen_status = preorder`
- `FINISH` / `COMPLETED` -> `order_status = completed`, `kitchen_status = served`
- `CANCEL` / `REFUND` -> `order_status = cancelled` hoặc `refunded`, `kitchen_status = cancelled`

Order finance:
- `subtotal`: tổng món trước phí/giảm nếu platform có.
- `discount_amount`: giảm giá từ platform.
- `shipping_fee`: phí giao từ platform nếu có.
- `total_amount`: tổng đơn partner hiển thị.
- `points_base_amount`: số tiền làm căn cứ claim điểm, ưu tiên giá trị đã chuẩn hóa từ n8n/NexPOS.

Order branch:
- `nexpos_hub_id`, `nexpos_site_id`: khóa mapping chi nhánh từ NexPOS.
- `branch_code`, `branch_uuid`: khóa GHR dùng để lọc kitchen/admin theo chi nhánh.
- Nếu thiếu `branch_uuid`, kitchen có thể không thấy đơn khi đang lọc theo chi nhánh.

Item identity:
- `partner_order_id`: FK về `partner_orders.id`, bắt buộc dùng để gom item.
- `item_key`: khóa item trong phạm vi một partner order.
- Unique DB target khuyến nghị: `partner_order_items_order_item_key_key` (`partner_order_id`, `item_key`).
- `partner_item_id`/`partner_item_sku`/`web_product_id` chỉ là thông tin item/mapping, không thay thế `partner_order_id + item_key`.

Item status:
- `kitchen_item_status`: trạng thái tick từng món trong bếp.
- `item_status`: legacy/fallback, không nên là status chuẩn mới.

Current ingest mode:
- Hiện tại n8n được phép upsert trực tiếp table nếu tuân thủ contract này.
- RPC ingest partner order để sau; khi làm RPC, contract input/output phải bám v1 này.
- Flow hiện tại: upsert `partner_orders` -> lấy `partner_orders.id` -> delete `partner_order_items` theo `partner_order_id` -> insert item mới.

Audit note:
- `docs/partner-orders-unique-nexpos-order-id.sql` đã định nghĩa unique constraint đúng.
- `docs/n8n-nexpos-partner-orders-mapping.md` đã mô tả flow n8n đúng.
- Một vài file test cũ vẫn có `on conflict (order_code)` và cần được coi là legacy/test-only trước khi dùng lại.

### 18.2 Nơi Đang Liên Quan

Customer:
- `src/features/orders/TrackingView.jsx`: merge web order + partner order, claim điểm partner.
- `src/features/orders/hooks/useGuestOrderLookup.js`: guest lookup theo phone, merge partner.
- `src/features/account/hooks/useAccountViewModel.js`: lịch sử đơn tài khoản gồm partner order.
- `src/services/customerOrderStatusService.js`: hiển thị trạng thái partner theo `nexposStatus`/raw status.

Admin/CRM:
- `src/services/adminOrderFeedService.js`: đọc `partner_orders` + `partner_order_items`, merge vào admin feed.
- `src/pages/admin/state/useAdminOrderCrmState.js`: realtime admin cho partner tables.
- `src/pages/admin/actions/useAdminOrderCrmActions.js`, `src/pages/admin/AdminOrdersCrmSection.jsx`, `src/pages/admin/orders/OrderManager.jsx`: màn admin orders/CRM.
- `src/services/crmService.js`, `src/services/orderSummaryService.js`: tổng hợp chỉ số có partner order.

Kitchen:
- `src/services/kitchenOrderService.js`: đọc partner order/item, map NexPOS status, update `kitchen_work_status`, update item status.
- `src/hooks/useKitchenOrders.js`: realtime partner order/item, lọc active/done/cancelled.
- `src/features/kitchen/KitchenPage.jsx`, `src/features/kitchen/KitchenOrderCard.jsx`: thao tác bếp.
- `src/services/kitchenCustomerRewardService.js`: quà tháng/tần suất đơn có tính partner order.

Loyalty/claim:
- `src/services/partnerOrderService.js`: `claimPartnerOrderPoints`.
- `docs/partner-orders-claim-points.sql`: RPC claim điểm partner.
- `docs/partner-orders-test-claim.sql`: test claim điểm.

Database/docs:
- `docs/n8n-nexpos-partner-orders-mapping.md`: mapping n8n/NexPOS.
- `docs/partner-orders-unique-nexpos-order-id.sql`: constraint `partner_source + nexpos_order_id`.
- `docs/partner-orders-branch-fields.sql`, `docs/partner-orders-branch-hard-link.sql`: mapping chi nhánh.
- `docs/kitchen-work-status.sql`: kitchen work/item status cho partner.
- `docs/kitchen-nexpos-status-test-order.sql`: test status NexPOS.

### 18.3 Rủi Ro Chính

- Sai identity: dùng `order_code` để upsert sẽ gộp nhầm đơn vì mã Grab/Shopee có thể lặp.
- Trùng/thiếu item: nếu n8n delete/insert item sai `partner_order_id`, admin/kitchen/customer sẽ thiếu món.
- Branch mapping sai: `nexpos_hub_id`/`nexpos_site_id` không map đúng `branch_uuid` làm kitchen chi nhánh không thấy đơn.
- Status lệch: `nexpos_status`, `order_status`, `kitchen_status`, `kitchen_work_status` có ý nghĩa khác nhau; không được trộn bừa.
- Claim điểm sai: partner order chỉ cộng điểm khi khách claim/RPC hợp lệ, không tự cộng như web order.
- Realtime spam/thiếu: partner order/item đổi phải refresh admin/kitchen đúng nguồn, không kéo nhầm toàn bộ quá nhiều.
- Raw fallback: kitchen hiện còn fallback từ `raw_data.dishes` nếu thiếu `partner_order_items`; cần giữ tạm để không mất đơn cũ.

## 19. Checklist Refactor Partner Orders An Toàn

### Phase 1 - Audit Và Chốt Contract

Trạng thái code: đã audit nơi liên quan, xác nhận identity chuẩn, rủi ro chính và `Partner Orders Contract v1` trong tài liệu này. Chưa đổi logic runtime ở phase này.

- [x] Docs schema có unique constraint `partner_orders_source_nexpos_order_id_key`.
- [x] Docs n8n yêu cầu upsert theo `partner_source + nexpos_order_id`.
- [x] Contract ghi rõ `order_code`/`display_order_code` chỉ dùng hiển thị/tìm kiếm.
- [x] Docs schema có unique theo `partner_order_id + item_key`.
- [x] Xác nhận live Supabase đã chạy migration/constraint đúng.
- [x] Xác nhận workflow n8n production không còn upsert theo `order_code`.

### Phase 2 - Chuẩn Hóa Read Mapper

Trạng thái code: đã chuẩn hóa read mapper chính cho customer/account/tracking (`partnerOrderService`), admin/CRM (`adminOrderFeedService`) và kitchen (`kitchenOrderService`) để có field ổn định: `partnerSource`, `nexposOrderId`, `orderStatus`, `kitchenStatus/kitchenWorkStatus`, `pointStatus`, finance fields, `rawData`, và item format tương thích.

Trạng thái kiểm tra tự động: `npm.cmd run build` pass, `npm.cmd run smoke:flows` pass.

- [x] `partnerOrderService` trả partner order format ổn định cho customer/account/tracking.
- [x] `adminOrderFeedService` trả partner order format ổn định cho admin/CRM.
- [x] `kitchenOrderService` ưu tiên `partner_order_items`, chỉ fallback `raw_data.dishes` cho dữ liệu cũ.
- [ ] Status hiển thị thống nhất giữa customer/admin/kitchen.

### Phase 3 - Identity Và Dedup

Trạng thái code: đã thêm identity helper dùng chung cho partner order. Key nghiệp vụ ưu tiên `partner_source + nexpos_order_id`, fallback sang row `id`; `order_code`/`display_order_code` không còn là khóa dedup partner.

- [x] Admin/customer merge không dedupe nhầm theo `order_code`.
- [x] Key nội bộ dùng `sourceType + partner id/nexposOrderId`.
- [x] Guest lookup không gộp nhầm hai đơn khác nhau có cùng mã hiển thị.
- [x] Account history không bị trùng partner order.

### Phase 4 - Kitchen/Realtime Partner

Trạng thái code: đã rà lại kitchen partner flow. Partner kitchen đọc theo ngày/trạng thái rồi lọc chi nhánh sau mapper để không rơi đơn khi n8n/NexPOS thiếu `branch_uuid` nhưng có branch/site/hub name trong field khác hoặc `raw_data`. Realtime partner cũng nhận thêm branch candidates từ `raw_data`. Stable key partner trên kitchen ưu tiên `partner_source + nexpos_order_id`.

- [x] Partner order mới từ n8n/NexPOS tự hiện trên kitchen đúng chi nhánh.
- [x] NexPOS status `DOING/PICK/FINISH/CANCELLED/PRE_ORDER` map đúng active/done/cancel/preorder.
- [x] Tick từng partner item cập nhật `partner_order_items.kitchen_item_status`.
- [x] Mark partner done cập nhật `partner_orders.kitchen_work_status`, không ghi nhầm `nexpos_status`.

### Phase 5 - Loyalty/Claim/Gift

Trạng thái code: đã siết claim điểm partner và reward/summary. App nhận biết trường hợp partner order đã claim trước đó để cập nhật UI thành `claimed` thay vì báo lỗi thường. SQL RPC được cập nhật theo hướng idempotent: nếu ledger `PARTNER_ORDER_EARN` đã tồn tại thì đồng bộ `partner_orders.point_status = claimed` và không cộng thêm điểm. Monthly gift và order summary loại đơn hủy/preorder/scheduled khỏi điều kiện tính.

- [x] Claim điểm partner order không cộng trùng.
- [x] Partner order đã claim cập nhật đúng `point_status`.
- [x] Monthly gift/customer reward tính partner order đúng điều kiện, không tính đơn hủy/preorder.
- [x] CRM/order summary không đếm sai khách hoặc doanh thu partner.

### Phase 6 - Regression Theo Màn Hình

Trạng thái kiểm tra tự động: `npm.cmd run build` pass, `npm.cmd run smoke:flows` pass. Route smoke trên dev server pass HTTP 200 cho `/home`, `/orders`, `/account`, `/admin/orders`, `/admin/customers`, `/kitchen`.

Ghi chú: `npm.cmd run smoke:loyalty` hiện còn fail ở cấu hình mặc định `currencyPerPoint mismatch`; đây là smoke cấu hình loyalty riêng, không phải lỗi mới của `partner_orders`. Cần xử lý ở phase loyalty/config sau.

- [x] Customer tracking/guest lookup route load được.
- [x] Account history route load được.
- [x] Admin Orders route load được.
- [x] Kitchen route load được.
- [ ] Manual: Customer tracking/guest lookup thấy đúng web + partner order với dữ liệu live.
- [ ] Manual: Account history thấy đúng partner order và trạng thái với dữ liệu live.
- [ ] Manual: Admin Orders lọc ngày/nguồn/trạng thái đúng với dữ liệu live.
- [ ] Manual: Kitchen thấy partner order mới đúng chi nhánh, tick item và done hoạt động với dữ liệu live.
- [ ] Manual: Claim điểm partner hoạt động và không double point với dữ liệu live.

## 20. Backlog Source Of Truth: Profiles/Branches

Lý do ghi chú:
- Khi test `partner_orders` Phase 6, đơn partner test đã đúng `partner_orders.branch_uuid` và có đủ item nhưng kitchen không hiện.
- Nguyên nhân phát hiện: profile bếp live lưu chi nhánh chuẩn ở cột `profiles.branch_uuid`, trong khi code cũ chỉ đọc `profiles.metadata.branch_uuid`.
- Đã sửa tạm điểm bắt buộc ở `src/services/kitchenAuthService.js` để ưu tiên đọc `profiles.branch_uuid` trước metadata.

Quy ước cần chốt khi refactor sau:
- `public.branches.branch_uuid` là master identity của chi nhánh.
- `public.profiles.branch_uuid` là source of truth cho chi nhánh được gán của staff/kitchen/admin theo chi nhánh.
- `admin` có `branch_uuid = null` được hiểu là global admin nếu tài khoản đó cần xem/quản lý toàn bộ chi nhánh.
- `profiles.metadata.branch_name`/`profiles.metadata.branch_alias` chỉ là display/fallback legacy.
- `orders.branch_uuid`/`pickup_branch_uuid`/`delivery_branch_uuid` là branch của web order.
- `partner_orders.branch_uuid` là branch của partner order.
- Mọi filter kitchen/admin theo chi nhánh phải ưu tiên UUID, chỉ fallback name/alias khi thiếu UUID.

Khi làm tới domain profile/branch hoặc bất kỳ task nào liên quan chi nhánh, phải audit trước:
- `src/services/kitchenAuthService.js`
- `src/features/kitchen/KitchenPage.jsx`
- `src/hooks/useKitchenOrders.js`
- `src/services/kitchenOrderService.js`
- `src/pages/admin/orders/OrderManager.jsx`
- Checkout pickup/QR branch mapping
- Printer branch info

Lộ trình đề xuất:
1. Audit toàn bộ nơi đọc `branch_uuid`, `branchUuid`, `branch_name`, `branchAlias`, `metadata.branch_*`.
2. Chốt contract `profiles/branches`.
3. Tạo helper dùng chung để normalize branch identity.
4. Sửa từng flow nhỏ: kitchen -> admin -> checkout/QR -> printer.
5. Regression theo 3 chi nhánh 30/4, TQD, LHP.

## 21. Checklist Refactor Profiles/Branches An Toàn

### Phase 1 - Audit Và Chốt Contract

Trạng thái code: chưa đổi logic runtime. Phase này chỉ tạo checklist audit live Supabase và chốt contract source of truth cho chi nhánh/profile.

SQL audit read-only:
- `docs/profiles-branches-source-of-truth-audit.sql`

Contract v1:
- `public.branches.branch_uuid` là identity chuẩn của chi nhánh.
- `public.profiles.branch_uuid` là chi nhánh được gán cho staff/kitchen/admin theo chi nhánh.
- `admin.branch_uuid = null` được phép nếu đó là global admin/owner quản lý toàn hệ thống.
- `profiles.metadata.branch_name` và `profiles.metadata.branch_alias` chỉ là display/fallback legacy, không phải identity chuẩn.
- `orders.branch_uuid`, `orders.pickup_branch_uuid`, `orders.delivery_branch_uuid` là branch của web order.
- `partner_orders.branch_uuid` là branch của partner order.
- `partner_order_items.branch_uuid` phải đi theo `partner_orders.branch_uuid`.
- `print_jobs.branch_uuid` là scope để máy in/bếp đọc đúng chi nhánh.

Nơi đã audit liên quan:
- `src/services/kitchenAuthService.js`: đọc profile bếp và branch scope.
- `src/services/adminAuthService.js`: đọc profile quyền admin/staff/kitchen.
- `src/services/kitchenOrderService.js`: lọc web/partner order theo chi nhánh.
- `src/hooks/useKitchenOrders.js`: realtime và lọc kitchen theo profile branch.
- `src/services/repositories/coreSupabaseRepository.js`: enrich `branch_uuid` khi ghi web order.
- `src/services/repositories/catalogSupabaseRepository.js`: đọc/ghi bảng `branches`.
- `src/pages/admin/store/BranchSettings.jsx`: UI quản lý chi nhánh, gọi service sync branch.
- `src/services/partnerOrderService.js`: resolve branch hiển thị cho partner/web order.
- `src/services/printJobService.js`: scope print job theo `branch_uuid`.

Rủi ro chính:
- `profiles.branch_uuid` thiếu/sai làm bếp/staff theo chi nhánh không thấy đơn hoặc thấy nhầm chi nhánh.
- Không phân biệt global admin với staff/kitchen có thể tạo báo động giả khi audit.
- `branches.branch_uuid` thiếu/trùng làm web order, partner order và print job không cùng identity.
- Dùng `branch_name`/`branch_alias` làm identity sẽ dễ sai khi đổi tên chi nhánh.
- Siết filter theo UUID quá sớm có thể làm rơi đơn cũ nếu live data chưa backfill đủ.
- Admin sửa chi nhánh trực tiếp mà không qua contract/RPC có thể làm mất `branch_uuid`.

Điều kiện pass Phase 1:
- [ ] Live Supabase có `branches.branch_uuid` đầy đủ và không trùng.
- [ ] Kitchen/staff profiles có `profiles.branch_uuid` đúng với `branches.branch_uuid`.
- [ ] Admin không có `branch_uuid` đã được xác nhận là global admin, không phải tài khoản chi nhánh bị thiếu cấu hình.
- [ ] Không có profile vận hành trỏ tới `branch_uuid` không tồn tại.
- [ ] Web orders 30 ngày gần nhất có branch UUID hợp lệ hoặc có kế hoạch backfill rõ.
- [ ] Partner orders 30 ngày gần nhất có `branch_uuid` hợp lệ.
- [ ] Partner order items không lệch `branch_uuid` với parent order.
- [ ] Print jobs có `branch_uuid` đủ để scope đúng máy/chi nhánh.
- [ ] Chốt được hướng Phase 2: tạo branch identity helper/service trước khi sửa các màn hình.

### Phase 2 - Branch Identity Helper/Service

Trạng thái code: đã tạo `src/services/branchIdentityService.js` làm helper/service chuẩn để normalize và resolve branch identity. Đã nối helper này vào `partnerOrderService`, `OrderManager` và `coreSupabaseRepository` để giảm logic tự đoán chi nhánh rải rác.

Mục tiêu: gom logic resolve branch về một nơi, ưu tiên `branch_uuid`, fallback `branch_code/name/alias` chỉ để đọc legacy.

Quy ước helper:
- `normalizeBranchKey`: normalize text chi nhánh để so khớp legacy.
- `getBranchCandidates`: gom candidate identity từ branch canonical.
- `getOrderBranchCandidates`: gom candidate branch từ web/partner order/raw/metadata.
- `resolveOrderBranch`: resolve order về branch canonical.
- `getCanonicalOrderBranchName`: lấy tên branch hiển thị từ branch canonical trước, fallback dữ liệu order.
- `buildBranchLookupMap`: map branch candidate về `branch_uuid` để enrich web order.
- `buildBranchFilterOptions` và `branchOptionMatchesOrder`: dùng cho filter admin theo chi nhánh.

- [x] Tạo helper/service branch identity dùng chung.
- [x] Partner/web order display dùng chung `resolveOrderBranch`.
- [x] Admin Orders branch filter dùng chung branch identity helper.
- [x] Web order repository enrich UUID dùng chung branch lookup helper.
- [ ] Kitchen branch matching chuyển sang helper trong phase sau để tránh đổi filter bếp quá sớm.

### Phase 3 - Profile RPC

Trạng thái code: đã thêm SQL RPC tại `docs/profile-branch-rpc.sql` và service wrapper `src/services/profileBranchService.js`. `adminAuthService` cũng đã đọc `branch_uuid`/`metadata` để admin session hiểu được profile branch hoặc global admin.

Mục tiêu: tạo RPC/service để gán chi nhánh cho profile, validate `branch_uuid` tồn tại trong `branches`, tránh UI hoặc workflow ngoài ghi profile branch lung tung.

Contract phase 3:
- `assign_operational_profile_branch(profile_id, branch_uuid, allow_global_admin)`:
  - gán lại branch cho profile hiện có.
  - staff/kitchen bắt buộc có `branch_uuid`.
  - admin chỉ được `branch_uuid = null` nếu là global admin.
- `upsert_operational_profile(phone, name, role, status, branch_uuid, email, auth_user_id, allow_global_admin)`:
  - upsert profile vận hành theo `phone`.
  - validate role chỉ thuộc `admin/staff/kitchen`.
  - sync `branch_uuid` + metadata branch display theo `branches`.

- [x] Tạo SQL RPC cho profile branch assignment.
- [x] Tạo service wrapper `profileBranchService`.
- [x] Chuẩn hóa rule global admin so với staff/kitchen.
- [x] `adminAuthService` đọc được branch/global-admin context.
- [ ] Màn admin quản lý staff/profile gọi RPC này trực tiếp trong phase sau nếu cần UI quản trị.

### Phase 4 - Kitchen Scope

Mục tiêu: kitchen auth, kitchen query, realtime và print job cùng dùng branch scope chuẩn từ `profiles.branch_uuid`.

### Phase 5 - Admin/Checkout/QR/Printer

Mục tiêu: admin filter, checkout pickup/delivery, QR branch lock và printer đều dùng chung identity branch.

### Phase 6 - Regression Theo Chi Nhánh

Mục tiêu: test 30/4, TQD, LHP với web order, partner order, preorder/doing, tick món, done, in đơn và lọc admin.

## 22. Audit Customer Profiles Trước Refactor

### 22.1 Source Of Truth

- Master table: `public.profiles`
- Domain áp dụng: hồ sơ khách web order, tài khoản khách đăng nhập, khách được hydrate từ order/loyalty/address.
- Identity chính: `profiles.phone`
- Identity liên kết auth: `profiles.auth_user_id` là link phụ, không thay thế `phone`.

Quy ước hiện tại cần chốt:
- `profiles.phone` là khóa nhận diện customer trong app, CRM, loyalty, order lookup.
- `auth_user_id` chỉ là liên kết tới Supabase Auth khi khách có tài khoản.
- `registered = true` nghĩa là khách đã được app coi là có tài khoản/member, nhưng không đồng nghĩa 100% đã có auth user chuẩn nếu dữ liệu legacy chưa sạch.
- `role = customer` là role chuẩn cho hồ sơ khách. `admin/staff/kitchen` là domain vận hành riêng, không trộn với customer profile.

### 22.2 Write Paths Hiện Tại

Qua audit code, customer profile hiện đang có nhiều đường ghi:

1. `customerRepository` -> `coreSupabaseRepository.writeProfileRowToTable`
- File chính: `src/services/repositories/customerRepository.js`
- Dùng khi app save user cache hoặc upsert customer theo phone.

2. `supabaseAuthService.syncCustomerProfileToSupabase`
- File chính: `src/services/supabaseAuthService.js`
- Dùng khi khách register/login/update profile qua Supabase Auth.
- Hiện đang `upsert` trực tiếp `profiles` theo `phone`.

3. `coreSupabaseRepository.ensureProfileExistsByPhone`
- File chính: `src/services/repositories/coreSupabaseRepository.js`
- Tự tạo stub profile khi ghi loyalty/address nếu phone chưa có trong `profiles`.

4. `useAccountViewModel`
- File chính: `src/features/account/hooks/useAccountViewModel.js`
- Vừa gọi `customerRepository.upsertCustomerByPhone`, vừa gọi `syncCustomerProfileToSupabase`, nên đây là nơi có khả năng ghi profile lặp theo hai lớp.

Ghi chú quan trọng:
- Hiện tại `n8n` không thấy ghi trực tiếp vào `profiles`.
- `partner_orders` không tự tạo profile customer trực tiếp; customer profile partner chủ yếu được hydrate gián tiếp qua lookup, claim điểm, loyalty hoặc sync app.

### 22.3 Read Paths Liên Quan

- `customerRepository.getUsers/getUserByPhone/getUsersAsync`: nguồn app/account đang đọc user profile.
- `crmService`: đọc `profiles` để dựng CRM registered users.
- `useAccountViewModel`: đọc profile local + remote + auth snapshot rồi merge UI.
- `coreSupabaseRepository.readProfilesMapFromTable`: map toàn bộ customer profiles từ Supabase.
- `subscribeProfilesRealtime`: sync realtime `profiles` về app/admin khi cần.

### 22.4 Rủi Ro Chính

- Nhiều write path cho cùng một domain `profiles` làm dễ ghi trùng, ghi lệch field hoặc cập nhật không đồng nhất.
- `registered` có thể bị đẩy lên `true` từ app local trước khi auth/profile sync thật sự hoàn chỉnh.
- `ensureProfileExistsByPhone` tạo stub profile là cần thiết để không rơi loyalty/address, nhưng dễ tạo nhiều profile “rỗng” nếu không có contract rõ.
- Customer partner có thể có `partner_orders` nhưng chưa hydrate về `profiles`, làm CRM/account/claim flow nhìn không nhất quán.
- `useAccountViewModel` hiện đang save local rồi sync Supabase tiếp, nghĩa là có nguy cơ cùng một thao tác đi qua 2 write path nối tiếp.

### 22.5 SQL Audit Read-Only

- `docs/customer-profiles-source-of-truth-audit.sql`

SQL này dùng để kiểm tra:
- schema/constraint của `profiles`
- duplicate `auth_user_id`
- phone customer không hợp lệ
- profile registered nhưng thiếu auth/email
- phone có web order / partner order nhưng chưa có profile customer
- profile placeholder/rỗng dù đã có giao dịch
- profile không liên kết order/partner/loyalty

### 22.6 Đánh Giá Audit Code

Kết luận audit code hiện tại:
- `public.profiles` vẫn là source of truth đúng về mặt bảng.
- Nhưng write path cho customer profile **chưa thật sự single-entry**.
- Domain này đang ở trạng thái: source đúng, đường ghi chưa tinh gọn.

### 22.7 Lộ Trình Đề Xuất

1. Phase 1: audit live `profiles` bằng SQL.
2. Phase 2: chốt contract customer profile write path.
3. Phase 3: gom về một service/RPC customer profile chuẩn.
4. Phase 4: dọn `useAccountViewModel` để không save profile hai lớp chồng nhau.
5. Phase 5: rà partner/web/loyalty hydration về `profiles`.
6. Phase 6: regression account, CRM, loyalty, guest lookup.

### 22.8 Kết Quả Live Audit Hiện Tại

Kết quả live hiện đã thấy:
- `customer_profiles_duplicate_auth_user_id = 0`
- `customer_profiles_invalid_phone = 4`
- `registered_customer_profiles_without_auth_or_email = 5`
- `web_order_phones_30d_missing_customer_profile = 1`
- `partner_order_phones_30d_missing_customer_profile = 307`

Đọc kết quả:
- Customer web đang hydrate vào `profiles` tương đối ổn.
- Customer partner chưa được hydrate đều về `profiles`.
- Bảng `profiles` vẫn đúng vai trò source of truth, nhưng write path và hydration path chưa sạch.

Điểm cần nhớ:
- `partner_orders` đang là source of truth giao dịch đúng cho đơn đối tác.
- Nhưng customer side của partner chưa đi đầy đủ vào `profiles`, nên CRM/account/claim/loyalty vẫn có nguy cơ nhìn lệch nhau.
- Số `0383340888` đang là phone của admin, nên không nên hydrate thành customer profile. Dòng web missing này không phải customer bug thuần, mà là xung đột domain giữa vận hành và customer.

### 22.9 Phase 2 - Deep Audit Trước Khi Refactor Write Path

Mục tiêu Phase 2 của customer profile:
- Phân loại 4 phone lỗi là legacy rác hay đang ảnh hưởng flow thật.
- Phân loại 5 profile `registered = true` nhưng chưa có `auth_user_id/email` là member cũ hay profile bị đẩy cờ sai.
- Đào sâu 307 phone partner có order nhưng chưa có customer profile để chốt chiến lược hydrate đúng.

SQL dùng cho bước này:
- `docs/customer-profiles-source-of-truth-deep-audit.sql`

SQL deep audit sẽ trả lời:
- 4 phone lỗi cụ thể là số nào, có thể normalize về số chuẩn được không.
- 5 profile registered lệch auth/email có đang có order, partner order hoặc loyalty hay không.
- 1 web phone thiếu profile là số nào.
- 307 phone partner thiếu profile đang tập trung ở nguồn nào, chi nhánh nào.
- Trong 307 phone đó, có bao nhiêu số đã có `loyalty_accounts` nhưng vẫn chưa có `profiles`.
- Sample 20 phone partner thiếu profile để review thủ công trước khi chốt rule hydrate.

### 22.10 Contract Đề Xuất Để Đi Đúng Source Of Truth

Sau khi đọc audit, hướng chuẩn nên là:

1. `public.profiles` vẫn là customer master profile table.
2. Mọi phone có giao dịch thật (`orders`, `partner_orders`, `loyalty`) đều nên có customer profile tối thiểu trong `profiles`.
3. Customer profile cần tách rõ 2 trạng thái:
   - `stub profile`: có phone, có thể có tên đơn giản, dùng để nối order/loyalty/CRM.
   - `registered member`: có auth thực hoặc trạng thái member được xác nhận rõ ràng.
4. `registered = true` không nên bị set chỉ vì có giao dịch; cờ này phải phản ánh member/app account thực sự.
5. Partner ingest không nên tự tạo “registered profile”, nhưng nên có đường hydrate chuẩn để tạo `stub profile` cho customer có phone hợp lệ.
6. Việc tạo/sync customer profile nên gom về một entry service/RPC chuẩn, thay vì vừa local upsert, vừa auth sync, vừa ensure stub ở nhiều nơi.

### 22.11 Bước Tiếp Theo An Toàn

Sau khi chạy deep audit, thứ tự an toàn nên là:

1. Chốt rule `stub profile` và `registered member`.
2. Làm Phase 3: service/RPC customer profile write contract.
3. Chuyển `useAccountViewModel` về một đường ghi.
4. Sau đó mới quay lại dọn `Phase 4 - Kitchen Scope`, vì kitchen hiện không phải điểm nghẽn của customer profile.

### 22.12 Phase 3A - Customer Stub Profile RPC

Trạng thái code: đã thêm SQL RPC tại `docs/customer-profile-rpc.sql` và service wrapper tại `src/services/customerProfileService.js`.

Mục tiêu:
- Tạo một cửa ghi chuẩn để hydrate customer profile tối thiểu từ giao dịch thật.
- Không đẩy `registered = true` chỉ vì có order.
- Không hydrate nhầm phone đang thuộc `admin/staff/kitchen` sang customer.

Contract Phase 3A:
- RPC `upsert_customer_stub_profile(phone, name, source, source_ref)`
  - normalize phone về chuẩn `0xxxxxxxxx`
  - nếu phone không hợp lệ: từ chối
  - nếu phone đã thuộc profile vận hành (`admin/staff/kitchen`): từ chối
  - nếu chưa có profile: tạo `stub profile`
  - nếu đã có customer profile: chỉ cập nhật tối thiểu, giữ `registered` hiện tại
- metadata được ghi:
  - `customer_stub = true`
  - `customer_source_first`
  - `customer_source_latest`
  - `customer_source_ref_latest`
  - `customer_stub_last_synced_at`

Rule quan trọng:
- `stub profile` phải có:
  - `phone`
  - `role = customer`
  - `status = active`
  - `registered = false`
- `registered member` vẫn là domain riêng, sẽ đi ở phase sau.
- Nếu tên hiện tại là placeholder như `Khách`, `Khách hàng`, `Khách vãng lai` thì có thể nâng lên bằng tên tốt hơn từ order.

Ý nghĩa cho source of truth:
- Từ đây mình có contract rõ để mọi flow hydrate customer về `profiles` đi cùng một đường.
- `partner_orders` vẫn là source giao dịch.
- `profiles` sẽ dần trở thành source of truth đầy đủ cho customer master.

### 22.13 Phase 3B - Partner Customer Hydration

Trạng thái code: đã nối `partnerOrderService` sang `customerProfileService.upsertCustomerStubProfile`.

Điểm thiết kế an toàn:
- Chỉ hydrate khi app đang đọc `partner_orders` theo **một số điện thoại cụ thể** qua `getPartnerOrdersByPhone`.
- Không hydrate trong feed admin/kitchen/realtime toàn bảng.
- Hydration chạy nền, không chặn UI trả danh sách đơn.
- Có TTL in-memory để tránh spam RPC lặp lại liên tục cho cùng một phone.

Rule thực thi:
- Nếu có partner orders cho phone đó, service sẽ chọn:
  - `phone`: số đã normalize
  - `name`: tên tốt nhất tìm được từ đơn
  - `source`: `grabfood` / `shopeefood` / `xanhngon`
  - `source_ref`: identity của đơn partner mới nhất
- Nếu RPC báo phone này thuộc `admin/staff/kitchen`, hydration sẽ dừng và cache để không spam gọi lại ngay.

Ý nghĩa:
- Customer partner sẽ bắt đầu được kéo dần về `profiles` khi có lookup/account/tracking thực sự.
- Không tạo write storm ở admin list, kitchen list hay realtime stream.
- Đây là bước chuyển tiếp tốt trước khi làm batch/backfill hoặc hydrate chủ động hơn ở phase sau.

### 22.14 Phase 3C - Account Write Path Cleanup

Trạng thái code: đã dọn `useAccountViewModel` để màn lưu hồ sơ account không còn double-write remote.

Điểm đã sửa:
- `handleSaveUser` trước đây đi qua 2 đường remote:
  1. `customerRepository.upsertCustomerByPhone(... writeRemote: true)`
  2. `syncCustomerProfileToSupabase(...)`
- Bây giờ flow được chốt lại:
  1. update local/cache trước để UI phản hồi nhanh
  2. nếu đang dùng Supabase Auth thì chỉ remote write qua `syncCustomerProfileToSupabase`
  3. hydrate lại từ remote để UI bám theo source of truth mới nhất

Ý nghĩa:
- Giảm ghi trùng lên `profiles`
- Giảm rủi ro field bị lệch giữa local write path và auth write path
- Giữ UX save profile nhanh, nhưng source cuối vẫn là dữ liệu đọc lại từ remote

Phạm vi phase này:
- Chưa dọn toàn bộ account/auth flow
- Mới dọn đúng điểm double-write rõ nhất ở profile save
- Register/login hiện vẫn giữ nguyên hành vi để tránh ảnh hưởng phiên đăng nhập, sẽ là phần rà tiếp ở phase sau nếu cần

### 22.15 Phase 3D - Login/Register Write Path Cleanup

Trạng thái code: đã dọn tiếp `login/register` trong `useAccountViewModel`.

Điểm đã sửa:
- Login bằng Supabase Auth:
  - vẫn `loginPhonePasswordAuth`
  - vẫn `syncAuthProfileToCustomerRow`
  - nhưng bỏ bước `userStorage.upsertUser(...)` chồng thêm một lần sau auth sync
  - thay bằng refresh lại user từ remote/source of truth
- Register bằng Supabase Auth:
  - vẫn tạo auth account như cũ
  - vẫn giữ local session flow như cũ để UX không gãy
  - nhưng bỏ bước `userStorage.upsertUser(...)` chồng thêm trước khi sync remote
  - chuyển sang helper chung để sync registered profile rồi refresh lại từ remote

Helper mới trong account flow:
- `refreshCustomerUserFromRemote(phone)`
- `syncRegisteredCustomerProfile({ phone, name, email, avatarUrl, authUserId })`

Ý nghĩa:
- Giảm thêm một lớp local write chồng lên remote profile
- Sau login/register, UI sẽ bám user đọc lại từ source of truth nhiều hơn
- Vẫn giữ session/login experience ổn định, chưa đụng các flow auth nhạy khác ngoài phần write-path

Trạng thái sau Phase 3D:
- `save profile`, `login`, `register` đã sạch hơn đáng kể về write-path
- vẫn còn các write path sâu hơn trong `customerRepository/coreSupabaseRepository` sẽ cần phase tiếp theo nếu muốn siết hoàn toàn về single-entry

### 22.16 Regression + Write-Path Cuối

Trạng thái code:
- Đã gom phần tạo `customer stub` ở tầng `coreSupabaseRepository` về helper chung hơn:
  - `buildCustomerStubProfileRow`
  - `ensureProfileExistsByPhone`
  - `ensureProfilesExistByPhones`
- Address / order / loyalty khi cần tạo profile tối thiểu sẽ đi qua helper chung thay vì mỗi nơi tự upsert một kiểu.

Ý nghĩa:
- Giảm ad-hoc write path ở tầng repository
- Giữ `stub profile` nhất quán hơn về:
  - `role`
  - `status`
  - `registered`
  - `metadata.source`
  - `metadata.customer_stub`

Checklist regression thủ công:
- `docs/customer-profiles-regression-checklist.md`

Khi phase customer profile tạm chốt:
- Guest lookup/tracking partner tạo được stub profile
- Account save/login/register không còn double-write rõ ràng
- Loyalty/address/order khi cần hydrate profile tối thiểu sẽ dùng helper chung

### 22.17 Lộ Trình n8n + RPC Cho Partner Customer

Hướng dài hạn tốt hơn:
- `n8n ingest partner_orders`
- sau đó `n8n` gọi RPC `upsert_customer_stub_profile`
- khong ghi thang `profiles`

Tai lieu rollout/node mau:
- `docs/n8n-partner-customer-profile-hydration.md`

Rule rollout:
1. bat `grabfood + 30/4` truoc
2. test live profile hydration
3. mo rong `grabfood` toan bo
4. mo tiep `shopeefood`
5. mo tiep `xanhngon`
6. sau cung moi tinh backfill/batch cho du lieu cu
