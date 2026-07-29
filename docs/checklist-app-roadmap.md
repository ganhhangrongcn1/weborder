# Lộ trình triển khai ứng dụng Checklist

Ngày lập: 2026-07-29  
Nguyên tắc: hoàn thành, kiểm tra và báo cáo từng phase trước khi chuyển phase tiếp theo.

## Tổng quan

| Phase | Nội dung | Đầu ra chính | Trạng thái |
|---|---|---|---|
| 0 | Hợp đồng nghiệp vụ và kiến trúc | Đặc tả đã chốt | Hoàn thành |
| 1 | Nền tảng dự án và Supabase | App độc lập, schema, RLS, đăng nhập admin | Hoàn thành |
| 2 | Quản trị nhân viên và checklist | Admin tự cấu hình không cần sửa code | Chờ triển khai |
| 3 | Trải nghiệm kiểm tra trên điện thoại | Chọn chi nhánh, nhân viên, làm và nộp phiếu | Chờ triển khai |
| 4 | Lịch sử, dashboard và báo cáo nhân viên | Báo cáo cửa hàng/tháng/lỗi tái phạm | Chờ triển khai |
| 5 | Chạy thử và ổn định | Pilot 1–2 cửa hàng, sửa lỗi thực tế | Chờ triển khai |
| 6 | Supervisor và mở rộng nhân sự | Phân quyền theo chi nhánh, nền tảng HR | Sau MVP |

## Phase 1 — Nền tảng dự án và Supabase

### Công việc

1. Tạo dự án React/Vite độc lập trong phạm vi repository, không thay đổi build của web hiện tại.
2. Thiết lập cấu trúc `pages → hooks → services → repositories`.
3. Audit khóa chuẩn của `branches` và hợp đồng quyền trong `profiles`.
4. Tạo migration idempotent cho các bảng `checklist_*`.
5. Tạo RLS, index và bucket ảnh private.
6. Seed mẫu checklist takeaway phiên bản 1.
7. Làm đăng nhập admin và khung giao diện responsive.
8. Thêm kiểm tra schema, công thức điểm và build độc lập.

### Điều kiện hoàn thành

- App checklist build độc lập thành công.
- Build web Gánh Hàng Rong hiện tại vẫn thành công.
- Admin hiện tại đăng nhập được.
- Không có bảng checklist nào được truy cập khi chưa đăng nhập.
- Migration có audit script và an toàn khi chạy lại.
- Không có service-role key trong frontend.

## Phase 2 — Quản trị nhân viên và checklist

### Công việc

- CRUD mềm hồ sơ nhân viên.
- Gán nhân viên cho một hoặc nhiều chi nhánh.
- Lọc nhân viên theo chi nhánh.
- Quản lý mẫu, phiên bản, nhóm và tiêu chí checklist.
- Chỉnh trọng số, mức nghiêm trọng, yêu cầu ảnh và thứ tự.
- Công bố phiên bản mới; không sửa phiên bản đã dùng.

### Điều kiện hoàn thành

- Admin tự thêm, sửa, tạm ẩn nhân viên và tiêu chí.
- Tổng trọng số được kiểm tra trước khi công bố.
- Lịch sử cũ không thay đổi khi mẫu mới được công bố.

## Phase 3 — Kiểm tra trên điện thoại

### Công việc

- Chọn chi nhánh và nhân viên đang có mặt.
- Tạo/lưu nháp/tiếp tục phiếu.
- Trả lời nhanh từng tiêu chí.
- Chụp ảnh, ghi chú và gắn trách nhiệm.
- Tính điểm, cảnh báo thiếu dữ liệu và nộp phiếu.
- Tự đề xuất ngày kiểm tra tiếp theo sau hai ngày.

### Điều kiện hoàn thành

- Thao tác tốt bằng một tay trên điện thoại.
- Không thể nộp khi thiếu ảnh/ghi chú bắt buộc.
- Mất mạng ngắn không làm mất phần nháp đã lưu gần nhất.
- Phiếu đã nộp giữ nguyên snapshot và điểm.

## Phase 4 — Dashboard và báo cáo

### Công việc

- Danh sách đến hạn, sắp đến hạn và quá hạn.
- Lịch sử theo chi nhánh.
- Báo cáo điểm và lỗi nghiêm trọng.
- Báo cáo nhân viên theo tháng.
- Nhận diện lỗi lặp theo nhân viên và tiêu chí trong 30 ngày.
- Chuẩn bị RPC tổng hợp khi khối lượng dữ liệu tăng.

### Điều kiện hoàn thành

- Báo cáo không tự quy lỗi cửa hàng cho nhân viên.
- Nhân viên ít lượt kiểm tra được cảnh báo là chưa đủ dữ liệu.
- Bộ lọc tháng và chi nhánh trả kết quả nhanh, không tải toàn bộ dữ liệu thô.

## Phase 5 — Pilot và ổn định

- Chạy thử tại 1–2 cửa hàng qua ít nhất hai vòng kiểm tra.
- Hiệu chỉnh checklist và điểm phạt bằng dữ liệu thực tế.
- Kiểm tra tải ảnh trên mạng di động.
- Kiểm tra tiếng Việt, quyền truy cập và các tình huống bỏ dở.
- Chỉ công bố toàn hệ thống sau khi checklist phiên bản 2 được duyệt.

## Phase 6 — Supervisor và app nhân sự

- Tạo tài khoản supervisor.
- Phân quyền supervisor theo chi nhánh.
- Liên kết hồ sơ nhân viên với tài khoản khi cần.
- Mở rộng sang xếp ca, chấm công, nghỉ phép, đào tạo và đánh giá.
- Dữ liệu lương, hợp đồng và giấy tờ phải có phân quyền riêng, không gộp vào bảng checklist.

## Rủi ro và cách xử lý

| Rủi ro | Mức độ | Cách xử lý |
|---|---|---|
| Khóa chi nhánh hiện tại không đồng nhất | Cao | Audit schema/data trước khi tạo khóa ngoại |
| Checklist thay đổi làm sai lịch sử | Cao | Phiên bản bất biến và snapshot khi tạo phiếu |
| Gắn sai lỗi cho nhân viên | Cao | Chỉ trừ điểm khi chọn đích danh, bắt buộc ảnh/ghi chú với lỗi nặng |
| Ảnh làm tăng dung lượng và tải chậm | Trung bình | Nén phía client, bucket private, thumbnail và giới hạn kích thước |
| Dashboard tạo nhiều truy vấn | Trung bình | Index đúng bộ lọc, phân trang và RPC tổng hợp khi cần |
| Phạm vi mở rộng quá sớm sang HR | Trung bình | Hoàn tất MVP checklist trước; hồ sơ nhân viên chỉ giữ dữ liệu nền cần thiết |

## Quy tắc chuyển phase

Mỗi phase chỉ được chuyển trạng thái hoàn thành khi:

1. Các điều kiện hoàn thành đã được kiểm tra.
2. Build liên quan chạy thành công.
3. Không phát hiện ảnh hưởng tới luồng hiện tại.
4. Có báo cáo file mới, file cập nhật, hạn chế còn lại và đề xuất phase kế tiếp.
