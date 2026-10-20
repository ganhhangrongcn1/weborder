# Kiểm thử nhận đơn POS — 20/10/2026

## Kết quả chính

Đã kiểm tra mã ứng dụng khớp APK 0.4.28 (commit build `8f77adbc131b63424adfd168778d8295fb63d9cf`; commit `01986f02d8e2fd2c1193211b6f0e3518f287941e` chỉ sửa tài liệu/tên migration). Toàn bộ suite có sẵn: **139 test, 32 suite qua**, không có test bỏ qua.

Bổ sung một test bắt request không bao giờ trả lời: **thất bại trên 0.4.28**. Khi đó `running` luôn giữ Promise chưa hoàn tất; polling và realtime chỉ ghi pending rồi tiếp tục chờ cùng Promise. Danh sách có thể rỗng mãi, loading không kết thúc và không báo lỗi. Đây là một lỗi có thể gây triệu chứng chỉ một máy không nhận đơn; chưa có log của máy quán để chứng minh đó là nguyên nhân cụ thể tại thiết bị.

## Bản vá sau kiểm thử

Lượt đọc website có deadline 10 giây; hết hạn sẽ hiện lỗi, abort request và cho lượt đã chờ chạy tiếp. Signal được truyền qua toàn bộ các trang đọc Supabase. Logout/đổi chi nhánh cũng hủy lượt đang chạy; kết quả cũ không được ghi đè lên danh sách mới. Deadline vẫn giải phóng lượt đọc khi lớp mạng không trả kết quả sau abort.

Bản vá đã được chuẩn bị cho **0.4.29/code 60**. **Chưa build APK 0.4.29; APK 0.4.28 đã giao không có bản vá deadline này.** Không thay database hoặc gửi lệnh in vào quán trong lượt kiểm thử này.

Workflow release được cập nhật để chạy toàn bộ suite native, không chỉ danh sách test chọn sẵn.

Sau vá: **148 test, 34 suite qua**, 0 test lỗi/bỏ qua. ESLint phần thay đổi, encoding và diff checks qua. Test phân trang website và refresh queue Kitchen qua. Kiểm thử pipeline in tem bằng dữ liệu giả và regression PostgreSQL/PGlite qua.

## Các tình huống đã kiểm thử

- Polling foreground 5 giây và không poll trong background.
- Mở lại app từ background tải ngay, không đợi polling.
- Sự kiện đến trong lúc đọc được giữ lại; burst sự kiện không làm trì hoãn vô hạn.
- Kết nối/rejoin realtime yêu cầu snapshot mới, lọc đúng chi nhánh, bỏ sự kiện bán tại quầy thông thường.
- Giữ danh sách khi lỗi mạng; xóa lỗi khi đọc lại thành công.
- Request treo bị dừng, có lỗi rõ và phục hồi được; kết quả đến muộn không ghi đè.
- Hai instance dùng cùng user/branch: một instance treo, instance kia vẫn thấy đơn; instance treo tải lại được sau deadline.
- Logout hủy request, xóa danh sách và dọn subscription/timer; đổi chi nhánh không nhận kết quả của chi nhánh cũ.
- Signal hủy được truyền qua mỗi trang truy vấn.
- Đơn hẹn tương lai không xuất hiện ở “Cần làm ngay” nhưng có trong “Tất cả”, đúng bộ lọc hiện tại.
- Bill sau chuyển khoản và bill in lại có tem, phiếu làm món không nhận tem, không gọi cộng tem lúc in.
- SQL snapshot/queue một bill sau thanh toán, không tạo bundle trùng và không tăng số dư do in.

## Giới hạn

Đây là kiểm thử tự động với React Native renderer, adapter giả, và PostgreSQL nhúng. Chưa chạy APK bằng máy POS/máy in thật; chưa đo độ trễ WebSocket/mạng quán hoặc kiểm tra session/timezone thực tế trên máy đó. Vì vậy không kết luận mọi lỗi nhận đơn tại quán đã được khắc phục.

## Chạy lại

```bash
npm --prefix ghr-pos-mobile-native test -- --runInBand
node --test scripts/kitchen-refresh-queue.test.mjs scripts/pos-website-queue.test.mjs
node --experimental-vm-modules scripts/stamp-print-station.test.mjs
node scripts/test-paid-website-receipts.mjs /tmp/pos-pg-test/node_modules/@electric-sql/pglite/dist/index.js
```

Lệnh cuối cần cài `@electric-sql/pglite` vào thư mục tạm trước; không kết nối production. Chi tiết setup ở `docs/pos-website-sync-stamps-20261020.md`.
