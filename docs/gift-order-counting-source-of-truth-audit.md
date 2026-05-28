# Gift / Quà Tháng / Đơn Thứ 3 Audit

Mục tiêu:
- Chốt đúng source of truth cho:
  - tổng đơn khách
  - tổng chi tiêu
  - lần mua thứ mấy trong tháng
  - đủ điều kiện quà tháng hay chưa
  - đã tặng quà tháng hay chưa
- Không để kitchen, tracking, CRM, loyalty tự đếm mỗi nơi một kiểu.

## 1. Source Of Truth Chốt

### 1.1 Giao dịch gốc
- Master:
  - `public.orders`
  - `public.partner_orders`
- Dùng để tính:
  - `totalOrders`
  - `totalSpent`
  - `monthlyOrderCount`
  - `đơn thứ 3 trong tháng`
- Không dùng:
  - `profiles.total_orders`
  - `profiles.total_spent`
  - `monthly_customer_gifts`
  để suy ngược giao dịch gốc.

### 1.2 Trạng thái đã tặng quà
- Master:
  - `public.monthly_customer_gifts`
- Dùng để trả lời:
  - khách đã được tặng quà tháng này chưa
  - claim bởi ai
  - claim ở đơn nào
  - claim lúc nào

### 1.3 Identity khách cho quà tháng
- Ưu tiên:
  - `phone`
- Tạm thời fallback:
  - `external_id`
  - `name`
- Nhưng lâu dài nên ưu tiên chỉ dùng identity ổn định:
  - `phone`
  - hoặc `profile_id` / contract identity chuẩn hơn

## 2. Những File Đang Liên Quan

### 2.1 Kitchen quà tháng
- `src/services/kitchenCustomerRewardService.js`
- `src/hooks/useKitchenOrders.js`
- `src/features/kitchen/KitchenOrderCard.jsx`

### 2.2 Tracking / account summary
- `src/services/orderSummaryService.js`
- `src/features/orders/TrackingView.jsx`

### 2.3 CRM / tổng khách
- `src/services/crmService.js`

### 2.4 SQL schema quà tháng
- `docs/monthly-customer-gifts.sql`

## 3. Audit Hiện Tại

### 3.1 Kitchen reward đang làm đúng phần nào

`src/services/kitchenCustomerRewardService.js`

Đang đúng:
- Đọc cả:
  - `orders`
  - `partner_orders`
- Loại khỏi điều kiện tính quà các đơn:
  - `cancelled`
  - `refunded`
  - `preorder`
  - `scheduled`
- Trạng thái "đã tặng" lấy từ:
  - `monthly_customer_gifts`
- Claim quà có chống trùng bằng unique:
  - `customer_key + reward_month + gift_code`

Đánh giá:
- Hướng hiện tại là đúng source of truth hơn trước.

### 3.2 Điểm chưa sạch trong kitchen reward

`src/services/kitchenCustomerRewardService.js`

Rủi ro 1:
- `resolveKitchenCustomerIdentity()` đang fallback từ:
  - `phone`
  - sang `external_id`
  - rồi sang `name`
- Fallback theo `name` có thể gây:
  - gộp nhầm 2 khách trùng tên
  - tách sai 1 khách nếu tên thay đổi

Kết luận:
- `name` chỉ nên là fallback tạm.
- Lâu dài không nên để `quà tháng` phụ thuộc vào `name-*`.

Rủi ro 2:
- `buildMonthlyGiftInfo()` đang lấy `totalOrderCount` / `totalSpent` từ:
  - `profiles.total_orders`
  - `profiles.total_spent`
  nếu profile có snapshot
- Nếu snapshot profile chậm hoặc lệch, badge tier / tổng đơn lifetime có thể lệch với giao dịch thật.

Kết luận:
- `monthlyOrderCount` hiện đang bám giao dịch thật là ổn.
- Nhưng `totalOrderCount` và `totalSpent` lifetime vẫn còn phụ thuộc snapshot profile ở một số case.

