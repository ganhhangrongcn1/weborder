# Đặc tả Dashboard Checklist - Phase 4

**Chủ sở hữu:** Quản lý vận hành Gánh Hàng Rong  
**Ngày:** 2026-07-29  
**Trạng thái:** Đang triển khai

## Mục đích

Dashboard giúp quản lý trả lời hai câu hỏi:

1. Cửa hàng nào đang vận hành chưa đạt hoặc đã đến hạn kiểm tra lại?
2. Nhân viên nào có vi phạm lặp lại và cần được hướng dẫn trong tháng?

Đối tượng chính là Admin/quản lý vận hành, sử dụng hằng ngày hoặc hằng tuần trên desktop và điện thoại.

## Cấu trúc thông tin

### Quản lý giám sát

- KPI: số lượt kiểm tra, điểm trung bình, lượt không đạt, lỗi nghiêm trọng.
- Chẩn đoán: kết quả theo từng chi nhánh.
- Hành động: danh sách chi nhánh đến hạn/quá hạn.
- Chi tiết: lịch sử từng biên bản.
- Bộ lọc: khoảng ngày và chi nhánh.

### Quản lý nhân sự

- KPI: nhân viên được đánh giá, điểm trung bình, tổng vi phạm, vi phạm lặp lại.
- Chẩn đoán: bảng điểm nhân viên trong tháng.
- Chi tiết: các lỗi xuất hiện nhiều nhất của từng nhân viên.
- Bộ lọc: tháng và chi nhánh.

## Định nghĩa chỉ số

| Chỉ số | Định nghĩa | Nguồn | Làm mới |
|---|---|---|---|
| Lượt kiểm tra | Số biên bản trạng thái `submitted` trong kỳ | `checklist_inspections` | Thời gian thực khi tải trang |
| Điểm trung bình | Trung bình `score` của biên bản đã hoàn tất | `checklist_inspections` | Thời gian thực khi tải trang |
| Không đạt | Biên bản có `rating = Không đạt` | `checklist_inspections` | Thời gian thực khi tải trang |
| Đến hạn | `next_inspection_due_on <= current_date` | `checklist_inspections`, `branches` | Hằng ngày |
| Điểm nhân viên | `100 - (tổng điểm phạt / số lần có mặt) × hệ số 5`, tối thiểu 0 | participants, answer employees | Thời gian thực khi tải trang |
| Vi phạm lặp lại | Cùng nhân viên và tiêu chí xuất hiện từ lần thứ hai trong kỳ | answers, answer employees | Thời gian thực khi tải trang |

## Quyền và dữ liệu

- Chỉ tài khoản Admin đọc được báo cáo tổng hợp trong `/admin/`.
- RPC dùng quyền người gọi và giữ nguyên RLS.
- Không tải toàn bộ câu trả lời/ảnh về trình duyệt để tính toán.
- Số liệu truy vấn trực tiếp từ Supabase, không dùng localStorage làm nguồn chuẩn.

## Tiêu chí nghiệm thu

- Mỗi dashboard có tối đa 4 KPI chính.
- Có thể lọc theo thời gian và chi nhánh.
- Số liệu khớp với biên bản đã hoàn tất.
- Danh sách đến hạn thể hiện hành động cần xử lý.
- Bảng nhân viên mở được chi tiết lỗi lặp lại.
- Build production và kiểm tra UTF-8 thành công.
