# Data Source Of Truth

Ghi chú nội bộ để khóa lại "nguồn sự thật" của hệ thống hiện tại.

Mục tiêu:
- Giảm tình trạng mỗi màn tự suy dữ liệu theo cách khác nhau.
- Có chung một quy ước trước khi refactor.
- Khi sửa app, n8n, Supabase, mọi người cùng bám theo một chuẩn.

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
