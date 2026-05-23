# GHR Print Station APK

App Android native cho máy POS Android dùng máy in Xprinter 80mm. App này không cần mở Kitchen bằng WebView nữa, chỉ làm nhiệm vụ nhận lệnh in bill khách từ Supabase `print_jobs` rồi in ra máy in USB hoặc LAN/WiFi.

## Chức năng

- Đăng nhập tài khoản bếp/chi nhánh bằng Supabase Auth.
- Tự lấy `branch_uuid` từ `profiles.metadata.branch_uuid` của tài khoản đã đăng nhập.
- Chọn máy in `USB` hoặc `LAN/WiFi`.
- Với `USB`: chỉ hiện nút chọn máy in USB và xin quyền USB.
- Với `LAN/WiFi`: hiện ô nhập IP máy in và port, mặc định `9100`.
- Bật/tắt trạm in.
- Tự kiểm tra `print_jobs` khoảng 3 giây/lần khi trạm in đang bật.
- Claim job `pending` thành `printing` trước khi in để tránh nhiều máy in trùng bill.
- In xong cập nhật job thành `printed`; in lỗi cập nhật thành `failed`.
- In test trực tiếp từ APK.
- In dạng ảnh raster ESC/POS để giữ tiếng Việt có dấu ổn định hơn text ESC/POS thường.

## Flow in bill

```txt
iPad/POS mở web Kitchen
↓
Bấm In bill trong đơn
↓
Web Kitchen tạo print_jobs trên Supabase
↓
POS Android Print Station kiểm tra print_jobs theo branch_uuid
↓
POS claim job pending thành printing
↓
POS in bill qua USB hoặc LAN/WiFi
↓
POS cập nhật job thành printed hoặc failed
```

## Cài đặt trên POS

1. Cài APK vào máy POS Android.
2. Mở app `GHR Print Station`.
3. Nhập email và mật khẩu tài khoản bếp/chi nhánh.
4. Bấm `Đăng nhập chi nhánh`.
5. App sẽ tự lấy chi nhánh từ `profiles.metadata.branch_uuid`.
6. Chọn kiểu máy in:
   - `USB`: bấm `Chọn máy in USB`, cấp quyền USB.
   - `LAN/WiFi`: nhập IP máy in, ví dụ `192.168.1.88`, port `9100`.
7. Bấm `Lưu cài đặt`.
8. Bấm `In test` để kiểm tra máy in.
9. Bấm `Bật trạm in`.
10. Trên iPad/POS khác, mở web Kitchen và bấm `In bill`.

## Yêu cầu tài khoản

Trong bảng `profiles`, tài khoản đăng nhập cần có:

```txt
auth_user_id = id của user trong Supabase Auth
status = active
role = admin hoặc staff hoặc kitchen
metadata.branch_uuid = uuid chi nhánh
metadata.branch_name = tên chi nhánh, không bắt buộc nhưng nên có
```

## Build APK

Mở thư mục `android-pos-printer` bằng Android Studio, chờ Gradle sync, sau đó chọn:

```txt
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

APK debug sẽ nằm trong:

```txt
android-pos-printer/app/build/outputs/apk/debug/app-debug.apk
```

## Ghi chú

- App này dùng Supabase REST, không phụ thuộc Android System WebView.
- Muốn đổi link Supabase hoặc anon key thì sửa trong `MainActivity.java`.
- Nếu muốn app in khi bị tắt hẳn hoặc bị Android kill nền, bước sau nên nâng cấp thành Foreground Service.
