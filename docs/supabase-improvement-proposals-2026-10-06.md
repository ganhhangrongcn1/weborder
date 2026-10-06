# Đề xuất cải thiện vận hành — 06/10/2026

Các mục dưới đây là đề xuất, chưa triển khai. Ưu tiên bảo toàn checkout, thanh toán, Kitchen/POS và tích điểm; làm từng bước có kiểm chứng và hoàn tác.

| Ưu tiên | Cải thiện | Lợi ích | Phương án và điều kiện an toàn |
|---|---|---|---|
| Cao | Quyền truy cập đúng vai trò/chi nhánh | Giảm rủi ro xem/sửa dữ liệu ngoài phạm vi | Lập ma trận khách/nhân viên/bếp/admin/backend; kiểm tra cả grants, RLS và RPC; chuẩn bị test cho phép/từ chối trên môi trường thử trước khi thu hẹp quyền live |
| Cao | Chuẩn hóa thông tin truy vết lỗi | Tìm đúng caller/bảng/cột thay vì đoán từ mã lỗi chung | Tận dụng log hiện có; thêm request ID, endpoint, nhóm caller, SQLSTATE và mã lỗi/column theo allowlist; không lưu raw SQL, tham số, token, phone hoặc raw payload |
| Cao | Bộ kiểm thử nghiệp vụ quan trọng | Sửa nhanh hơn mà giảm nguy cơ sai đơn/điểm | Dùng dữ liệu giả trên môi trường thử: checkout/thanh toán, hủy-hoàn, cộng điểm một lần, nhận điểm, hết hạn, phân chi nhánh, nhận đơn và hàng đợi in; không tạo giao dịch thử trên live |
| Vừa | Đo độ trễ và tỷ lệ lỗi theo từng khung thời gian | Biết tối ưu có hiệu quả thật hay không | Baseline theo RPC/caller/time window: số gọi, lỗi500, timeout/SQLSTATE, p50/p95; so trước/sau cùng phạm vi và đủ mẫu; không lấy stats tích lũy hoặc cost planner làm phần trăm cải thiện |
| Vừa | Hoàn thiện màn hình tình trạng vận hành | Quán biết đồng bộ/đơn/in bị chậm trước khi khách phản ánh | Rà chỉ số đang có, bổ sung thời điểm đồng bộ thành công cuối, tuổi đơn chờ xử lý, job in lỗi và nút xem nguyên nhân; UI đọc dữ liệu trạng thái, không tự retry giao dịch hoặc sửa đơn |

## Lưu ý theo từng mục

Quyền: test cả khách A/B, nhân viên đúng/sai chi nhánh, bếp, admin, backend. Session DB owner/service_role không chứng minh quyền người dùng cuối. Cần kiểm tra các đường gọi hợp lệ trước thay quyền; không bật RLS hoặc mở grants hàng loạt chỉ để làm hết lỗi. [Tài liệu RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

Log: request ID dùng tra cứu từng sự kiện, không làm dimension nhóm thống kê vì số lượng giá trị lớn. Thông điệp lỗi tự do có thể chứa dữ liệu khách; lưu mã lỗi và trường được cho phép. Bắt đầu ở đường gọi quan trọng nhất, không thay chính sách lỗi/fallback cùng lúc. [Logs Supabase](https://supabase.com/docs/guides/observability/logs).

Test: ưu tiên kiểm thử kết quả nghiệp vụ và quyền, không chỉ mirror implementation. Quy trình dữ liệu giả/isolated không thay thế kiểm tra giấy in hoặc âm thanh tại quán. Trạng thái printed trong hệ thống chỉ chứng minh phần mềm ghi nhận hoàn tất, không chứng minh giấy đã ra. [Kiểm thử database Supabase](https://supabase.com/docs/guides/database/testing).

Đo: không đặt ngưỡng p95 giả định trước khi có baseline. Chỉ đo endpoint/time window đủ mẫu; thống kê không có dữ liệu phải ghi chưa đủ mẫu, không ghi 0ms hoặc 0lỗi. Chưa thiết lập automation/cảnh báo hay mua dịch vụ mới.

Màn hình vận hành: giữ queue/debounce/guard sẵn có; không để bảng trạng thái mới mở rộng realtime toàn database hoặc gọi lại liên tục. Thiết kế hiển thị ngắn gọn: Bình thường / Chậm / Cần kiểm tra, cùng lần cập nhật cuối.

## Đề xuất làm trước

Trước mắt chuẩn hóa truy vết lỗi và xây ma trận quyền/môi trường kiểm thử. Hai việc này giúp xử lý những lỗi còn lại có căn cứ, rồi mới thay quyền hoặc subscription live. Chưa cần nâng gói database khi chưa có bằng chứng thiếu tài nguyên.

Đánh giá trên dựa vào các đợt kiểm tra hiện có và phản biện Supabase AI; không phải chứng nhận toàn bộ ứng dụng đã được audit.
