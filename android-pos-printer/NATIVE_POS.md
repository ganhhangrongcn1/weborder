# GHR Native POS

Mục tiêu của APK này là chạy POS Android native, không dùng WebView.

## Hướng đi

- App native tự đăng nhập tài khoản chi nhánh qua Supabase Auth.
- App lấy `branch_uuid` từ `profiles` và chỉ xử lý dữ liệu của chi nhánh đó.
- App kết nối máy in trực tiếp qua USB hoặc LAN/WiFi.
- App có foreground service để nhận lệnh in nền từ `print_jobs`.
- Web POS hiện tại chỉ là fallback, không phải runtime chính của APK native.

## Build Config

Mặc định app có sẵn cấu hình Supabase để build nhanh. Khi cần đổi môi trường, truyền biến bằng Gradle property hoặc environment variable:

```txt
GHR_SUPABASE_URL
GHR_SUPABASE_ANON_KEY
GHR_LOYALTY_QR_URL
```

Ví dụ build bằng Gradle property:

```txt
gradlew.bat assembleDebug -PGHR_SUPABASE_URL=https://your-project.supabase.co -PGHR_SUPABASE_ANON_KEY=your_publishable_key
```

## Phase An Toàn

1. Native shell: đăng nhập, chi nhánh, trạng thái ca, trạng thái máy in.
2. Printer engine: USB/LAN, in test, bill raster tiếng Việt.
3. Background print engine: Realtime `print_jobs`, claim job, cập nhật `printed`/`failed`.
4. POS MVP: menu cache, giỏ hàng, tiền mặt, tạo order, in local.
5. QR/SePay: phiên QR, Realtime paid, in bill.
6. Ca POS: mở ca, kết ca, cơ cấu tiền mặt, phiếu kết ca.

## Nguyên Tắc Request Supabase

- Bán tại chính máy POS: tạo order rồi in local, không tạo `print_jobs`.
- Chỉ dùng `print_jobs` cho lệnh in từ thiết bị khác hoặc webhook.
- Realtime là chính; polling chỉ là backup nhẹ hoặc thao tác thủ công.
- Sau này nên dùng RPC claim job để gộp đọc và claim thành một request.
