# Cập nhật tích tem và bill POS — 06/10/2026

## Đã thay đổi

- Đơn đối tác có trả tiền và SĐT hợp lệ được tích khi trạng thái xác nhận/đang chuẩn bị/sẵn sàng (`confirmed`, `preparing`, `ready`), không phải chờ giao xong. Đơn mới chưa xác nhận không tích.
- Giữ tối đa một tem/SĐT/ngày, mốc bắt đầu chương trình, quyền nhân viên, khóa chống cộng trùng và xử lý hủy/hoàn tiền. Không sửa điểm thưởng, hạng hoặc quy tắc dùng điểm.
- Không chạy cộng lại toàn bộ đơn cũ. Đơn đang hoạt động được xét khi có cập nhật trạng thái tiếp theo.
- Bill khách có một hàng 10 vòng tròn ngay dưới QR tích điểm và dòng hướng dẫn quét.
- Sửa thiếu tem trên bill khách thứ hai của gói in thanh toán QR (`qr_order_bundle`); phiếu làm món không in tem.
- Bill tự in đọc số tem mới nhất, tránh cache cũ sau khi máy chủ nhận thanh toán. Một lượt đọc cho mỗi bill khách hợp lệ; không gọi cộng tem khi in/in lại. Không thêm polling hoặc realtime.

## Triển khai và kiểm tra

- Supabase `qjaklysckgzdfjthzkzu`: đã áp dụng riêng migration `stamp_partner_confirmation`. Không đẩy các migration khác trong thư mục.
- Kiểm tra live bằng giao dịch thử rồi ROLLBACK: preparing = 1 tem, completed vẫn = 1, cancelled = 0; kiểm tra không còn đơn thử.
- Hàm vẫn SECURITY DEFINER, search_path rỗng, quyền EXECUTE chỉ postgres; không mở thêm quyền bảng/RPC.
- `node scripts/stamp-program.test.mjs`: đạt, gồm giới hạn ngày, hủy/hoàn tiền, đổi quà và phân quyền.
- `node --experimental-vm-modules scripts/stamp-print-station.test.mjs`: đạt, chạy luồng xử lý gói in QR và in lại với bộ thay thế máy in/database.
- Jest: 3 bộ / 12 kiểm tra đạt (posStamps, posPrinterService, posStampReceipt).
- Lint 4 file dịch vụ POS: 0 lỗi, 547 cảnh báo định dạng; không tự sửa định dạng ngoài phạm vi.
- Website: build và kiểm tra encoding đạt. Chưa phát hành website.
- APK: build release thành công (13m58s), `vn.ghr.posmobile`, phiên bản 0.4.13, versionCode 44; chữ ký đúng khóa phát hành hiện tại.
- File: `ghr-pos-mobile-native/releases/GHR-POS-0.4.13.apk`; không ghi đè bản cũ, chưa tải lên trang phát hành.
- SHA-256 APK: `7F9A9CF72700499419697E2F510BAAEB2AC44CF1002085907A6E53ED0F77CACD`.
- SHA-256 chứng thư: `728d5843ae0c8883171fdae3fd65b6375810d27ed946297c5cee3a51b62224ea`.
- Cần thử giấy thật trên POS sau khi cài: bán tiền mặt, thanh toán QR và đơn đối tác có SĐT đầy đủ. Kết quả phần mềm chưa chứng minh giấy in thực tế.

## File cập nhật trong lần sửa này

- `ghr-pos-mobile-native/android/app/build.gradle`
- `ghr-pos-mobile-native/src/services/pos/posPrinterService.js`
- `ghr-pos-mobile-native/src/services/pos/posPrintStationService.js`
- `ghr-pos-mobile-native/src/services/pos/posStampService.js`
- `ghr-pos-mobile-native/__tests__/posStamps.test.js`
- `src/services/printerService.js`
- `src/features/loyalty/components/StampCard.jsx`
- `scripts/stamp-program.test.mjs`

## File mới

- `ghr-pos-mobile-native/src/services/pos/posStampReceipt.js`
- `ghr-pos-mobile-native/__tests__/posStampReceipt.test.js`
- `scripts/stamp-print-station.test.mjs`
- `docs/supabase-sql/stamp-partner-confirmation.sql`
- `supabase/migrations/20261006042354_stamp_partner_confirmation.sql`
- `docs/stamp-confirmation-receipt-2026-10-06.md`
- `tmp/stamp-partner-confirmation-rollback.sql`: bản hàm trước thay đổi để phục hồi nếu cần; không tự chạy vì sẽ quay lại tích khi hoàn tất.

Các thay đổi có sẵn khác trong working tree được giữ nguyên; không commit/push. APK được build từ thư mục POS hiện tại, gồm các cập nhật POS đã có từ những lượt làm trước.