Rủi ro 3:
- `selectGiftEnrichmentOrders()` chỉ enrich tối đa `30` đơn đang nhìn thấy trên kitchen board.
- Đây không sai cho UI hiện tại, nhưng nghĩa là:
  - đây là logic hiển thị kitchen
  - chưa phải service aggregate chuẩn toàn hệ thống

### 3.3 Tracking summary đang làm đúng phần nào

`src/services/orderSummaryService.js`

Đang đúng:
- Đọc cả:
  - `orders`
  - `partner_orders`
- Loại khỏi summary các đơn:
  - `cancelled`
  - `refunded`
  - `preorder`
  - `scheduled`
- Tách `claimedPoints` / `pendingPoints` từ:
  - `loyalty_ledger`
  - `partner_orders.point_status`

Đánh giá:
- Hướng tổng đơn / tổng chi tiêu / pending points là hợp lý.

### 3.4 Điểm chưa sạch trong tracking summary

Rủi ro 1:
- Web order đang query:
  - `orders.customer_phone = phoneKey`
- Nếu live data web có số điện thoại không normalize hoàn toàn, summary có thể thiếu đơn web cũ.

Rủi ro 2:
- Logic summary hiện là service riêng cho tracking.
- Nếu CRM hoặc kitchen cần tổng đơn/tổng chi tiêu mà tự đếm kiểu khác, sẽ lệch dần.

Kết luận:
- Cần gom về một contract aggregate thống nhất hơn.

### 3.5 CRM hiện còn là vùng cần siết tiếp

`src/services/crmService.js`

Đang thấy:
- CRM build customer snapshot bằng cách group order list đọc vào.
- Có pha trộn giữa:
  - orders đã load
  - partner orders đã load
  - registered user snapshot
  - loyalty snapshot

Rủi ro:
- `totalOrders`, `totalSpent`, `tier`, `lastOrderAt`
  có thể bị lấy theo nhiều lớp dữ liệu khác nhau.

Kết luận:
- CRM chưa nên là phase sửa đầu tiên.
- Nhưng cần được đưa vào phase regression sau khi chốt aggregate chuẩn.

## 4. Chẩn Đoán Kiến Trúc

Hiện tại hệ thống đã đi đúng hướng:
- `monthly_customer_gifts` là master cho trạng thái claim quà
- `orders + partner_orders` là master cho transaction count

Nhưng vẫn còn thiếu một lớp aggregate chuẩn dùng chung.

Hiện giờ:
- kitchen tự count monthly reward qua `kitchenCustomerRewardService`
- tracking tự count summary qua `orderSummaryService`
- CRM có logic build snapshot riêng

Nghĩa là:
- source of truth domain đã gần đúng
- nhưng execution layer vẫn đang phân tán

## 5. Phase Đề Xuất

### Phase 1 - Audit Lock
Mục tiêu:
- Chốt contract domain trước khi sửa code.

Việc làm:
- Ghi rõ:
  - transaction master = `orders + partner_orders`
  - monthly gift claim master = `monthly_customer_gifts`
  - profile snapshot không phải nguồn cuối cho order counting
- Ghi rõ rule loại đơn:
  - `cancelled`
  - `refunded`
  - `preorder`
  - `scheduled`

Trạng thái:
- Làm xong ở phase này.

### Phase 2 - Shared Counting Contract
Mục tiêu:
- Tách một contract dùng chung cho:
  - `monthlyOrderCount`
  - `totalOrders`
  - `totalSpent`
  - `eligibleForMonthlyGift`

Việc làm:
- Tạo helper/service chung cho order counting.
- Kitchen reward và tracking summary cùng dùng contract này.

Không làm ở phase này:
- chưa đụng sâu CRM
- chưa tạo RPC aggregate ngay nếu chưa cần

Trạng thái:
- Đã làm xong.

Kết quả chốt:
- Có `src/services/customerOrderCountingService.js` làm contract dùng chung.
- `orderSummaryService` đã dùng chung rule count/exclude/points base.
- `kitchenCustomerRewardService` đã dùng chung rule loại đơn và map count/lifetime stats.
- Các rule loại đơn hiện đã thống nhất giữa kitchen reward và tracking summary:
  - `cancelled`
  - `refunded`
  - `preorder`
  - `scheduled`

