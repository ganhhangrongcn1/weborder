# Đợt 10 — CRM: tránh truy vấn phụ và cache bị ghi đè

## Nguyên nhân

`adminCrmAnalyticsService` coi thông điệp `does not exist` là thiếu RPC. Lỗi thiếu cột/bảng có thể kích hoạt một lần gọi analytics khác dù hàm cached vẫn tồn tại. Các forced refresh chạy đồng thời còn có thể hoàn tất đảo thứ tự: kết quả cũ ghi đè cache mới và finally của request cũ xóa guard của request mới.

## Đã sửa trong mã nguồn

- Chỉ chuyển từ cached RPC sang legacy RPC khi thông điệp gọi đúng tên hàm bị thiếu và mã 42883/PGRST202 hoặc thông báo thiếu hàm đúng dạng. Mã lỗi thiếu hàm nhưng không xác định đúng hàm đích không kích hoạt fallback. Lỗi thiếu cột/quyền/cancellation giữ đường trả null, không gọi thêm analytics.
- Generation bảo đảm chỉ request mới nhất cập nhật cache; finally chỉ xóa promise hiện hành.
- Giữ TTL 60 giây, tham số, mapping, force refresh và fallback khi thực sự thiếu hàm.

## Kiểm chứng và giới hạn

5 nhóm kiểm thử giả lập đạt: missing RPC fallback; 42703/42501/57014/42P01 không gây gọi thêm; kết quả đảo thứ tự; cache và đọc đồng thời; request cũ không xóa guard mới. Build/UTF-8 và lint kiểm tra riêng file thay đổi.

Catalog live xác nhận cached CRM RPC kiểm tra admin/staff và có thể ghi bảng cache qua advisory lock. Vì vậy không coi đây là SELECT thuần và chưa gộp các forced refresh. Không gọi thử RPC thật, không chạy DDL/DML, không thay RLS/thanh toán/tích điểm. Các counter pg_stat_statements đọc lần này vẫn tích lũy; không dùng chúng để tuyên bố giảm tải hoặc latency theo phần trăm.

Generation chỉ bảo vệ cache của service, không tự ngăn UI caller dùng response cũ. Cache hiện tại chưa được tách theo phiên đăng nhập; vấn đề này còn cần rà lifecycle user/client trước một thay đổi riêng. Fallback nay yêu cầu thông điệp nhận diện đúng hàm đích theo phản biện Supabase AI; thông điệp thiếu tên hoặc không đúng dạng sẽ trả null thay vì thử thêm RPC.

## Phản biện và đề xuất tiếp

Đã trao đổi với Supabase AI: ưu tiên xác nhận source trước tối ưu, tách ngữ cảnh user/branch, xử lý response muộn, giữ ý nghĩa force refresh và đo cùng cửa sổ. Sau kiểm tra catalog, chọn sửa fallback và cache race thay vì đổi chính sách forced refresh.

Đề xuất tiếp: rà cache theo phiên đăng nhập cho CRM/dashboard/business analytics; đo số gọi theo endpoint và khoảng thời gian cố định; rà timer trang thống kê khi tab ẩn. Chưa có bằng chứng cần nâng compute hoặc thêm index. Các vấn đề quyền/hoàn điểm vẫn giữ ngoài phạm vi theo lựa chọn của chủ dự án.

## File và phát hành

- Cập nhật `src/services/adminCrmAnalyticsService.js`.
- Mới `scripts/crm-analytics-fallback.test.mjs`, báo cáo này.
- Lưu trên nhánh tối ưu riêng, chưa triển khai production. Hoàn tác bằng revert commit của đợt này.
