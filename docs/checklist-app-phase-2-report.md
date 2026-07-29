# Báo cáo GHR Checklist - Phase 2

## Kết quả

Phase 2 tách giao diện quản trị thành hai khu độc lập:

1. **Quản lý nhân sự**
   - Thêm và cập nhật hồ sơ nhân viên.
   - Chọn linh hoạt một hoặc nhiều chi nhánh.
   - Quản lý trạng thái đang làm, tạm nghỉ hoặc đã nghỉ.
   - Tìm kiếm và lọc nhân viên theo chi nhánh.
   - Không xóa hồ sơ để bảo toàn lịch sử đánh giá.

2. **Quản lý giám sát**
   - Xem checklist theo từng nhóm tiêu chí.
   - Hiển thị trọng số, yêu cầu hình ảnh và mức vi phạm.
   - Tạo bản nháp từ checklist đang sử dụng.
   - Thêm, sửa hoặc tạm ẩn tiêu chí trong bản nháp.
   - Chỉ công bố khi tổng trọng số tiêu chí hoạt động bằng 100.
   - Khóa nội dung phiên bản đã công bố để bảo toàn kết quả kiểm tra cũ.

## Điểm truy cập chính

Hai mô-đun đã được tích hợp trực tiếp vào Admin hiện tại, dùng chung phiên đăng nhập:

- `/admin/employees`: Quản lý nhân sự.
- `/admin/supervision`: Quản lý giám sát.

Menu **Nhân sự & giám sát** xuất hiện trong sidebar của `/admin/`. App thử nghiệm dưới `apps/checklist` không còn là điểm truy cập chính cho người dùng.

## Kiến trúc dữ liệu

- Hai khu quản trị là hai mô-đun giao diện, không ép toàn bộ nghiệp vụ vào hai bảng vật lý.
- Dữ liệu nhân sự dùng `checklist_employees` và `checklist_employee_branches`.
- Dữ liệu giám sát dùng mẫu, phiên bản, nhóm và tiêu chí trong các bảng `checklist_*` đã chuẩn hóa.
- Các thao tác nhiều bước được đóng gói thành hàm cơ sở dữ liệu để tránh lưu dở dang.
- Hàm quản trị chạy theo quyền của người đăng nhập, không dùng `security definer`.

## Kiểm tra

- Migration Phase 2 đã áp dụng vào Supabase và ghi nhận đúng lịch sử migration.
- Build production của app checklist thành công.
- Giao diện đăng nhập kiểm tra ở màn hình 390px không tràn ngang.
- Không có lỗi hoặc cảnh báo trong console trình duyệt.

## Phase tiếp theo đề xuất

Phase 3: luồng giám sát thực địa.

- Chọn chi nhánh.
- Tự lọc danh sách nhân viên thuộc chi nhánh đó.
- Chọn các nhân viên có mặt tại thời điểm kiểm tra.
- Chấm từng tiêu chí, ghi chú và tải ảnh bằng chứng.
- Lưu nháp, tiếp tục sau và hoàn tất biên bản.
- Tính điểm cửa hàng và ghi nhận vi phạm cho đúng nhân viên.
