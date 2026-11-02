# POS 0.4.35 — QR và bố cục ba cột

Ngày: 02/11/2026. Bản Android: 0.4.35, versionCode 66.

## Kết quả

- Đã bật Pay2S/MB cho 4 chi nhánh, đồng bộ `branches` và `ghr_branches`. Giữ nguyên tài khoản SePay dự phòng. Bản sao cấu hình trước đổi nằm trong `.tmp/pay2s-rollout-backup-20261102.json`, không đưa lên Git.
- Website và POS hỗ trợ snapshot tài khoản nhận MB cho phiên mới. POS cũ không gửi capability tiếp tục SePay; phiên cũ giữ ngân hàng đã chốt khi tạo phiên.
- Admin có ba lựa chọn: dùng Pay2S, thử theo số điện thoại, tắt để dùng SePay. Hiển thị tài khoản nhận và số chi nhánh đã chọn. Nút dùng chung tài khoản chỉ sửa bản nháp; vẫn cần bấm lưu chi nhánh.
- POS ngang từ 820px: danh mục trái, danh sách món giữa, giỏ hàng/thanh toán phải. Không có tìm kiếm theo yêu cầu anh. Bấm món vẫn dùng luồng chọn tùy chọn cũ. Màn hình hẹp giữ bố cục hiện có.
- QR ngân hàng được vẽ tại máy bằng dữ liệu phiên đã lưu; bỏ thời gian tải ảnh VietQR. Máy in cũng dùng chuỗi QR tại máy. MoMo giữ luồng cũ.
- Tạo phiên POS, đơn và món trong một giao dịch cơ sở dữ liệu; lỗi thì hoàn tác toàn bộ. Chỉ trả QR khi giao dịch lưu thành công. Lưu mã yêu cầu trên máy để thử lại cùng bill không tạo trùng; đổi bill khi kết quả cũ chưa rõ phải phục hồi/kiểm tra lịch sử.
- Gọi Edge Function tại Singapore, gần cơ sở dữ liệu. Pin region không tự chuyển vùng khi vùng đó lỗi; lỗi vẫn hiển thị để thử lại cùng mã yêu cầu.

## Triển khai và kiểm tra

- SQL `20261102122933_atomic_pos_bank_checkout.sql` đã áp dụng. RPC chỉ `service_role` được gọi; Edge xác thực nhân viên/chi nhánh trước khi gọi, không nới RLS cho client.
- Edge `pos-payment-session-api` v47, `qr-payment-session-api` v41 đã ACTIVE. Chính sách xác thực của hai hàm giữ nguyên.
- 22 bài kiểm tra Node đạt; 5 suite Jest/23 bài đạt. Lint các file thay đổi đạt; kiểm tra encoding đạt. Build Vite và Android release đạt.
- Hai bộ SQL chạy trong BEGIN/ROLLBACK đạt: giao dịch tạo phiên/đơn/món, retry, hoàn tác, phân quyền, khôi phục context nhân viên; đổi 10 tem/null defaults, retry/hủy và quyền truy cập. Không lưu đơn thử hay đổi tem thật.
- Ảnh QR thử được bộ giải mã ZXing độc lập đọc đúng ngân hàng, số tài khoản, số tiền và nội dung. Đây là dữ liệu giả, không phải giao dịch tiền thật.
- Bố cục được xem bằng các component thực qua lớp mô phỏng React Native trên trình duyệt; đã thử chọn danh mục, thêm món, tăng số lượng. Chưa có thiết bị Android kết nối để xác nhận bản này trên máy quầy.

APK: `ghr-pos-mobile-native/releases/GHR-POS-0.4.35.apk`, 31,766,311 byte.

SHA-256: `35f4e47d524eddbd000af19df56f9eef219284d963f42eeca051a8c64b6404c6`.

Chữ ký: `728d5843ae0c8883171fdae3fd65b6375810d27ed946297c5cee3a51b62224ea`, trùng bản trước. Bytecode đóng trong APK khớp bản build hiện tại (`f33a28e05d92729c2a12595540818558796af51259fa0c035c5982e653df7cff`). Chưa đổi metadata cập nhật APK toàn hệ thống.

## Anh cần làm

Cài đè APK tại 30/4 trước, không gỡ app. Kiểm tra bố cục, chọn tùy chọn món, QR, mất mạng/thử lại, hủy phiên, tiền mặt và đơn đổi 10 tem. Anh tự chuyển tiền thử khi đúng tài khoản; kiểm tra Kitchen và giấy in. Khi máy đầu ổn thì cài các máy còn lại. Website/Admin không cần cài APK; POS cần 0.4.35 để có giao diện và tối ưu mới. Máy 0.4.33–0.4.34 đã nhận MB nhưng chưa có tối ưu mới.

Chưa có phép đo độ trễ trước/sau trên máy quầy; chưa xác nhận giao dịch tiền thật, Kitchen hay giấy in cho riêng bản 0.4.35.

## File tạo mới

- `ghr-pos-mobile-native/src/features/pos/components/PosCategorySidebar.js`
- `ghr-pos-mobile-native/src/services/pos/posQrDraftService.js`
- `ghr-pos-mobile-native/src/shared/pos/bankQrPayload.js`
- `ghr-pos-mobile-native/__tests__/posQrDraft.test.js`
- `ghr-pos-mobile-native/__tests__/posThreeColumn.test.js`
- `src/services/bankQrPayload.js`
- `scripts/bank-qr-payload.test.mjs`
- `supabase/migrations/20261102122933_atomic_pos_bank_checkout.sql`
- `docs/supabase-sql/atomic-pos-bank-checkout.sql`
- `docs/supabase-sql/atomic-pos-bank-checkout-test.sql`
- Báo cáo này; APK nằm ngoài Git.

## File cập nhật

- `ghr-pos-mobile-native/android/app/build.gradle`
- `ghr-pos-mobile-native/src/features/pos/components/PosMenuPanel.js`
- `ghr-pos-mobile-native/src/features/pos/components/QrPaymentModal.js`
- `ghr-pos-mobile-native/src/features/pos/hooks/usePosComposer.js`
- `ghr-pos-mobile-native/src/screens/PosHomeScreen.js`
- `ghr-pos-mobile-native/src/services/pos/posPaymentService.js`
- `ghr-pos-mobile-native/src/services/pos/posPaymentSessionService.js`
- `ghr-pos-mobile-native/src/services/pos/posPrinterService.js`
- `scripts/pos-qr-checkout.test.mjs`
- `src/features/orders/OrderSuccessView.jsx`
- `src/pages/admin/store/BranchSettings.jsx`
- `src/pages/admin/store/Pay2sSettings.jsx`
- `src/services/qrPaymentService.js`
- `supabase/functions/_shared/posQrCheckout.ts`
- `supabase/functions/pos-payment-session-api/index.ts`
- `supabase/functions/qr-payment-session-api/index.ts`
