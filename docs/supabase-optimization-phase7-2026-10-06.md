# Tối ưu Supabase đợt 7 — 06/10/2026

## Kết quả đã áp dụng

Hai migration độc lập:

- 20261006082836_remove_duplicate_order_items_order_id_index
- 20261006082857_remove_duplicate_partner_order_time_index

Bỏ idx_order_items_order_id, giữ order_items_order_id_idx trên order_items(order_id). Bỏ partner_orders_order_time_idx, giữ partner_orders_order_time_desc_idx trên partner_orders(order_time DESC).

Catalog chứng minh mỗi cặp giống toàn bộ cấu trúc: cùng bảng, btree, key/operator class/collation/order/NULL behavior, natts/nkeyatts, tablespace/persistence/options; không predicate/expression/INCLUDE. Không unique, primary, replica identity, clustered, constraint, incoming dependency hoặc inheritance. Cả bốn valid/ready/live trước sửa.

Index bỏ có scan0 trong kỳ thống kê hiện tại; index giữ có 41.505.181 và 395.003 lượt scan. Không dựa riêng vào scan0 để quyết định. Kích thước hai bản bỏ trước sửa 802.816 + 1.597.440 = 2.400.256 byte, khoảng 2,29 MiB. Đây là snapshot kích thước index, không phải số đo giảm CPU/latency.

Giảm hai cấu trúc chỉ mục phải duy trì khi ghi/cập nhật khóa liên quan. Không đổi dữ liệu đơn/món, công thức điểm, thanh toán, luồng nhận đơn, function body, grants/RLS hoặc frontend.

## An toàn và kiểm chứng

Mỗi migration lấy khóa bảng riêng bằng ACCESS EXCLUSIVE NOWAIT: bận thì dừng ngay, không xếp hàng. Khi lấy được, vẫn chặn truy cập mới trong transaction ngắn; statement_timeout5s. Guard cấu trúc, survivor valid/ready/live, DROP RESTRICT; không CASCADE.

Backup định nghĩa trước sửa nằm trong .local-backups. Rollback tạo lại từng index bằng CREATE INDEX CONCURRENTLY ngoài transaction; phải xác nhận valid/ready/live, không khôi phục OID/thống kê/vật lý cũ. IF NOT EXISTS không sửa index invalid của một lần tạo thất bại.

- Sau mỗi lần sửa: chỉ mục dư không còn, survivor giữ nguyên định nghĩa/OID 122340 và 2096498, valid/ready/live.
- EXPLAIN không ANALYZE query order_id dùng order_items_order_id_idx; query order_time dùng partner_orders_order_time_desc_idx.
- Analytics RPC 4args gọi thực ở kỳ rỗng, DB owner/read-only timeout3s, trả1row sau migration đầu.
- Dashboard RPC 4args gọi thực một ngày, DB owner/read-only timeout3s, trả1row sau migration sau.
- Advisor performance: duplicate-index còn hai nhóm branches và loyalty_ledger; không còn nhóm orders/order_items/partner_orders. Chưa đụng hai nhóm còn lại. [Hướng dẫn cảnh báo](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index).
- Supabase AI phản biện cấu trúc, thống kê, khóa và rollback; kiểm chứng độc lập trước/sau.
- Build đạt, UTF-8 đạt656file, 5259modules. Không triển khai lại frontend/Android.

Chưa benchmark tải đồng thời hoặc kiểm tra qua session admin/customer thật. RPC DB owner không chứng minh quyền của người dùng cuối. Không kết luận mọi lỗi đã hết.

## File mới

- supabase/migrations/20261006082836_remove_duplicate_order_items_order_id_index.sql
- supabase/migrations/20261006082857_remove_duplicate_partner_order_time_index.sql
- docs/supabase-sql/2026-10-06-order-items-duplicate-index-rollback.sql
- docs/supabase-sql/2026-10-06-partner-orders-duplicate-index-rollback.sql
- docs/supabase-sql/2026-10-06-items-partner-duplicate-index-validation.sql
- docs/supabase-optimization-phase7-2026-10-06.md
- docs/supabase-improvement-proposals-2026-10-06.md
- docs/supabase-optimization-phase7-ai-2026-10-06.jpg (chỉ cục bộ)

File cập nhật: docs/supabase-optimization-roadmap-2026-10-06.md. Không có source/frontend/Android sửa trong đợt này.

Người dùng không cần chạy SQL, cài POS hoặc thao tác Vercel.
