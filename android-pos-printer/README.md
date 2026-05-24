# GHR Print Station APK

App Android native cho máy POS Android dùng máy in Xprinter 80mm. App này không cần mở Kitchen bằng WebView nữa, chỉ làm nhiệm vụ nhận lệnh in bill khách từ Supabase `print_jobs` rồi in ra máy in USB hoặc LAN/WiFi.

## Chức năng

- Đăng nhập tài khoản bếp/chi nhánh bằng Supabase Auth.
- Tự lấy `branch_uuid` từ `profiles.metadata.branch_uuid` của tài khoản đã đăng nhập.
- Chọn máy in `USB` hoặc `LAN/WiFi`.
- Với `USB`: chỉ hiện nút chọn máy in USB và xin quyền USB.
- Với `LAN/WiFi`: hiện ô nhập IP máy in và port, mặc định `9100`.
- Bật/tắt trạm in.
- Khi bật trạm in, APK chạy foreground service để có thể chuyển qua iPOS mà vẫn giữ trạm in sống.
- Nhận lệnh in mới gần như ngay lập tức bằng Supabase Realtime.
- Nhận lệnh in bằng Supabase Realtime, không chạy polling định kỳ để giảm request.
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
POS Android Print Station nhận realtime theo branch_uuid
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

Nếu profile chưa có `metadata.branch_uuid`, APK sẽ thử dò thêm các trường sau:

```txt
profiles.branch_uuid
profiles.branch_id
profiles.branch_code
profiles.branch_slug
profiles.branch_name
auth.user_metadata.branch_uuid
auth.user_metadata.branch_id
auth.user_metadata.branch_code
auth.user_metadata.branch_name
```

Khi chỉ có `branch_id`, `branch_code`, `branch_slug` hoặc `branch_name`, APK sẽ đọc bảng `branches` để lấy lại `branches.branch_uuid`.

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
- App đã có foreground service giữ trạm in khi chuyển qua app khác như iPOS. Nếu người dùng tắt trạm in hoặc force stop APK thì app sẽ ngừng nhận lệnh in.
- Nếu realtime bị mạng/POS chặn, có thể bấm `Kiểm tra lệnh in` trong APK để kéo job pending thủ công.