### Phase 3 - Kitchen Reward Refactor
Mục tiêu:
- Đưa `kitchenCustomerRewardService` về đúng shared counting contract.

Việc làm:
- giữ `monthly_customer_gifts` làm master claim
- bỏ bớt suy diễn lifetime stats từ profile snapshot khi không cần
- siết fallback identity để giảm phụ thuộc `name-*`

Trạng thái:
- Đã làm xong.

Kết quả chốt:
- `kitchenCustomerRewardService` không còn fallback identity theo `name-*`.
- Identity quà tháng trong kitchen hiện ưu tiên:
  - `phone`
  - rồi `external_id`
- Lifetime stats cho kitchen reward không còn lấy `profiles.total_orders` / `profiles.total_spent` làm nguồn chính.
- `totalOrderCount`, `totalSpent`, `memberTier` trong kitchen reward hiện ưu tiên build từ transaction thật qua shared counting contract.

### Phase 4 - Tracking Summary Refactor
Mục tiêu:
- Đưa `orderSummaryService` dùng cùng contract với kitchen reward.

Trạng thái:
- Đã làm xong.

Kết quả chốt:
- `orderSummaryService` dùng chung shared counting contract với kitchen reward.
- Tracking summary đã dùng phone variants chung để đỡ sót:
  - web orders
  - partner orders
  - loyalty ledger
- Tracking summary không còn phụ thuộc vào một kiểu format phone duy nhất khi đếm đơn/tổng chi tiêu/điểm.

Việc làm:
- tổng đơn
- tổng chi tiêu
- pending/claimed points
- logic loại đơn thống nhất với kitchen reward

### Phase 5 - CRM Regression / Alignment
Mục tiêu:
- kiểm tra CRM sau khi counting contract mới ổn.

Việc làm:
- audit `crmService`
- xác nhận:
  - total orders
  - total spent
  - tier
  - repeat customer
  không lệch với aggregate chuẩn

Trạng thái:
- Đã làm xong.

Kết quả chốt:
- CRM snapshot đã dùng cùng rule loại đơn với kitchen/tracking.
- `totalOrders` và `totalSpent` trong CRM ưu tiên build từ transaction thật trong `orders + partner_orders`.
- CRM không còn bỏ sót khách chỉ vì chưa có `registeredUsers`; danh sách phone giờ union giữa:
  - customer có giao dịch
  - customer đã đăng ký
- `tier` trong CRM được tính từ `totalSpent` thay vì lấy snapshot rank để đè lên transaction truth.

### Phase 6 - Optional RPC / Aggregate Hardening
Mục tiêu:
- nếu cần scale hoặc muốn giảm query runtime, mới chuyển tiếp sang RPC / materialized aggregate.

Chỉ làm khi:
- Phase 2-5 đã ổn
- business rule đã chốt

Trạng thái:
- Đã làm xong theo hướng an toàn.

Kết quả chốt:
- Thêm SQL aggregate tại `docs/customer-order-counting-rpc.sql`
- Thêm runtime adapter `src/services/customerOrderCountingRpcService.js`
- `orderSummaryService` sẽ ưu tiên RPC `get_customer_order_count_summary(...)`
- `kitchenCustomerRewardService` sẽ ưu tiên RPC `get_monthly_customer_gift_stats_by_phones(...)`
- Nếu Supabase chưa deploy RPC mới, app tự fallback về service-layer counting hiện tại nên không làm gãy live

## 6. Thứ Tự Mình Khuyên Làm

1. Phase 1: lock audit và contract
2. Phase 2: shared counting contract
3. Phase 3: kitchen reward
4. Phase 4: tracking summary
5. Phase 5: CRM regression
6. Phase 6: cân nhắc RPC aggregate nếu thật sự cần

## 7. Kết Luận

Bước hợp lý nhất tiếp theo là:
- không sửa CRM trước
- không tạo RPC aggregate lớn ngay
- mà chốt shared counting contract trước

Đó là đường logic nhất vì:
- business đang cần đếm đúng
- transaction + partner profile đã bắt đầu chuẩn
- kitchen và tracking đang là 2 nơi quan trọng nhất cần dùng cùng một luật đếm
