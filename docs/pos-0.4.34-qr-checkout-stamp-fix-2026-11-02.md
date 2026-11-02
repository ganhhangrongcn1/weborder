# POS 0.4.34 — tạo QR và đổi 10 tem

## Nguyên nhân đã xác minh

- SePay và Pay2S trên cashier dùng cùng luồng: kiểm tra loyalty nếu có sử dụng điểm/voucher → tạo phiên → hydrate hồ sơ → lưu đơn → thay danh sách món → gắn đơn vào phiên → hiển thị QR. Phần kiểm tra loyalty không gọi mạng khi không dùng điểm/voucher loyalty.
- Hai yêu cầu tạo phiên lúc thử 30/4 mất 2.781 ms và 949 ms trong Edge Function, chưa gồm các lần gọi còn lại và mạng thiết bị. Chưa đo được tổng thời gian từ bấm nút đến ảnh xuất hiện trên máy.
- Log Postgres ghi lỗi `null value in column "branch_address" of relation "orders" violates not-null constraint` nhiều lần, trong đó có 18:16–18:17 ngày 02/11 (giờ Việt Nam). RPC `checkout_stamp_order` dùng `jsonb_populate_record(null::orders, ...)` rồi insert rõ địa chỉ null, nên default của bảng không được áp dụng. POS xác nhận tiền 0đ ở client trước; bước hoàn thành mới gọi RPC và thất bại.

## Thay đổi

- POS chuẩn bị payload đơn bằng cùng bộ chuẩn hóa hiện có, không gọi mạng ở bước chuẩn bị. QR ngân hàng không có món đổi tem dùng action `create_checkout` mới: một lần gọi Edge thay chuỗi gọi từ máy.
- Edge vẫn dùng kiểm tra Auth, ca/chi nhánh, thẻ rung và routing hiện có; không gọi Pay2S/MB để tạo QR. Sau khi tạo/reuse phiên, dùng token nhân viên gọi RPC lưu đơn/món/attach trong một transaction. Chỉ trả QR khi RPC thành công. Tạo phiên là transaction trước đó; không tuyên bố toàn bộ tạo phiên + lưu đơn là một transaction duy nhất.
- Public RPC là SECURITY INVOKER; helper SECURITY DEFINER nằm trong schema riêng, kiểm tra auth.uid(), vai trò hoạt động, chi nhánh, ca, phiên/tiền/khách/thẻ/mã yêu cầu, tổng món và retry fingerprint. Cần helper vì phiên không có UPDATE grant cho client; giữ nguyên việc không cấp UPDATE bảng cho authenticated, không nới RLS.
- Khóa theo phiên và theo thẻ rung, không tạo hai đơn hoạt động cùng thẻ; retry cùng payload không ghi lại món, retry khác payload bị từ chối. Lỗi lưu SQL rollback cả đơn/món/attach; phản hồi mạng không rõ kết quả không tự hủy phiên có thể đã commit.
- Ghi thời gian tạo phiên/lưu checkout vào log server, không ghi nội dung giỏ/điện thoại/token. Client chặn QR nếu response chưa gắn đúng đơn.
- Server đánh dấu phiên checkout mới và ẩn khỏi đọc/danh sách phục hồi khi chưa lưu/attach xong, tránh mở QR từ phiên dở dang sau lỗi mạng. Phiên legacy không bị ẩn.
- MoMo, pickup/đơn từ điện thoại và QR có quà tem cùng món trả tiền giữ luồng cũ. Đơn quà 0đ vẫn xác nhận tại quầy qua `checkout_stamp_order`.
- RPC đổi tem bổ sung default cho text tùy chọn, giữ nguyên kiểm tra khách, sản phẩm, quyền, giữ/trừ/hoàn tem. POS mới cũng truyền địa chỉ không null. Bản POS hiện tại hưởng sửa server mà không cần cài APK mới cho riêng lỗi null này.
- Không đổi cấu hình Pay2S/SePay của chi nhánh và chưa cập nhật APK chung. 30/4 vẫn chỉ thử riêng Pay2S.

## Kiểm tra và triển khai

