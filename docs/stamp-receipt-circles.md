# Ô tem trên bill — 06/10/2026

- Một hàng 10 ô tròn; ô đã tích có dấu chọn, ô còn lại để trống.
- Dùng số tem khả dụng từ kết quả máy chủ hiện có. Không thêm request để vẽ ô, không cộng tem khi in lại.
- Giữ dòng số dư thật; nếu trên 10 tem thì hàng ô hiển thị đủ 10 dấu.
- Web dùng SVG đen trắng co theo khổ giấy. POS Android vẽ trực tiếp lên ảnh in, cao 48 dot (khoảng 6 mm ở 203 dpi).
- Không thêm tem vào phiếu làm món chưa thanh toán. Phần tem đặt trước chân bill QR.
- Cần cài APK mới để máy POS nhận lệnh vẽ ô tròn. Chưa kiểm tra giấy in trên thiết bị thật.

## File cập nhật trong lượt này

- `src/services/printerService.js`
- `ghr-pos-mobile-native/src/services/pos/posPrinterService.js`
- `ghr-pos-mobile-native/src/services/pos/posPrintStationService.js`
- `ghr-pos-mobile-native/android/app/src/main/java/com/ghrposmobilenative/EscPosRasterPrinter.java`
- `ghr-pos-mobile-native/android/app/build.gradle`
- `ghr-pos-mobile-native/__tests__/posStamps.test.js`

## File mới

- `src/services/stampReceiptService.js`
- `output/stamp-receipt-one-row.svg` (minh họa 7/10 tem)
- `docs/stamp-receipt-circles.md`
- `ghr-pos-mobile-native/releases/GHR-POS-0.4.12.apk`

## Kiểm tra

- Web build và UTF-8: đạt.
- Jest in bill/tích tem: 2 bộ, 8 kiểm tra đạt.
- Lint hai dịch vụ in POS đã sửa: đạt.
- SVG: đúng 10 ô cùng hàng; kiểm tra số dư 0, 7, 10, 17 và dữ liệu không hợp lệ.
- Kiểm tra phần tem nằm trong thân bill khi tách chân QR: đạt.
- Android release build: thành công. APK 0.4.12, versionCode 43, package `vn.ghr.posmobile`.
- Chữ ký SHA-256: `728d5843ae0c8883171fdae3fd65b6375810d27ed946297c5cee3a51b62224ea`, khớp bản trước.
- APK SHA-256: `2C6139A53729A058176438A54528207BE156506C2DEE2B8C99E174D75F44D2EA`.
- Chưa triển khai web hoặc cài APK lên máy quán trong lượt này.
