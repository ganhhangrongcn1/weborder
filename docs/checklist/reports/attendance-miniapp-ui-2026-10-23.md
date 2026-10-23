# Giao diện chấm công dành cho Zalo Mini App

Ngày: 23/10/2026.

## Yêu cầu và kết quả

Người dùng yêu cầu dùng app như một sản phẩm sẽ phát triển hoàn chỉnh, đồng bộ với dự án Gánh Hàng Rong và thiết kế phù hợp Zalo Mini App; bỏ ghi chú demo khỏi các màn sử dụng. Không gửi xin quyền hoặc xuất bản.

Đã đối chiếu `ChecklistLoginPage.jsx` và `src/styles/supervision.css`: logo PWA hiện có, vàng `#ffd100`, đỏ `#a23d32`, chữ `#292621`, nền `#f5f3ef`, đường viền `#e4dfd8`. Giao diện mới dùng đúng bộ nhận diện này và font Inter/system-ui/Arial.

- Thanh điều hướng dưới với 5 chức năng và biểu tượng, nút tối thiểu 44 px, có khoảng trống safe area ở đáy.
- Header gọn trên điện thoại; không mô phỏng status bar hoặc nút native của Zalo.
- Màn chấm công ưu tiên đồng hồ, trạng thái ca và hai hành động Vào ca/Ra ca; phần xác nhận GPS, QR, mạng và ảnh được nhóm riêng.
- Đổi tab trở về đầu trang và xóa thông báo cũ để tránh thông báo của màn trước xuất hiện ở màn khác.
- Bỏ sidebar desktop cũ, khẩu hiệu dài, ghi chú demo, bảng xin quyền, thông tin mật khẩu mẫu và hướng dẫn kỹ thuật khỏi giao diện thông thường.
- Bỏ QR tự quét của bản trải nghiệm khỏi màn nhân viên. Mã và logic thử được giữ trong dịch vụ để không phá bộ kiểm thử.
- Giữ chức năng Đăng xuất trong Tài khoản trên điện thoại.
- Tên hiển thị bỏ hậu tố Demo của dữ liệu thử trước đây, không sửa ID hoặc xóa dữ liệu đã lưu.
- Hướng dẫn PDF/video chuyển sang nội dung thao tác nhân viên, cùng màu nhận diện.

## Database: trạng thái thực tế

**Chưa chuyển nguồn dữ liệu sang Supabase.** Tài khoản demo, bản ghi công và yêu cầu vẫn dùng repository IndexedDB riêng của phiên bản trước. Chỉnh giao diện hoặc bỏ ghi chú demo không có nghĩa app đã trở thành hệ thống chấm công production.

Trong source dự án, hồ sơ nhân viên đi qua `loadChecklistEmployees` trong `src/services/checklistManagementService.js`, đọc `checklist_employees` và phân công `checklist_employee_branches`. Đây là xác minh từ mã nguồn, chưa phải kiểm tra schema database đang chạy. Không tạo bảng nhân viên thứ hai hoặc tự ghi vào các bảng này.

Để vận hành thật cần nối xác thực nhân viên/branch assignment và hồ sơ hiện có, bổ sung hợp đồng chấm công được máy chủ kiểm tra quyền, thời gian, vị trí và ca làm; lưu minh chứng private và đồng bộ yêu cầu duyệt. Không dùng IndexedDB hay mật khẩu demo làm cơ chế phân quyền production. Phần đó chưa thực hiện trong lượt chỉnh UI này.

Công cụ chọn GPS/QR mẫu được tách khỏi giao diện thông thường; chỉ xuất hiện trong Tài khoản khi chạy Vite dev với query `?tools=1`. Bản local hiện vẫn khởi tạo chế độ mô phỏng để giữ nguyên hành vi thử. Thông tin này được bàn giao tại đây thay vì chèn vào luồng nhân viên.

## Kiểm tra

- Bộ kiểm thử nghiệp vụ: 9/9 đạt sau khi chỉnh nội dung và giao diện.
- Build app, lint phạm vi app và kiểm tra UTF-8 đều đạt. PDF cập nhật đã render và kiểm tra lại tiếng Việt.
- Kiểm tra khung 390×844: nội dung không tràn ngang, thanh điều hướng dưới không cắt nhãn.
- Không thay logic vào/ra ca, tính giờ, repository hoặc phân quyền duyệt trong lượt thiết kế này.
- Các thao tác native trong Zalo vẫn cần kiểm tra trên điện thoại. Chưa đóng gói/phát hành, chưa gửi xét duyệt hay xin quyền.

## File

File mới:

- `attendance-miniapp/src/components/Brand.jsx`
- `attendance-miniapp/src/components/NavigationIcon.jsx`
- `attendance-miniapp/src/services/attendancePresentation.js`
- `attendance-miniapp/src/assets/ghr-logo.png` — dùng lại đúng logo PWA của dự án.
- `docs/checklist/reports/attendance-miniapp-ui-2026-10-23.md`

File cập nhật:

- `attendance-miniapp/src/App.jsx`
- `attendance-miniapp/src/main.jsx`
- `attendance-miniapp/src/styles.css`
- `attendance-miniapp/src/components/Login.jsx`
- `attendance-miniapp/src/components/Checkin.jsx`
- `attendance-miniapp/src/components/History.jsx`
- `attendance-miniapp/src/components/Corrections.jsx`
- `attendance-miniapp/src/components/Training.jsx`
- `attendance-miniapp/src/components/Account.jsx`
- `attendance-miniapp/src/components/CameraCapture.jsx`
- `attendance-miniapp/src/hooks/useAttendance.js`
- `attendance-miniapp/src/services/demoRepository.js`
- `attendance-miniapp/src/services/attendanceService.js`
- `attendance-miniapp/src/data/demo.js`
- `attendance-miniapp/scripts/create-training-assets.py`
- `attendance-miniapp/src/assets/huong-dan-cham-cong.pdf`
- `attendance-miniapp/src/assets/huong-dan-cham-cong.mp4`
- `docs/checklist/attendance-miniapp-demo.md`
