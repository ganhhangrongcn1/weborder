# Tiến độ tối ưu Supabase — 06/10/2026

## Ước lượng hiện tại: khoảng 55–60%

Đây là ước lượng phạm vi công việc hiện đã rà soát, không phải phần trăm giảm tải hoặc tốc độ. Chưa có danh mục tối ưu đóng kín cho toàn ứng dụng; các phát hiện mới có thể làm thay đổi mẫu số.

Sáu nhóm công việc bên dưới được phân trọng số để việc báo tiến độ có cơ sở rõ hơn. Đây là cách ước lượng, không phải kế hoạch phần trăm đã cam kết từ đầu. Tổng điểm hiện khoảng 56/100 sau đợt 12 và kiểm tra preview. Phần mã mới đã kiểm thử nhưng chưa triển khai production; không quy đổi commit thành phần trăm hiệu năng.

| Nhóm | Trọng số | Hoàn thành ước lượng | Căn cứ |
|---|---:|---:|---|
| Refresh/cache frontend | 15 | 15 | Hai phần đầu đã production; CRM/dashboard/business session-cache có test và preview, chưa production |
| Truy vấn/chỉ mục chính | 30 | 23 | Analytics, customer count, rule cardinality, dashboard và ba index trùng đã sửa; còn workload khác |
| Lỗi vận hành | 15 | 7 | Sửa NULL-name, tránh CRM fallback nhầm và cache race; lỗi live còn cần xác định từng caller |
| Tải Realtime | 10 | 0 | Đã rà ban đầu, chưa thay subscription và chưa đo fan-out |
| Quyền truy cập/RLS | 15 | 3 | Audit và script staging có guard/test; chưa chạy role matrix thật, chủ dự án tạm bỏ staging |
| Kiểm chứng vận hành/đo hiệu quả | 15 | 8 | Fixture/bounded snapshots, 46 kiểm thử giả lập đạt; preview đúng SHA đã đăng nhập admin và tải báo cáo; còn đổi phiên thật, đối chiếu số liệu, đo latency/error-rate |

## Đã hoàn thành

Frontend commit 4d18853 đã production. Tám migration live: UUID join analytics, filter-before-status customer count, ROWS1 rule, active-period dashboard, empty-name profile fix và ba migration bỏ index trùng orders/order_items/partner_orders. Năm migration đầu cùng validation/rollback đã lưu GitHub commit1395a9c; đợt 6 đã lưu commit9b525a4 trên nhánh tối ưu riêng.

Giữ nguyên công thức tích điểm/nhận điểm, điều kiện hết hạn, source of truth ledger/accounts, checkout, thanh toán và nhận đơn POS/Kitchen. Đợt 5 sửa biểu thức tên trong profile RPC; đợt 6–7 chỉ bỏ ba index vật lý dư.

## Thứ tự tiếp theo

Preview commit `218d02edb9530434885d22a1bff9a6a9d5e319b5` đã READY: `https://weborder-8uuj5fpen-ganhhangrong1992-3578s-projects.vercel.app/admin`. Chủ dự án đã đăng nhập admin; dashboard, analytics, CRM và panel chẩn đoán hiển thị. Chưa xác nhận logout/đổi user thật: logout source không truyền scope nên cần tránh ảnh hưởng phiên khác. Chưa promote/deploy production. Các phần mới ở đợt 8–12 gồm diagnostics cục bộ, guard/test ma trận quyền, CRM fallback/race và session cache ba báo cáo.

Ưu tiên hiện tại: hoàn tất kiểm tra bộ lọc báo cáo và đổi tài khoản bằng tài khoản thử riêng trước khi phát hành. Đã kiểm tra hiển thị báo cáo với phiên admin thật; chưa bấm đăng xuất vì phạm vi mặc định có thể ảnh hưởng thiết bị khác. Sau đó mới đo workload trong cùng cửa sổ thời gian. Quyền/hoàn điểm giữ ngoài phạm vi triển khai theo lựa chọn tạm bỏ staging của chủ dự án.

1. Xác định bảng/cột/caller của các lỗi còn lại bằng log đã loại thông tin khách; không sửa theo mã lỗi chung.
2. Kiểm tra từng nhóm index trùng còn lại; ưu tiên non-unique, không constraint/dependency và có bản tương đương đang dùng. Không xóa hàng loạt.
3. Đo và giới hạn Realtime/refresh theo domain/chi nhánh khi đủ bằng chứng; bảo toàn queue, debounce và đường nhận đơn.
4. Kiểm tra ma trận customer/staff/kitchen/admin trước khi thay quyền/RLS.
5. Đối chiếu thao tác thật và đo thời gian/lỗi sau sửa để kết luận hiệu quả.

Không tuyên bố đã giảm 55–60% CPU, chi phí hoặc độ trễ. Không cần cài lại POS cho các SQL đã áp dụng; các thay đổi frontend đợt 8–12 cần phát hành và tải lại trang mới có hiệu lực.
