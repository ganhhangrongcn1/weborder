# POS 0.4.32 — dấu hiệu đổi tem và xác nhận đơn 0đ

## Phạm vi

- SĐT hợp lệ được tra tem sau 400ms, dùng chung kết quả cho thẻ khách hàng và modal quyền lợi. Tận dụng cache/in-flight 60 giây hiện có; không thêm polling hoặc realtime. Đổi SĐT/tài khoản bỏ kết quả cũ; lỗi/offline không báo đủ tem. Cache invalidation sau đơn làm cập nhật cả hai nơi.
- Đủ 10 tem khả dụng: thẻ khách và phần chọn quà nổi bật, có badge hộp quà rung nhẹ. Tôn trọng cài đặt giảm chuyển động, dừng animation khi unmount. Nhân viên chọn món mới thêm quà vào bill; không tự đổi quà.
- Đơn 0đ chỉ hiện “Xác nhận đơn 0đ”, ẩn Tiền mặt/QR ở danh sách website và các điểm thao tác đơn điện thoại/composer liên quan. Bấm xác nhận cập nhật đơn gốc, không mở ô nhập tiền/két tiền/QR, khóa bấm liên tiếp. Giữ số 0 thay vì lấy nhầm paymentAmount cũ.
- Đơn website 0đ ghi nhận phương thức counter, số thu 0. Luồng đơn điện thoại vẫn dùng RPC có khóa và quyền máy chủ hiện hành. Đơn có tiền vẫn dùng tiền mặt/QR.
- Không thay đổi SQL/RLS/RPC. Giữ kiểm tra đúng SĐT, một món quà, đủ 10 tem và khả dụng tại chi nhánh. Đặt đơn giữ 10 tem; hoàn tất trừ; hủy hoàn tem theo chương trình.

## Kiểm tra

- Jest: 11 suites, 35 tests đạt, bao gồm test mới về nhãn/nút 0đ, cập nhật đơn gốc số thu 0, chặn QR, badge/quà, đổi SĐT khi request chưa trả về và invalidation.
- `node scripts/stamp-program.test.mjs`: đạt trên PGlite 0.5.12 cài riêng trong tmp (không thêm dependency vào app), gồm giữ tem, chặn giữ lần hai, retry, hoàn tất, hủy/hoàn, quyền và ràng buộc món quà.
- ESLint các file runtime sửa đạt. `npm run build` đạt UTF-8 705 file, Vite 5313 module.
- Chưa cài/in trên thiết bị tại quán, chưa tạo đơn hoặc đổi tem thật. Không xem build là bằng chứng in giấy hoặc vận hành thiết bị.

## File cập nhật

- `ghr-pos-mobile-native/android/app/build.gradle` (0.4.32 / code 63, giữ package/signing).
- `ghr-pos-mobile-native/src/features/pos/components/PaymentBar.js`
- `ghr-pos-mobile-native/src/features/pos/components/PosCustomerModal.js`
- `ghr-pos-mobile-native/src/features/pos/components/PosCustomerSummaryCard.js`
- `ghr-pos-mobile-native/src/features/pos/components/PosHistoryPanel.js`
- `ghr-pos-mobile-native/src/features/pos/components/PosOrderDetailModal.js`
- `ghr-pos-mobile-native/src/features/pos/components/PosPhoneSaleWorkspace.js`
- `ghr-pos-mobile-native/src/features/pos/components/PosPickupOrdersPanel.js`
- `ghr-pos-mobile-native/src/features/pos/components/PosStampPanel.js`
- `ghr-pos-mobile-native/src/features/pos/hooks/usePosComposer.js`
- `ghr-pos-mobile-native/src/screens/PosHomeScreen.js`
- `ghr-pos-mobile-native/src/services/pos/posPickupOrderService.js`
- `ghr-pos-mobile-native/src/services/pos/posStampService.js`
- `ghr-pos-mobile-native/__tests__/posPhoneWorkspace.test.js`

## File mới

- `ghr-pos-mobile-native/src/features/pos/components/PosStampRewardBadge.js`
- `ghr-pos-mobile-native/src/hooks/usePosStampSummary.js`
- `ghr-pos-mobile-native/src/services/pos/posZeroOrderPolicy.js`
- `ghr-pos-mobile-native/__tests__/posZeroOrderFlow.test.js`
- `ghr-pos-mobile-native/__tests__/posStampRewardSignal.test.js`
- Ghi chú này.
