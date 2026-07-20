# Tích hợp MoMo cho QR Order tại quầy

## Phạm vi

- Khách quét QR của quán, chọn món và chọn `Ví MoMo` tại bước thanh toán.
- Supabase Edge Function tạo giao dịch MoMo theo đúng mã đơn và số tiền.
- MoMo gửi IPN về máy chủ sau khi thanh toán.
- Chỉ IPN có chữ ký hợp lệ, đúng Partner Code và đúng số tiền mới xác nhận đơn.
- Đơn được chuyển sang bếp và tạo lệnh in bill giống luồng SePay.

## Edge Functions

- `qr-payment-session-api`: tạo phiên thanh toán và gọi API MoMo.
- `momo-payment-webhook`: xác minh IPN MoMo và xác nhận đơn đã thanh toán.

Webhook MoMo được khai báo tự động trong request tạo giao dịch:

```txt
https://<project-ref>.supabase.co/functions/v1/momo-payment-webhook
```

Function `momo-payment-webhook` phải được deploy ở chế độ không kiểm tra Supabase JWT vì MoMo gọi từ bên ngoài. Function vẫn tự xác thực chữ ký HMAC-SHA256 của MoMo.

## Secrets cần cấu hình

```txt
MOMO_PARTNER_CODE
MOMO_ACCESS_KEY
MOMO_SECRET_KEY
MOMO_API_ENDPOINT
MOMO_REDIRECT_URL
```

Môi trường TEST:

```txt
MOMO_API_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
```

Môi trường PRODUCTION:

```txt
MOMO_API_ENDPOINT=https://payment.momo.vn/v2/gateway/api/create
```

`MOMO_REDIRECT_URL` là URL HTTPS đưa khách quay lại trang theo dõi đơn của website. Không đặt các khóa MoMo trong `.env` phía frontend, mã nguồn hoặc `VITE_*`.

## Cài đặt

1. Áp dụng migration `supabase/migrations/20260720074037_momo_webhook_logs.sql`.
2. Cấu hình năm secrets bên trên trong Supabase; không đưa khóa vào frontend hoặc Git.
3. Deploy `qr-payment-session-api`.
4. Deploy `momo-payment-webhook` với `verify_jwt = false` / tùy chọn `--no-verify-jwt`.
5. Ưu tiên chạy bằng tài khoản TEST. Nếu tài khoản chưa được MoMo cấp TEST và chủ cửa hàng đồng ý chạy PRODUCTION, kiểm tra bằng một đơn thật giá trị nhỏ trước khi mở cho khách.

## Tiêu chí xác nhận thành công

- `resultCode = 0`.
- Chữ ký IPN hợp lệ.
- `partnerCode` trùng cấu hình.
- `orderId` khớp phiên thanh toán MoMo.
- Số tiền IPN bằng `amount_expected`.
- Giao dịch trùng được xử lý idempotent, không tạo hai bill.

Không dùng `redirectUrl` hoặc giao diện “thành công” phía khách để xác nhận đã nhận tiền.
