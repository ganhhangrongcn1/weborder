# Giao diện đăng nhập và liên kết điện thoại

Ngày 23/10/2026. Chỉnh theo ảnh người dùng cung cấp: nền sáng, form trắng bo góc, trường có icon, hiện/ẩn mật khẩu, nút vàng và logo Gánh Hàng Rong đang có trong dự án. Các thẻ nội dung và màu nút trong app được đồng bộ nền sáng, góc bo, màu vàng thương hiệu. Không sao chép thương hiệu TFood, thanh trạng thái hoặc nút đóng của Zalo vào giao diện web.

## Luồng mới

- Đăng nhập tài khoản/mật khẩu được cấp, không bắt buộc liên kết số điện thoại trước.
- Đăng nhập chỉ đọc dữ liệu Testing của tài khoản; không tự ghi liên kết số điện thoại.
- Tại Tài khoản có nút liên kết và hộp đồng ý; số đã liên kết vẫn được giữ nguyên và có thể xem lại.
- Trang đăng nhập có Quyền riêng tư mở đọc được. Nội dung mô tả dữ liệu Testing và các thao tác hiện có, chưa phải chính sách vận hành chính thức.
- Quên mật khẩu và Liên hệ quản lý hiện hướng dẫn liên hệ quản lý; không tự đặt lại mật khẩu, không mở đăng ký tự do.
- Không gọi API Zalo, không sửa database/schema, không upload Testing hoặc gửi duyệt trong lượt này. Bản Testing 4 vẫn là giao diện cũ.

## Kiểm tra

Build app đạt, 16 kiểm thử hiện có đạt, ESLint các file JS/JSX sửa đạt, kiểm tra encoding đạt. Kiểm tra trực tiếp mở/đóng Quyền riêng tư, đăng nhập thành công không qua bước điện thoại, mở Tài khoản thấy liên kết cũ còn nguyên. Chưa xác minh trên Zalo điện thoại.

## File

Mới: `attendance-miniapp/src/components/PrivacyNotice.jsx`, báo cáo này.

Cập nhật: `attendance-miniapp/src/components/Login.jsx`, `attendance-miniapp/src/components/Account.jsx`, `attendance-miniapp/src/hooks/useAttendance.js`, `attendance-miniapp/src/services/attendanceAuthService.js`, `attendance-miniapp/src/styles.css`, `docs/checklist/reports/attendance-permission-explanations-2026-10-23.md`.

Ảnh cũ về liên kết trước đăng nhập là tư liệu lịch sử, chưa được dùng cho hồ sơ của luồng mới.
