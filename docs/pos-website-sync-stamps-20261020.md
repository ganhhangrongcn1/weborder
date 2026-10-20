# Đơn website cập nhật chậm và bill thiếu tem — 20/10/2026

## Bằng chứng và giới hạn

Đối chiếu remote main và bản APK đã build 0.4.27, commit `43873146edc8c8da77382492d59da46d69862ab6`. Main vẫn cũ hơn bản APK; nhánh sửa này kế thừa 0.4.27, không quay lại chế độ phone.

Đơn anh cung cấp: **GHR-3119** (ID `GHR261020184613234`). Lệnh in lưu trên server là phiếu website từ auto-kitchen: tạo 18:46:31, in 18:46:33, còn ghi tem lúc 18:47:50 (giờ Việt Nam). Payload của phiếu ghi paymentStatus=pending, paidAt rỗng và nội dung PHIẾU LÀM MÓN/CHƯA THANH TOÁN. Khách hiện có 7 tem, không giữ tem. Tem đã được ghi nhận; phiếu in trước thanh toán không thể có tem của thanh toán xảy ra sau đó. Lệnh in cục bộ trực tiếp không được lưu vào print_jobs, nên dữ liệu này không chứng minh tuyệt đối rằng không có bill in cục bộ sau thanh toán.

Hàm stamp_private.order_before_write đang chạy trên production đã hỗ trợ paymentStatus=paid cho website, khác với migration cũ trong repo. Không thay quy tắc cộng tem hoặc sửa số tem khách trong tác vụ này.

## Bản sửa

- Tách website order sync khỏi lượt tải pager/history/payment sessions. Realtime/reconnect và quay lại foreground kích hoạt tải riêng; polling dự phòng mỗi 5 giây khi foreground. Giữ một lượt tải tiếp nếu sự kiện đến trong lúc đang đọc, giữ danh sách khi lỗi và bỏ kết quả từ chi nhánh cũ.
- Khi một đơn web online/website/web chuyển sang paid bằng bank_qr/momo sau khi đã có phiếu chuẩn bị chưa thanh toán, queue đúng một bill khách sau thanh toán bằng UUID ổn định theo order ID.
- Snapshot số tem đã xác nhận trong cùng transaction với lệnh in; không cộng tem lúc in hoặc in lại. Bill khách dựng từ snapshot không cần gọi RPC để lấy lại số tem.
- Giữ phiếu làm món; không in lại bundle của webhook nếu bill khách theo sau đã có. Chỉ tách riêng ràng buộc chống trùng cho loại website_paid_receipt, vẫn giữ chống trùng cũ cho các lệnh khác. Có index riêng bảo đảm mỗi đơn chỉ có một website_paid_receipt.
- POS kiểm tra bill đã được queue để không in thêm bill cục bộ cho cùng lần xác nhận QR.
- Chuẩn bị Android **0.4.28**, code **59**, dùng workflow và khóa ký Cloud hiện có.

## Kiểm tra

23 test trong 6 suite native đã qua, gồm đồng bộ độc lập, sự kiện đến khi đang đọc, giữ danh sách khi offline, đổi chi nhánh, tem, QR chưa trả tiền, mode thu ngân và bill dựng từ snapshot 7 tem. Kiểm tra website queue phân trang, cú pháp và encoding cũng qua.

Regression SQL được chạy bằng PostgreSQL nhúng PGlite trong database riêng, dùng fixture giả. Đã kiểm tra snapshot sau thanh toán, một bill theo sau, giữ phiếu chuẩn bị, chặn bundle trùng, in lại có tem và số dư tem không đổi. Chưa chạy thành công toàn bộ migration trên production: lần dry-run đầu gặp unique index hiện hữu; sau khi bổ sung phân biệt loại phiếu, auto-review chặn DDL production vì rủi ro lock. Không lách chặn bằng CLI hoặc API khác.

Chạy lại SQL test mà không truy cập production:

```bash
npm install --prefix /tmp/pos-pg-test @electric-sql/pglite --no-audit --no-fund
node scripts/test-paid-website-receipts.mjs /tmp/pos-pg-test/node_modules/@electric-sql/pglite/dist/index.js
npm --prefix ghr-pos-mobile-native test -- --runInBand __tests__/posWebsiteOrderSync.test.js __tests__/posPhonePrintBundle.test.js __tests__/posStamps.test.js __tests__/posStampReceipt.test.js __tests__/posPendingQrStampRead.test.js __tests__/posDeviceMode.test.js
```

## Triển khai còn chờ

Cần anh chấp thuận thay đổi trigger và chỉ mục trên database thật sau khi xem bản sửa. Migration ở `supabase/migrations/20261020120041_paid_website_receipt_stamps.sql` và bản sao ở `docs/supabase-sql/20261020_paid_website_receipt_stamps.sql`. Tác động là thay chỉ mục chống trùng loại bill, thêm trigger lệnh in sau xác nhận trả tiền và snapshot; có thể khóa ngắn bảng print_jobs khi dựng lại index. Không xóa đơn, không backfill/reprint đơn cũ và không thay RLS.

Sau khi được phép: áp dụng migration, xác minh trigger/ACL/index và kiểm tra rollback có kiểm soát; cập nhật POS_RELEASE_APPROVED_SHA đúng commit bản sửa, dispatch GitHub Actions, tải APK, xác minh chữ ký/hash và giao file. Chưa có APK 0.4.28, chưa bật thay đổi production. Không tự in lại GHR-3119.

## Tệp của tác vụ
- `.github/workflows/pos-android-release.yml`
- `ghr-pos-mobile-native/__tests__/posPhonePrintBundle.test.js`
- `ghr-pos-mobile-native/android/app/build.gradle`
- `ghr-pos-mobile-native/src/features/pos/hooks/usePosComposer.js`
- `ghr-pos-mobile-native/src/services/pos/posPickupOrderService.js`
- `ghr-pos-mobile-native/src/services/pos/posPrintStationService.js`
- `docs/pos-website-sync-stamps-20261020.md`
- `docs/supabase-sql/20261020_paid_website_receipt_stamps.sql`
- `docs/supabase-sql/20261020_paid_website_receipt_stamps_test.sql`
- `ghr-pos-mobile-native/__tests__/posWebsiteOrderSync.test.js`
- `ghr-pos-mobile-native/src/features/pos/hooks/usePosWebsiteOrderSync.js`
- `ghr-pos-mobile-native/src/services/pos/posWebsiteReceiptService.js`
- `scripts/fixtures/`
- `scripts/test-paid-website-receipts.mjs`
- `supabase/migrations/20261020120041_paid_website_receipt_stamps.sql`
