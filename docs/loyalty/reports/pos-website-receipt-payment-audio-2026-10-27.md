# Bill và âm báo thanh toán website — 27/10/2026

## Bằng chứng chỉ đọc

- Ảnh bill GHR-1798 khớp đơn MoMo `GHR261027105111125`, chi nhánh UUID `c0d35bd0-e614-4973-9eb2-17e78fb9a245`.
- Job `f3400306-bd5a-4b04-bb88-af6469465b20`, loại `qr_order_bundle`, được consumer `pos-native-...` ghi printed. Payload có một món, paymentStatus paid/paidAt nhưng secondaryText chứa `@@CENTER:HOA DON BAN HANG` không dấu.
- Ảnh người dùng là bằng chứng giấy cũ; trạng thái printed riêng nó chỉ chứng minh consumer hoàn thành job. Không retry hoặc tạo lệnh in/giao dịch thật trong điều tra.

## Nguyên nhân và sửa nguồn

- Native chỉ dựng lại bill khách khi có secondaryOrder, còn secondaryText của webhook được dùng nguyên. Header ASCII không qua nhận diện mẫu chung. Với bundle đã trả tiền, phần bill món còn có thể bị thay bằng bill khách.
- Dựng lại bill món/khách từ structured order cho MoMo và QR ngân hàng, giữ luồng secondaryOrder riêng của POS phone. Chỉ một bill món và một bill khách, giữ topping dạng chuỗi, ghi chú, tổng tiền, giảm giá, QR token. Bổ sung nhận diện các nhãn ASCII cũ nếu thiếu structured items.
- Cash website đi qua readPosOrderForPrint + printLocalReceipt + mẫu chung. Bổ sung lấy expected_earn_points đã lưu để in số điểm đúng, không tự tính lại. Test giữ tiền khách đưa/tiền thối.
- Hai webhook thêm các trường dữ liệu in (subtotal/giảm giá/điểm dự kiến); không sửa xử lý tiền, chữ ký webhook, hoặc việc cộng điểm. Các function CHƯA deploy.
- Đồng bộ website trước đó phát âm đặt trước cho mọi id mới và bỏ qua chuyển unpaid -> paid. Phân loại theo trạng thái thực, dùng chung registry canonical order id với print station để tránh báo hai lần hoặc báo lùi sang đặt trước. Âm đã thanh toán dùng clip QR payment sẵn có; native dừng âm website preorder khi chuyển sang payment.

## Kiểm tra và giới hạn

- Jest cuối: 15 suites / 45 tests đạt; gồm tem, 0đ, ba đường in, ASCII cũ, tiền thối, event thanh toán, dedup và chuyển trạng thái.
- `receipt-template.test.mjs` và `stamp-print-station.test.mjs` đạt; không gọi nhận điểm/tem/in thật.
- Hai file TypeScript webhook qua kiểm tra cú pháp esbuild. ESLint runtime sửa đạt.
- Lệnh compile Java riêng có loại task bundle không dùng được do phụ thuộc generated resources của Gradle. Không coi đó là lỗi mã Java hoặc build APK mới thành công. APK cuối phải build lại đầy đủ không bỏ task.
- Chưa xác nhận giấy/âm trên máy tại quán. Trang tải vẫn 0.4.31, giữ PR #19 draft và code trên nhánh cloud theo yêu cầu chờ gom lỗi.

## File bổ sung/cập nhật trong lượt này

- `ghr-pos-mobile-native/android/app/src/main/java/com/ghrposmobilenative/PosPrinterModule.java`
- `ghr-pos-mobile-native/src/features/pos/hooks/usePosComposer.js`
- `ghr-pos-mobile-native/src/services/pos/posPrintStationService.js`
- `ghr-pos-mobile-native/src/services/pos/posOrderQueryService.js`
- `ghr-pos-mobile-native/src/services/pos/receiptTemplate.js`
- Mới: `ghr-pos-mobile-native/src/services/pos/posOrderAlertService.js`
- Mới: `ghr-pos-mobile-native/__tests__/posWebsitePaidReceipt.test.js`
- Mới: `ghr-pos-mobile-native/__tests__/posWebsitePaymentAlert.test.js`
- Mới: `ghr-pos-mobile-native/__tests__/posWebsiteCashPrint.test.js`
- `scripts/receipt-template.test.mjs`, `scripts/stamp-print-station.test.mjs`
- `supabase/functions/momo-payment-webhook/index.ts`, `supabase/functions/sepay-pos-webhook/index.ts`
- Ghi chú này và ghi chú POS 0.4.32.
