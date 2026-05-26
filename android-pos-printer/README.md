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

## Xử lý lỗi thường gặp

Khi trạm in không in bill, ưu tiên làm theo đúng thứ tự sau để tránh thao tác thừa.

### 1. Báo lỗi liên quan Supabase hoặc không nhận lệnh in

Ví dụ log:

```txt
Lỗi lấy lệnh in: Supabase HTTP 400
refresh_token_not_found
Invalid Refresh Token
```

Cách xử lý:

1. Bấm `Kiểm tra lệnh in`
2. Nếu vẫn chưa in được, bấm `Tắt trạm in`
3. `Đăng xuất tài khoản chi nhánh`
4. `Đăng nhập lại`
5. Bấm `Bật trạm in`
6. Bấm lại `Kiểm tra lệnh in`

Giải thích ngắn:
- Đây thường là lỗi phiên đăng nhập với Supabase đã hết hạn hoặc token không còn hợp lệ.
- Chỉ tắt/bật trạm in đôi khi chưa đủ, cần đăng nhập lại để lấy phiên mới.

### 2. Báo lỗi realtime hoặc lâu lâu không tự nhảy bill

Biểu hiện:
- Không có bill mới chạy vào ngay
- Log có chữ `Supabase`, `Realtime`, `reconnecting`

Cách xử lý:

1. Bấm `Kiểm tra lệnh in`
2. Nếu vẫn chưa có bill, `Tắt trạm in`
3. Bật lại bằng `Bật trạm in`
4. Kiểm tra Wi-Fi hoặc mạng LAN của máy POS

Giải thích ngắn:
- APK có Realtime và có cơ chế đọc job dự phòng.
- Khi Realtime bị chập chờn, nút `Kiểm tra lệnh in` thường sẽ kéo được bill pending về lại.

### 3. Báo lỗi máy in chưa nhận bill

Ví dụ log:

```txt
Máy in chưa nhận bill
Printer did not accept the bill
```

Cách xử lý:

1. Kiểm tra máy in còn bật không
2. Nếu in `USB`: kiểm tra dây và quyền USB
3. Nếu in `LAN/WiFi`: kiểm tra IP máy in và mạng nội bộ
4. Bấm `In test`
5. Nếu in test chưa được, lưu lại cài đặt máy in rồi thử lại

Giải thích ngắn:
- Lỗi này thường là lỗi kết nối giữa APK và máy in, không phải lỗi đơn hàng.

### 4. Có bill nhưng không chắc đã mất hay chưa

Cách xử lý:

1. Không đăng nhập đi đăng nhập lại ngay
2. Bấm `Kiểm tra lệnh in` trước
3. Quan sát log xem có dòng `Đã nhận lệnh in ...` hoặc `Printed bill ...` không
4. Nếu vẫn chưa in được thì mới `Tắt trạm in` rồi bật lại

### 5. Quy trình ngắn cho nhân viên

Khi gặp lỗi, làm đúng 3 bước này trước:

1. `Kiểm tra lệnh in`
2. `Tắt trạm in` -> `Bật trạm in`
3. Nếu còn báo lỗi Supabase/token -> `Đăng xuất` -> `Đăng nhập lại`

### 6. Khi nào cần báo kỹ thuật

Nhân viên nên báo kỹ thuật nếu:

- Đã đăng nhập lại nhưng vẫn báo lỗi `Supabase HTTP 400/401`
- `In test` cũng không in được
- Máy in USB không xin được quyền
- Máy in LAN/WiFi đúng IP nhưng vẫn không nhận bill
- Có nhiều bill pending nhưng kéo mãi không ra
