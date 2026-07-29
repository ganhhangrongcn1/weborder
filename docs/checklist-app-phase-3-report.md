# Báo cáo GHR Checklist - Phase 3

## Kết quả

Đã bổ sung trang kiểm tra thực địa độc lập tại `/giamsat`, dùng chung Supabase Auth hiện tại nhưng có cổng phân quyền riêng.

- Chọn chi nhánh trước khi bắt đầu.
- Chỉ Admin hoặc tài khoản có quyền `supervisor` mới truy cập được.
- Danh sách nhân viên tự lọc theo chi nhánh.
- Chọn linh hoạt những nhân viên đang có mặt.
- Chấm từng tiêu chí: Đạt, Cần cải thiện, Không đạt hoặc Không áp dụng.
- Gắn lỗi cho một hoặc nhiều nhân viên liên quan.
- Ghi chú và chụp ảnh trực tiếp từ điện thoại.
- Tự lưu từng câu trả lời thành bản nháp.
- Có thể mở lại biên bản đang làm dở.
- Bắt buộc đủ câu trả lời và ảnh theo quy tắc trước khi hoàn tất.
- Tự tính điểm, xếp loại, lỗi nghiêm trọng và ngày kiểm tra tiếp theo.

## Logic điểm

- Đạt: nhận 100% trọng số.
- Cần cải thiện: nhận 50% trọng số.
- Không đạt: nhận 0% trọng số.
- Không áp dụng: loại khỏi mẫu số.
- Không đạt một tiêu chí nghiêm trọng: biên bản bị xếp Không đạt.
- Vi phạm nhân viên lặp lại cùng tiêu chí trong 30 ngày được tăng hệ số phạt 0,25 mỗi lần, tối đa cộng thêm 1,5 lần.

## An toàn dữ liệu

- Ảnh lưu trong bucket riêng tư `checklist-evidence`, tối đa 6 MB.
- RPC chạy theo quyền người đăng nhập, không dùng `security definer`.
- Chỉ người có quyền với chi nhánh mới được tạo hoặc cập nhật biên bản.
- Biên bản đã hoàn tất không thể sửa câu trả lời.

## Kiểm tra hoàn tất

- Build production và kiểm tra UTF-8 thành công.
- Route `/supervision` tải đúng trên màn hình điện thoại, không tràn ngang và không có lỗi console.
- Smoke test Supabase đã chạy trọn giao dịch: tạo biên bản, lưu đủ 37 câu trả lời, kiểm tra ảnh bắt buộc, hoàn tất và nhận kết quả 100 điểm.
- Toàn bộ dữ liệu smoke test được rollback, không để lại biên bản giả trên hệ thống.

## Phase tiếp theo đề xuất

Phase 4: báo cáo và tổng kết tháng.

- Lịch sử kiểm tra theo chi nhánh.
- Báo cáo điểm cửa hàng theo tuần/tháng.
- Bảng điểm nhân viên theo tháng.
- Top lỗi lặp lại và nhân viên cần đào tạo.
- Theo dõi tình trạng khắc phục sau kiểm tra.
