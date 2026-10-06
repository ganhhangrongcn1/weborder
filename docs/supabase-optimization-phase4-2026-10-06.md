# Tối ưu Supabase đợt 4 — 06/10/2026

## Đã áp dụng

Migration live: 20261006080610_filter_dashboard_active_periods trên weboder / qjaklysckgzdfjthzkzu.

Hàm get_admin_dashboard_summary(timestamptz,timestamptz,text,text) phục vụ dashboard có lọc chi nhánh. Frontend adminDashboardService đã được đối chiếu: gọi tham số ngày và branch name/UUID của overload này.

Khi xem một ngày, hàm trước đọc toàn khoảng liên tục từ mốc so sánh sớm nhất đến ngày hiện tại, gồm nhiều ngày nằm giữa các kỳ nhưng không dùng trong đầu ra. Các dòng này vẫn bị xử lý phone/channel/status/doanh thu và đưa vào unified_orders.

Thay đổi duy nhất: thêm EXISTS membership vào ba kỳ current/previous/week ở WHERE của orders và partner_orders. Giữ bộ lọc khoảng thời gian thô để dùng index hiện có. EXISTS không nhân bản đơn khi các kỳ chồng nhau. Giữ nguyên CASE, phép tính tiền/khách/trạng thái, bộ lọc chi nhánh và thứ tự JSON đầu ra.

## Bằng chứng

- 12 đối chiếu toàn bộ 6 cột đầu ra trên fixture 501 web + 501 partner orders, 30 profiles: tất cả bằng nhau.
- Bao gồm 1/7/30 ngày, branch name, UUID, cả hai, NULL bounds, zero range, reversed range, giờ lẻ, mốc biên, status NULL/tiếng Việt và partner order_time NULL dùng created_at.
- Hai đối chiếu full-output trên dữ liệu thật trong repeatable-read, timeout 3s: một ngày tất cả chi nhánh và một ngày một chi nhánh đều bằng nhau. Không xuất PII hoặc doanh thu vào kết quả kiểm tra.
- Snapshot 06/10/2026 cho ngày 06/10: khoảng thô 2.505 đơn; ba kỳ thực sự dùng 723 đơn. Đây là số dòng nguồn trung gian, không phải số đơn bán trong riêng ngày.
- EXPLAIN không ANALYZE cùng literal: unified_orders ước tính 4.333 → 481 dòng, total cost 9366.72 → 3406.91; thêm hai semi-join trước projection và giữ index ngày hiện có.
- Range scan vẫn có thể đọc toàn khoảng thô. Không tuyên bố giảm index visits; lợi ích kỳ vọng là giảm xử lý và giữ dòng trung gian không dùng.
- Sau áp dụng: actual RPC đối chiếu toàn thân SQL cũ trong snapshot cùng ngày cho kết quả bằng nhau; gọi thực bằng connector/DB owner trả 1 dòng.
- OID 2237443, owner postgres, STABLE, SECURITY INVOKER, search_path rỗng và ACL giữ nguyên.
- Hash trước: 87ad04bf021962524130a5d527add611.
- Hash sau: d460c5236edbbda2ab73e8fbdcd98533.
- Build workspace thành công (5259 modules), UTF-8 src đạt kiểm tra (656 file). Không triển khai lại frontend từ các thay đổi có sẵn trong workspace.

## Giới hạn

Chưa đo latency/CPU dưới tải đồng thời hoặc kiểm tra qua session admin thật. Gọi bằng connector không chứng minh toàn bộ quyền của admin/customer/nhân viên. Bộ lọc chỉ phục vụ các consumer hiện có của unified_orders; nếu sau này thêm consumer dùng ngày ngoài ba kỳ thì phải cập nhật bộ lọc.

Lợi ích rõ nhất ở kỳ ngắn có gap giữa các kỳ. Kỳ dài chồng nhau có thể không loại được dòng nào và vẫn có chi phí kiểm tra membership. Fixture kỳ 7/30 ngày xác nhận kết quả, không phải benchmark runtime.

Không thay đổi hàm tích điểm/nhận điểm, đơn, thanh toán, POS, Kitchen, profiles grants hoặc RLS. Overload dashboard hai tham số được giữ nguyên vì caller hiện dùng overload bốn tham số. Không thay frontend/Android và không cần triển khai lại Vercel/cài POS.

## An toàn và hoàn tác

Backup definition trước sửa trong .local-backups. Migration thay đúng hai đoạn trên definition hiện tại, có hash guard, lock_timeout 2s và statement_timeout 5s. Tệp rollback chỉ đảo hai bộ lọc nếu hash đúng phiên bản mới; không ghi đè một sửa đổi mới hơn.

Supabase AI đã phản biện overlap, khoảng nửa mở, NULL/timezone và mức độ bằng chứng. Codex làm kiểm chứng độc lập rồi áp dụng; AI không thực thi SQL thay đổi.

## File mới

- supabase/migrations/20261006080610_filter_dashboard_active_periods.sql
- docs/supabase-sql/2026-10-06-dashboard-period-validation.sql
- docs/supabase-sql/2026-10-06-dashboard-period-rollback.sql
- docs/supabase-optimization-phase4-2026-10-06.md
- docs/supabase-optimization-phase4-ai-2026-10-06.jpg
- Backup local: .local-backups/supabase-optimization-20261006/get_admin_dashboard_summary.before.sql

Không có file frontend/Android cập nhật. Migration đã ghi trên Supabase; các file SQL/báo cáo mới còn ở workspace, chưa commit/push.

Người dùng chưa cần thao tác gì. Nếu số liệu báo cáo sai hoặc chậm hơn, hoàn tác riêng migration này và đối chiếu một kỳ/chi nhánh cụ thể, giữ đường nhận đơn đang chạy.