- 19 Node tests đạt: thêm checkout mới, dữ liệu sai, chờ lưu/attach, lỗi/retry, đọc/phục hồi không lộ QR dở dang; giữ hồi quy Pay2S/SePay/QR website/POS.
- 3 Jest suites / 18 tests đạt: `posCombinedQrCheckout`, `posPendingQrStampRead`, `posPaymentRecovery`. Giới hạn Jest roots vào `__tests__` để tránh quét build/APK; các lần chạy trước bị dừng và không dùng làm bằng chứng đạt.
- Typecheck Edge/shared, lint ba source native thay đổi và UTF-8 đạt.
- Web Vite build đạt (5.319 modules). Đã tạo bundle production bằng Node 22 portable + Metro CLI hiện có và biên dịch Hermes; không thay cấu hình Metro/Node hệ thống. Bytecode SHA-256 `6776264f0f836f22bd96dc99fd58af9f9428905222b09754a20d725f7751dec8`. Gradle/signing/kiểm tra APK là bước riêng bên dưới.
- SQL chạy BEGIN/ROLLBACK trên Supabase đạt cả trước và sau triển khai; gọi thật với role authenticated, test đổi tem 0đ không địa chỉ, trừ đúng một lần/retry/hủy, QR SePay/Pay2S, sai tiền/tổng món, retry khác payload, hết hạn, sai chi nhánh, không phải nhân viên, thẻ đã dùng và quyền anon. Không để lại đơn hoặc tài khoản tem fixture.
- Migration `pos_qr_checkout_and_stamp_defaults` và bổ sung `pos_qr_checkout_pager_guard` đã áp dụng.
- Edge `pos-payment-session-api` v46 ACTIVE, `verify_jwt=true`; v46 bổ sung chặn đọc/phục hồi phiên checkout mới chưa attach. Các action cũ giữ nguyên hợp đồng cho POS cũ.
- Chưa đo lại tốc độ và chưa đổi tem thật trên thiết bị với bản sửa; cần thử tại 30/4 trước khi phát hành chung.

## APK release cài thử

- File: `ghr-pos-mobile-native/releases/GHR-POS-0.4.34.apk`, **31.760.755 bytes**, package `vn.ghr.posmobile`, version **0.4.34 / code 65**, ABI `arm64-v8a` và `armeabi-v7a`.
- SHA-256 APK: `d86664a532b899255df32d8df09df9fe3ab30ba0a701f1fcad7eb247e61dc385`.
- Certificate SHA-256: `728d5843ae0c8883171fdae3fd65b6375810d27ed946297c5cee3a51b62224ea`, cùng chữ ký release đã xác minh trước; cài đè, không gỡ app.
- Gradle `assembleRelease` đạt: 4 phút 36 giây, 146 tasks. Dùng temporary init script cấp bytecode Hermes production vừa biên dịch; không bỏ tác vụ đóng gói/ký. Trích bytecode từ APK và SHA-256 khớp chính xác bytecode mới, có action `create_checkout`, snapshot ngân hàng và checkout tem.
- APK mới là file local để cài thử, **chưa upload hoặc thay metadata POS cập nhật chung**. Source đã đồng bộ Cloud qua `baa5476`, `b001d99`; phần server đã triển khai như trên.
- Thử nghiệm tại quán: cài đè trên một máy 30/4 → tạo QR khách thử và đo từ bấm nút tới QR → tự chuyển tiền kiểm tra đúng đơn/bếp/bill → chọn khách đủ 10 tem, chọn quà, xác nhận 0đ, hoàn thành, kiểm tra trừ đúng 10 tem một lần và in bill 0đ. Thử lại/reprint không trừ tem thêm. Chưa coi kiểm thử giả lập là bằng chứng thiết bị đã đạt.

## File cập nhật

- `ghr-pos-mobile-native/src/features/pos/hooks/usePosComposer.js`
- `ghr-pos-mobile-native/src/services/pos/posOrderService.js`
- `ghr-pos-mobile-native/src/services/pos/posPaymentSessionService.js`
- `ghr-pos-mobile-native/android/app/build.gradle`
- `ghr-pos-mobile-native/__tests__/posPendingQrStampRead.test.js`
- `supabase/functions/pos-payment-session-api/index.ts`

## File mới

- `supabase/functions/_shared/posQrCheckout.ts`
- `supabase/migrations/20261102112522_pos_qr_checkout_and_stamp_defaults.sql`
- `supabase/migrations/20261102113741_pos_qr_checkout_pager_guard.sql`
- `docs/supabase-sql/pos-qr-checkout-and-stamp-defaults.sql`
- `docs/supabase-sql/pos-qr-checkout-and-stamp-defaults-test.sql`
- `scripts/pos-qr-checkout.test.mjs`
- `ghr-pos-mobile-native/__tests__/posCombinedQrCheckout.test.js`
- Tài liệu này.
