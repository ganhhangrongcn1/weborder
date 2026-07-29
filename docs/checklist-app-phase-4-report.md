# Báo cáo GHR Checklist - Phase 4

## Kết quả

Phase 4 bổ sung báo cáo quản trị trực tiếp trong hai mô-đun Admin hiện có.

### Quản lý giám sát

- Tab Tổng quan: lượt kiểm tra, điểm trung bình, số biên bản không đạt và lỗi nghiêm trọng.
- Kết quả theo từng chi nhánh, ưu tiên chi nhánh điểm thấp.
- Tab Lịch sử kiểm tra: mã biên bản, nhân viên có mặt, điểm, số vấn đề và số ảnh.
- Tab Lịch kiểm tra: chưa từng kiểm tra, quá hạn, đến hạn hôm nay hoặc sắp đến hạn.
- Tab Cấu hình checklist giữ nguyên chức năng Phase 2.
- Bộ lọc khoảng ngày và chi nhánh.

### Quản lý nhân sự

- Tab Danh sách nhân viên giữ nguyên chức năng Phase 2.
- Tab Đánh giá tháng: nhân viên được đánh giá, điểm trung bình, tổng vi phạm và lỗi lặp lại.
- Bảng điểm chuẩn hóa theo số lần nhân viên có mặt trong biên bản.
- Chi tiết tối đa 5 lỗi thường gặp của từng nhân viên.
- Bộ lọc tháng và chi nhánh.

## Hiệu năng và phân quyền

- Báo cáo được tổng hợp bằng hai RPC Supabase, không tải toàn bộ câu trả lời về trình duyệt.
- RPC chạy theo quyền người gọi, không dùng `security definer`.
- Chỉ Admin được xem báo cáo Phase 4.
- Số liệu lấy từ biên bản `submitted`, không dùng localStorage.

## Kiểm tra

- Migration `20260729034204` đã áp dụng trên Supabase.
- Smoke test hai RPC thành công bằng quyền authenticated Admin.
- Audit xác nhận anon không có quyền gọi RPC.
- Build production và kiểm tra UTF-8 thành công.

## Phase tiếp theo đề xuất

Phase 5: khắc phục và cảnh báo.

- Tạo nhiệm vụ khắc phục từ lỗi trong biên bản.
- Giao người chịu trách nhiệm và hạn xử lý.
- Theo dõi trạng thái mở, đang làm, hoàn tất và xác minh.
- Cảnh báo cửa hàng quá hạn kiểm tra hoặc quá hạn khắc phục.
