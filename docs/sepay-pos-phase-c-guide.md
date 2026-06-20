# Phase C SePay POS

## Mục tiêu

- Khách chuyển khoản QR xong
- SePay gọi webhook về Supabase
- Đơn POS tự xác nhận đã thanh toán
- Đơn tự hiện xuống bếp
- POS tự nhận lệnh và in bill

## File đã có sẵn trong project

- `supabase/functions/sepay-pos-webhook/index.ts`
- `docs/supabase-sql/sepay-pos-webhook-log.sql`

## 1. Chạy SQL log webhook

Mở Supabase SQL Editor và chạy file:

- `docs/supabase-sql/sepay-pos-webhook-log.sql`

## 2. Deploy Edge Function

Tên function:

- `sepay-pos-webhook`

Deploy bằng Supabase CLI hoặc dashboard function deploy.

## 3. Set env cho function

Cần cấu hình các biến:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SEPAY_WEBHOOK_SECRET`

`SEPAY_WEBHOOK_SECRET` là chuỗi tự đặt để chống gọi webhook lạ.

Ví dụ:

- `ghr-sepay-pos-2026`

## 4. Cấu hình webhook trên SePay

Webhook URL dạng:

```txt
https://<project-ref>.supabase.co/functions/v1/sepay-pos-webhook?secret=<SEPAY_WEBHOOK_SECRET>
```

Ví dụ:

```txt
https://abcxyz.supabase.co/functions/v1/sepay-pos-webhook?secret=ghr-sepay-pos-2026
```

## 5. Cấu hình chi nhánh trong admin

Trong admin -> Chi nhánh:

- Chọn `Kiểu QR POS` = `SePay tự động`
- Chọn đúng `Ngân hàng`
- Điền `Số tài khoản`
- Điền `Tên chủ tài khoản`
- Điền `SePay Bank Account ID`
- Điền `Mã cửa hàng SePay`

Sau đó bấm `Lưu thay đổi`.

## 6. Luồng chạy thực tế

1. POS tạo đơn QR ở trạng thái chờ thanh toán
2. Đơn chưa hiện xuống bếp
3. Khách chuyển khoản đúng số tiền
4. SePay gọi webhook
5. Webhook tìm đơn theo `payment_reference` / `order_code`
6. Nếu số tiền khớp:
   - `payment_status = paid`
   - `status = pending_zalo`
   - `kitchen_status = pending`
7. Webhook tạo `print_jobs`
8. Máy POS cùng chi nhánh tự đọc `print_jobs` và in bill

## 7. Điều kiện để auto in hoạt động

POS phải mở tại đúng chi nhánh cần in và đang đăng nhập.

Để auto in ổn định nhất:

- Android app bridge
hoặc
- print bridge nội bộ

Nếu chỉ dùng trình duyệt thường, popup in có thể bị browser chặn.

## 8. Cách test nhanh

1. Vào POS
2. Chọn món
3. Chọn thanh toán QR
4. Tạo đơn chờ thanh toán
5. Chuyển khoản đúng số tiền, đúng nội dung mã đơn
6. Kiểm tra:
   - POS tự reset bill
   - Bếp thấy đơn mới
   - Bill được tạo lệnh in

## 9. Nếu chưa chạy

Kiểm tra theo thứ tự:

- Chi nhánh đã lưu `SePay Bank Account ID`
- Chi nhánh đã lưu `Mã cửa hàng SePay`
- Function đã deploy
- `SEPAY_WEBHOOK_SECRET` đúng
- Webhook URL trên SePay đúng
- Nội dung chuyển khoản có mã đơn
- Số tiền chuyển đúng bằng tổng bill
