# GHR POS Printer APK

App Android WebView cho máy POS Android dùng máy in Xprinter USB 80mm.
App cũng hỗ trợ Xprinter LAN/WiFi qua TCP port 9100.

## Chức năng

- Mở web Kitchen online trong WebView.
- Expose bridge `window.GhrPrinter` để web gọi in bill khách.
- Web Kitchen chạy trong APK sẽ tự nhận `print_jobs` realtime từ Supabase và in ra USB.
- Chọn máy in USB và xin quyền USB.
- Chọn kiểu in USB hoặc LAN/WiFi.
- Nhập IP máy in LAN/WiFi và port, mặc định `9100`.
- In test.
- In bill dạng ảnh raster ESC/POS để giữ tiếng Việt có dấu ổn định hơn text ESC/POS thường.

## Build APK

Mở thư mục `android-pos-printer` bằng Android Studio, chờ Gradle sync, sau đó chọn:

`Build > Build Bundle(s) / APK(s) > Build APK(s)`

APK debug sẽ nằm trong:

`android-pos-printer/app/build/outputs/apk/debug/app-debug.apk`

## Cài đặt trên POS

1. Cài APK vào máy POS Android.
2. Cắm máy in Xprinter USB/OTG.
3. Mở app, bấm `Cài đặt`.
4. Nhập link web Kitchen online.
5. Chọn kiểu máy in:
   - `USB`: bấm `Chọn máy in USB`, cấp quyền USB.
   - `LAN/WiFi`: nhập IP máy in, ví dụ `192.168.1.88`, port `9100`.
6. Bấm `In test`.
7. Mở Kitchen trên iPad, bấm `In bill` trong đơn.
8. POS Android đang mở app sẽ tự nhận lệnh `print_jobs` và in ra Xprinter USB.

## Flow in bill

```txt
iPad bấm In bill
→ Web Kitchen tạo print_jobs trên Supabase
→ Web Kitchen trong APK POS subscribe realtime
→ POS claim job pending thành printing
→ POS gọi window.GhrPrinter
→ Xprinter USB in bill
→ POS cập nhật job thành printed hoặc failed
```
