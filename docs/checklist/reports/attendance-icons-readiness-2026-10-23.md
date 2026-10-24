# Icon và mức độ sẵn sàng app chấm công

Ngày 23/10/2026. Phạm vi: thay icon trong ứng dụng và đánh giá chức năng theo mã nguồn hiện tại, không thay nghiệp vụ/database. Đã upload **Testing Version 3**, Mini App ID `2442731166050783503`; CLI báo Deploy Done. Chưa gửi xét duyệt, chưa phát hành Live.

## Giao diện

- Một bộ SVG nội bộ: khung 24 px, stroke 1,75, đầu nét bo tròn, mảng nền nhẹ cùng màu. Không thêm thư viện/font icon hoặc request bên ngoài.
- Chấm công dùng lịch có dấu xác nhận; lịch sử dùng đồng hồ quay lại; điều chỉnh dùng phiếu với bút; đào tạo dùng màn hình phát; tài khoản dùng thẻ nhân viên.
- Đồng bộ thêm icon GPS, QR, mạng, camera trong nút chấm công. Nhãn chữ và vùng bấm được giữ; icon trang trí ẩn khỏi trình đọc màn hình.
- Mục đang chọn có nền vàng nhạt theo màu logo, thay khối đen trước đó. Không đổi logo thương hiệu.

## Chức năng đã phù hợp đến đâu

Phù hợp **để thử quy trình chấm công cá nhân cơ bản**. Chưa đủ để áp dụng cho nhân sự thật hoặc tính lương. Đánh giá dựa trên mã nguồn và kiểm thử local, chưa có kiểm chứng thiết bị Zalo trong lượt này.

| Phần | Hiện có | Phần cần hoàn thiện trước dùng thật |
| --- | --- | --- |
| Đăng nhập | Supabase Auth; tài khoản thử riêng, RLS đọc/ghi đúng chủ tài khoản | Liên kết hồ sơ nhân viên thật, trạng thái làm việc và phân công chi nhánh. Không tự gán 11 hồ sơ hiện có. |
| Vào/ra ca | Chặn ca lặp, xem ca mở, lưu dữ liệu thử remote | GPS/QR hiện mặc định mô phỏng, điểm cửa hàng mẫu. Phải cấu hình địa điểm thật, kiểm chứng native và xác thực bằng server. |
| Giờ công | Tổng thời lượng giữa vào/ra; lịch sử tháng, CSV | Ca chuẩn, ca qua đêm, nghỉ giữa ca, đi trễ/về sớm, tăng ca, khóa kỳ và đối chiếu. Chưa coi tổng giờ hiện tại là giờ trả lương. |
| Điều chỉnh | Nhân viên gửi yêu cầu/lý do/minh chứng; có logic duyệt trong mã | Kho Testing chỉ cấp vai trò nhân viên, dữ liệu tách theo account; chưa có quản lý đọc và duyệt yêu cầu nhân viên qua server/chi nhánh. Cần log kiểm toán và phân quyền server. |
| Bằng chứng | Camera/media adapter và vị trí lấy khi chủ động | Native chưa nghiệm thu; file native có thể chỉ đọc trên máy đã chọn. Cần Storage private và quyền xem theo người/chi nhánh, chính sách lưu trữ. |
| Dữ liệu | Kho JSON Testing riêng, RLS, revision chống ghi đè đồng thời | Bảng ca/yêu cầu chuẩn và thời gian server, quy tắc server, bất biến lịch sử. Không nâng snapshot Testing thành dữ liệu payroll production. |
| Nhân sự mở rộng | Chưa có trong Mini App | Xếp ca/đổi ca, nghỉ phép và báo cáo quản lý; xác định phạm vi cần thiết trước khi làm. |
| Đào tạo/tài liệu | Nội dung hướng dẫn và adapter đã viết | PDF/MP4 bị CLI bỏ qua do định dạng không hỗ trợ. Cần host HTTPS tài nguyên, sau đó thử native; chưa hoạt động trên Testing 3. |

Ưu tiên tiếp theo: (1) tài khoản nhân viên/chi nhánh thật, (2) chấm công và duyệt bằng quy tắc server, (3) ca làm và chính sách giờ công, (4) bằng chứng và báo cáo. Không tự triển khai các phần này trong lượt sửa icon.

## Kiểm tra và file thay đổi lượt này

- Build subapp và kiểm tra UTF-8 đạt; ESLint hai component đạt; `git diff --check` đạt (có cảnh báo CRLF ở History từ lượt trước).
- Kiểm tra browser 390 × 844: đăng nhập, menu 5 mục, icon nút và trạng thái chọn rõ, không thay luồng nghiệp vụ. Không tạo thêm ca chỉ để kiểm tra icon.
- Upload CLI thành công Testing 3; gói build 860.676 byte. PDF/MP4 không được upload như các bản trước; ảnh QR tạo theo App ID và version trả về.
- Cập nhật `attendance-miniapp/src/components/NavigationIcon.jsx`.
- Cập nhật `attendance-miniapp/src/components/Checkin.jsx`.
- Cập nhật `attendance-miniapp/src/styles.css`.
- Tạo báo cáo này; cập nhật liên kết trạng thái trong báo cáo Testing và danh sách việc dang dở.
- Ảnh icon/QR ở `attendance-miniapp/tmp/review/`, được Git ignore. Không đưa mật khẩu/token vào mã nguồn hoặc báo cáo.
