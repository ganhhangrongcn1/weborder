# Tiến độ tối ưu Supabase — 06/10/2026

## Ước lượng hiện tại: khoảng 45–50%

Đây là ước lượng phạm vi công việc hiện đã rà soát, không phải phần trăm giảm tải hoặc tốc độ. Chưa có danh mục tối ưu đóng kín cho toàn ứng dụng; các phát hiện mới có thể làm thay đổi mẫu số.

Sáu nhóm công việc bên dưới được phân trọng số để việc báo tiến độ có cơ sở rõ hơn. Đây là cách ước lượng mới, không phải kế hoạch phần trăm đã cam kết từ đầu. Tổng điểm hoàn thành hiện khoảng 48/100 sau đợt 7.

| Nhóm | Trọng số | Hoàn thành ước lượng | Căn cứ |
|---|---:|---:|---|
| Refresh/cache frontend | 15 | 15 | Hai phần đã triển khai production, test hook/service đạt |
| Truy vấn/chỉ mục chính | 30 | 23 | Analytics, customer count, rule cardinality, dashboard và ba index trùng đã sửa; còn workload khác |
| Lỗi vận hành | 15 | 5 | Sửa NULL-name; lỗi column/permission/cancellation còn cần xác định từng caller |
| Tải Realtime | 10 | 0 | Đã rà ban đầu, chưa thay subscription và chưa đo fan-out |
| Quyền truy cập/RLS | 15 | 2 | Có audit và đường gọi cần giữ; chưa áp dụng thu hẹp quyền khi thiếu ma trận vai trò thật |
| Kiểm chứng vận hành/đo hiệu quả | 15 | 3 | Fixture, bounded real snapshots và RPC đạt; còn session thật, latency/error-rate sau sửa |

## Đã hoàn thành

Frontend commit 4d18853 đã production. Tám migration live: UUID join analytics, filter-before-status customer count, ROWS1 rule, active-period dashboard, empty-name profile fix và ba migration bỏ index trùng orders/order_items/partner_orders. Năm migration đầu cùng validation/rollback đã lưu GitHub commit1395a9c; đợt 6 đã lưu commit9b525a4 trên nhánh tối ưu riêng.

Giữ nguyên công thức tích điểm/nhận điểm, điều kiện hết hạn, source of truth ledger/accounts, checkout, thanh toán và nhận đơn POS/Kitchen. Đợt 5 sửa biểu thức tên trong profile RPC; đợt 6–7 chỉ bỏ ba index vật lý dư.

## Thứ tự tiếp theo

1. Xác định bảng/cột/caller của các lỗi còn lại bằng log đã loại thông tin khách; không sửa theo mã lỗi chung.
2. Kiểm tra từng nhóm index trùng còn lại; ưu tiên non-unique, không constraint/dependency và có bản tương đương đang dùng. Không xóa hàng loạt.
3. Đo và giới hạn Realtime/refresh theo domain/chi nhánh khi đủ bằng chứng; bảo toàn queue, debounce và đường nhận đơn.
4. Kiểm tra ma trận customer/staff/kitchen/admin trước khi thay quyền/RLS.
5. Đối chiếu thao tác thật và đo thời gian/lỗi sau sửa để kết luận hiệu quả.

Không tuyên bố đã giảm 45–50% CPU, chi phí hoặc độ trễ. Không cần cài lại POS hay phát hành frontend cho các SQL vừa áp dụng.
