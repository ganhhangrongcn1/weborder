# Ghép sửa tem trên nền POS Cloud

## Nền mã nguồn

- Repository: `ganhhangrongcn1/weborder`.
- Đã fetch và đối chiếu các nhánh Cloud ngày 18/10/2026.
- Nền POS: `origin/codex/pos-usb-cloud-release-20261014`, commit `41c7e4850a1c3d95496e368210855a3fb757508d`.
- Nhánh làm việc riêng: `codex/pos-stamp-cloud-20261018`.
- Giữ nguyên metadata Cloud: 0.4.25, versionCode 56. Đây chưa phải bản phát hành APK mới.
- Các nhánh web có commit mới hơn vẫn chứa POS 0.4.13 và không có bản sửa USB của nhánh phát hành POS, nên không dùng chúng làm nền POS.

## Phạm vi ghép

Chỉ ba file có sẵn được thay đổi:

1. `ghr-pos-mobile-native/src/services/pos/posStampService.js`: bill yêu cầu số tem mới không dùng cache/yêu cầu đọc thông thường trước thanh toán; kết quả cũ về muộn không ghi đè cache mới. Không in số tem cũ khi đọc mới thất bại.
2. `ghr-pos-mobile-native/src/features/pos/hooks/usePosComposer.js`: bill tại quầy, bill website thu tại POS và bill in lại đều yêu cầu số tem mới.
3. `ghr-pos-mobile-native/__tests__/posStamps.test.js`: kiểm tra bill 9 lên 10 tem, lỗi đọc và kết quả trả về sai thứ tự.

Các file Android, bản sửa chọn/cấp quyền máy in USB, metadata phiên bản, package và lockfile khớp nguyên nền Cloud. Không chép toàn bộ file ứng dụng từ checkout local cũ: chỉ áp dụng patch ba file sau khi xác nhận blob gốc từng file trùng với nền Cloud.

Ba file SQL được thêm để lưu lại phần máy chủ đã triển khai ở lượt trước; lần ghép này không chạy lại migration hoặc sửa máy chủ:

- `supabase/migrations/20261017093657_stamp_earn_on_payment.sql`
- `docs/supabase-sql/20261017_stamp_earn_on_payment.sql`
- `docs/supabase-sql/20261017_stamp_earn_on_payment_checks.sql`

Migration chỉ thay điều kiện nhận thanh toán trong `stamp_private.order_before_write()`. Giữ giới hạn 1 tem/ngày/số điện thoại, khóa và định danh nguồn chống cộng trùng, xử lý hủy/hoàn tiền, luồng đổi quà và xử lý hoàn thành dữ liệu cũ. Không đụng `partner_after_write()` hoặc điểm theo hạng.

## Kiểm tra

- 7 tình huống chọn/kết nối lại máy in USB của chính nhánh Cloud: qua.
- Trạm in QR và in lại: qua; chỉ đọc số tem, không tự cộng khi in.
- 3 bộ Jest với 16 tình huống tem/bill/QR chưa thanh toán: qua trên checkout Cloud đã ghép.
- Lint hai file runtime, UTF-8 và `git diff --check`: qua.
- Kiểm tra Git: chỉ đúng ba file có sẵn thay đổi; blob của `build.gradle`, `PosPrinterModule.java` và `UsbPrinterSelectionPolicy.java` khớp nguyên Cloud.
- `npm run build`: qua trên checkout Cloud đã ghép (5.267 modules); chỉ có cảnh báo kích thước bundle/Browserslist hiện hữu.

## Trạng thái

Chưa push, chưa merge nhánh phát hành Cloud, chưa thay website và chưa phát hành APK. APK local cũ bị trùng 0.4.25 vẫn không được sử dụng. Trước khi phát hành cần kiểm tra lại đầu nhánh Cloud, chọn versionCode mới chưa sử dụng và xác minh APK/bill trên thiết bị.
