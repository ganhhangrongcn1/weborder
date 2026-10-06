# Tối ưu Supabase đợt 6 — 06/10/2026

## Đã áp dụng

Migration live `20261006082341_remove_duplicate_orders_created_at_index` bỏ đúng một chỉ mục dư `public.idx_orders_created_at`. Giữ `public.orders_created_at_desc_idx` phục vụ đọc đơn theo ngày.

Hai chỉ mục cùng btree(created_at DESC), indkey=25, indclass=3127, collation=0, indoption=3; không expression/predicate/INCLUDE/reloptions, cùng bảng/access method/tablespace/persistence. Không unique, primary key, replica identity, constraint, dependency hoặc partition inheritance.

Tại thời điểm kiểm tra, bản bỏ có idx_scan=0 và kích thước 745.472 byte; bản giữ có 1.515.791 lượt scan. Số scan là tích lũy trong khoảng thống kê hiện tại, không chứng minh lịch sử toàn đời. Cơ sở an toàn là định nghĩa trùng và chỉ mục tương đương còn valid/ready/live.

Giảm một cấu trúc chỉ mục phải duy trì khi thêm/xóa/cập nhật khóa của đơn. Không đổi dữ liệu đơn, thanh toán, công thức điểm, thân hàm, quyền/RLS hoặc frontend.

## Khóa và hoàn tác

Migration lấy ACCESS EXCLUSIVE bằng NOWAIT: nếu bảng đang có thao tác xung đột, dừng ngay; không xếp hàng chờ khóa. Nếu lấy được, đọc/ghi mới bị chặn trong transaction rất ngắn chỉ gồm kiểm tra catalog và DROP. statement_timeout 5s giới hạn statement. Đây không phải bảo đảm tuyệt đối không có độ trễ.

Guard kiểm tra cấu trúc và chỉ mục còn lại, tránh xóa nhầm nếu schema đã thay đổi; DROP RESTRICT, không CASCADE. Backup định nghĩa nằm trong .local-backups, không phải backup toàn database.

Rollback tạo lại đúng định nghĩa bằng CREATE INDEX CONCURRENTLY ngoài transaction. Việc tạo lại không phục hồi OID/thống kê/vật lý cũ, và phải kiểm tra valid/ready/live sau khi chạy. Nếu một lần tạo concurrent thất bại, IF NOT EXISTS không sửa được index invalid.

Nguồn về khóa và giới hạn concurrent: [PostgreSQL 17 DROP INDEX](https://www.postgresql.org/docs/17/sql-dropindex.html).

## Kiểm tra sau sửa

- Chỉ mục dư không còn; chỉ mục giữ vẫn OID 2096496, valid/ready/live, định nghĩa không đổi.
- EXPLAIN không ANALYZE của truy vấn đơn theo ngày vẫn dùng orders_created_at_desc_idx.
- Dashboard RPC bốn tham số, DB owner, trong read-only transaction timeout 3s trả 1 dòng.
- Advisor performance không còn báo duplicate index trên orders. Bốn nhóm chỉ mục trùng khác vẫn còn, chưa sửa theo cảnh báo hàng loạt: [hướng dẫn cảnh báo](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index).
- Supabase AI phản biện và xác nhận giới hạn khóa/thống kê/rollback; Codex kiểm tra độc lập.
- Build workspace đạt, encoding 656 file, 5259 modules; không phát hành lại frontend/Android.

Chưa đo CPU/latency dưới tải thực, chưa kiểm tra bằng session admin ứng dụng. RPC DB owner không chứng minh mọi vai trò vận hành.

## Phương án chưa áp dụng

Rà get_customer_order_point_statuses: có 100 HTTP200 và 3 HTTP500 trong snapshot log 24h. Có thể tiền giới hạn đơn trước khi tính ledger, nhưng nhóm phone nguyên văn lớn nhất hiện chỉ 94 web/33 partner, không nhóm vượt 200. Nhóm chuẩn hóa phone có thể khác, nên đây không phải chứng minh tuyệt đối. Lợi ích hiện chưa rõ, không đổi hàm hoặc phone predicate.

Khoảng 7 ngày trong hàm là CASE hết hạn điểm đối tác, không phải lọc ledger; mọi luật điểm được giữ nguyên. EXPLAIN là ước lượng, không benchmark.

## File mới

- supabase/migrations/20261006082341_remove_duplicate_orders_created_at_index.sql
- docs/supabase-sql/2026-10-06-orders-duplicate-index-validation.sql
- docs/supabase-sql/2026-10-06-orders-duplicate-index-rollback.sql
- docs/supabase-optimization-phase6-2026-10-06.md
- docs/supabase-optimization-roadmap-2026-10-06.md
- docs/supabase-optimization-phase6-ai-2026-10-06.jpg (chỉ lưu cục bộ)

Không có file frontend/Android cập nhật. Người dùng không cần chạy SQL, cài POS hoặc thao tác Vercel.
