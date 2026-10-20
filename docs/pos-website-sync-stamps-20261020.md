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

Regression SQL được chạy bằng PostgreSQL nhúng PGlite trong database riêng, dùng fixture giả, rồi chạy lại trên production trong giao dịch hoàn tác sau khi anh cho phép triển khai. Đã kiểm tra snapshot sau thanh toán, một bill theo sau, giữ phiếu chuẩn bị, chặn bundle trùng, in lại có tem và số dư tem không đổi. Không có đơn/lệnh in thử được commit hoặc gửi tới máy in. Quyền gọi trực tiếp hai hàm private bị thu hồi đối với anon/authenticated; hai trigger đang bật.

Chạy lại SQL test mà không truy cập production:

```bash
npm install --prefix /tmp/pos-pg-test @electric-sql/pglite --no-audit --no-fund
node scripts/test-paid-website-receipts.mjs /tmp/pos-pg-test/node_modules/@electric-sql/pglite/dist/index.js
npm --prefix ghr-pos-mobile-native test -- --runInBand __tests__/posWebsiteOrderSync.test.js __tests__/posPhonePrintBundle.test.js __tests__/posStamps.test.js __tests__/posStampReceipt.test.js __tests__/posPendingQrStampRead.test.js __tests__/posDeviceMode.test.js
```

## Trạng thái triển khai ngày 20/10/2026

Anh đã cho phép triển khai database của #10. Migration `paid_website_receipt_stamps` đã áp dụng thành công lên production với version `20261020122126`; tên file migration được đồng bộ với version thực tế do công cụ Supabase tạo. Có giới hạn chờ lock 3 giây và thời gian chạy câu lệnh 30 giây.

Kiểm thử transaction rollback trên production đã qua: tạo một bill khách sau thanh toán kèm snapshot 7 tem, không thêm bill khi cập nhật lại đơn đã paid, chặn bundle webhook trùng, in lại có tem và không thay số dư. Sau rollback còn 0 đơn/lệnh in thử. Hai trigger được bật; anon/authenticated không có quyền gọi trực tiếp hàm private. Đối chiếu lại GHR-3119 vẫn có 7 tem, held=0, source active. Không in lại đơn cũ.

Build Cloud **0.4.28 đã thành công**, chạy từ commit `8f77adbc131b63424adfd168778d8295fb63d9cf`: https://github.com/ganhhangrongcn1/weborder/actions/runs/39421755320 . Commit tài liệu/đồng bộ tên migration sau đó không thay nội dung APK đã build. Chưa merge các thay đổi ứng dụng vào main, không deploy website/Kitchen trong tác vụ này.

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
- `supabase/migrations/20261020122126_paid_website_receipt_stamps.sql`

## APK đã giao

- Artifact `GHR-POS-0.4.28-release`, ID `12264476573`; phiên bản 0.4.28, code 59.
- Đã xác minh package/version và chữ ký release cũ trong workflow, checksum file tải về khớp.
- SHA-256: `7129e98366e7c3dc28a307b40e4e40f9601a40d654b3cbcdc5af18d1f120d24c`.
- File trong workspace: `/workspace/releases/GHR-POS-0.4.28/GHR-POS-0.4.28.apk`.
- Cài cập nhật đè; vẫn cần kiểm tra bill thực tế của một đơn website mới sau thanh toán. Lỗi máy quán riêng không hiện đơn chưa được xác minh dứt điểm tại thiết bị.
