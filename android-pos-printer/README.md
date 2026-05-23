# GHR POS Printer APK

App Android WebView cho máy POS Android dùng máy in Xprinter 80mm. App hỗ trợ cả USB và LAN/WiFi qua TCP port `9100`.

## Chức năng

- Mở web Kitchen online trong WebView.
- Link mặc định: `https://ganhhangrong.vn/kitchen`.
- Expose bridge `window.GhrPrinter` để web gọi in bill khách.
- Web Kitchen chạy trong APK sẽ tự nhận `print_jobs` realtime từ Supabase.
- Chọn kiểu in `USB` hoặc `LAN/WiFi`.
- Với `USB`: chỉ hiện nút chọn máy in USB và xin quyền USB.
- Với `LAN/WiFi`: chỉ hiện ô IP máy in và port, mặc định `9100`.
- In test.
- In bill dạng ảnh raster ESC/POS để giữ tiếng Việt có dấu ổn định hơn text ESC/POS thường.

## Build APK

Mở thư mục `android-pos-printer` bằng Android Studio, chờ Gradle sync, sau đó chọn:

`Build > Build Bundle(s) / APK(s) > Build APK(s)`

APK debug sẽ nằm trong:

`android-pos-printer/app/build/outputs/apk/debug/app-debug.apk`

## Cài đặt trên POS

1. Cài APK vào máy POS Android.
2. Mở app, bấm `Cài đặt`.
3. Giữ link mặc định `https://ganhhangrong.vn/kitchen` hoặc nhập link Kitchen khác nếu cần.
4. Chọn kiểu máy in:
   - `USB`: bấm `Chọn máy in USB`, cấp quyền USB.
   - `LAN/WiFi`: nhập IP máy in, ví dụ `192.168.1.88`, port `9100`.
5. Bấm `In test`.
6. Mở Kitchen trên iPad hoặc POS, bấm `In bill` trong đơn.
7. POS Android đang mở app sẽ tự nhận lệnh `print_jobs` và in ra Xprinter.

## Flow in bill

```txt
iPad/POS bấm In bill
→ Web Kitchen tạo print_jobs trên Supabase
→ Web Kitchen trong APK POS subscribe realtime
→ POS claim job pending thành printing
→ POS gọi window.GhrPrinter
→ Xprinter in bill qua USB hoặc LAN/WiFi
→ POS cập nhật job thành printed hoặc failed
```
