# Tối ưu Supabase đợt 2 — 06/10/2026

## Kết quả đã áp dụng

- Project: weboder / qjaklysckgzdfjthzkzu.
- Migration live: 20261006075230_optimize_customer_count_filter_before_status.
- Hàm: public.get_customer_order_count_summary(text).
- Lọc các đơn đối tác khớp khách trước, sau đó mới chuẩn hóa trạng thái và tính tổng.
- CTE matched_partner_orders AS MATERIALIZED giữ đúng predicate OR hai trường phone hiện có. Không UNION nên đơn khớp cả hai trường vẫn chỉ xuất hiện một lần.
- Chỉ chọn các cột cần thiết. Từ raw_data chỉ giữ chuỗi status, không vật hóa toàn bộ JSON.
- Không đổi quy tắc số đơn, số tiền, điểm đã nhận/chờ nhận, thời hạn 7 ngày, phone variants hay ledger.
- Không sửa dữ liệu đơn/điểm, RLS, grants hoặc các luồng checkout, POS, Kitchen.
- Không cần triển khai lại Vercel hoặc cài lại POS cho thay đổi SQL này.

## Bằng chứng và giới hạn

Kế hoạch cũ đặt ba biểu thức chuẩn hóa trạng thái tại Seq Scan partner_orders, trước Join Filter phone. Kế hoạch mới tách lọc phone thành CTE vật hóa; việc chuẩn hóa nằm sau tập đã khớp khách.

EXPLAIN không ANALYZE với cùng phone giả: total cost 12406.45 trước, 8800.96 sau. Đây là ước tính của planner, không phải số đo tốc độ hoặc CPU. Tập vật hóa ước tính 36 dòng, rộng 109 bytes/dòng; không giữ raw_data JSON lớn. Bảng partner_orders vẫn có sequential scan để kiểm tra phone. Không tuyên bố loại bỏ toàn bộ scan hoặc đã hết timeout.

Kiểm chứng bản cuối:
- 6 đối chiếu toàn bộ 5 trường đầu ra trên dữ liệu giả lập: 500 web orders, 500 partner orders, 60 ledger entries.
- Bao gồm phone nội địa/+84/84, khách khác, rỗng, NULL; status tiếng Việt/NULL; phone key NULL hoặc cả hai cột cùng khớp; claimed/pending/rejected/expired; ledger điểm âm.
- 3 đối chiếu trên mẫu dữ liệu thật, trong cùng repeatable-read snapshot: tối đa 1000 web orders + 1000 partner orders + 1000 ledger entries; phone lấy nội bộ từ mẫu, không xuất PII. Giữ rule cấu hình thật.
- Cả 9 đối chiếu đều bằng nhau. Mẫu thật không bao quát toàn lịch sử ledger hay mọi khách.
- Sau áp dụng, gọi RPC thật với role authenticated và phone NULL thành công: 0 đơn, 0 tiền, 0 điểm.
- Build workspace thành công (5259 modules); kiểm tra UTF-8 thành công (656 file src). Không triển khai lại frontend từ workspace có các thay đổi sẵn của người dùng.
- OID 16655, owner postgres, SECURITY INVOKER, STABLE, search_path rỗng và ACL giữ nguyên.
- Hash trước: 7f840bad1c7f216804ce721068765725.
- Hash sau: b8bb52efff9f2ae1275f67e2230874be.

Chưa đo latency/CPU trước-sau trên khách có nhiều đơn hoặc khi tải đồng thời. Không coi thử phone NULL là kiểm chứng toàn bộ quyền của khách thật. Tập khớp lớn vẫn có chi phí vật hóa hoặc spill. Các mảng ledger chỉ dùng cho kiểm tra membership, không xuất ra đầu ra, nên thứ tự array không thay đổi hợp đồng API.

## Phần món bán chạy đã rà soát

EXPLAIN get_customer_popular_products với 30 ngày/12 món dùng các index thời gian, join order-items và product:
- orders_created_at_desc_idx;
- order_items_order_id_idx;
- partner_orders_customer_popular_order_time_idx;
- partner_order_items_partner_order_id_idx;
- products_pkey.

Chưa thấy lỗi truy cập index cụ thể trong kế hoạch này. Giữ nguyên SQL và cache 15 phút đã triển khai đợt trước. Không thêm index, tăng timeout hay nâng compute theo phỏng đoán.

## Phản biện với Supabase AI

AI xác nhận phương án phù hợp với điều kiện giữ predicate/NULL/multiplicity, đồng thời nêu giới hạn mẫu và rủi ro vật hóa. Đã điều chỉnh để không giữ toàn bộ raw_data. AI không áp dụng thay đổi; Codex tự đối chiếu, lưu backup và áp dụng migration có hash guard, lock_timeout 2s, statement_timeout 5s.

Nguồn kỹ thuật: [PostgreSQL 17 — CTE materialization](https://www.postgresql.org/docs/17/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION). Kế hoạch và kết quả kiểm chứng lấy trực tiếp từ project.

## File mới

- supabase/migrations/20261006075230_optimize_customer_count_filter_before_status.sql
- docs/supabase-sql/2026-10-06-customer-count-validation.sql
- docs/supabase-sql/2026-10-06-customer-count-real-validation.sql
- docs/supabase-sql/2026-10-06-customer-count-rollback.sql
- docs/supabase-optimization-phase2-2026-10-06.md
- docs/supabase-optimization-phase2-ai-2026-10-06.jpg
- Backup local: .local-backups/supabase-optimization-20261006/get_customer_order_count_summary.before.sql

File cập nhật: docs/supabase-optimization-2026-10-06.md (thêm kết quả đợt 2). Không đổi file frontend hoặc Android trong đợt này. Các file mới còn ở workspace; migration đã được ghi nhận trong lịch sử Supabase, chưa commit/push các file SQL/báo cáo này.

## Hoàn tác và theo dõi

Tệp rollback chỉ chạy nếu definition đúng hash mới; trả nguyên definition trước thay đổi, không đụng quyền/dữ liệu. Dừng và kiểm tra nếu hash không khớp, không ghi đè một sửa đổi mới hơn.

Nếu thống kê khách sai hoặc chậm hơn sau thay đổi, hoàn tác riêng migration này và đối chiếu một khách cụ thể. Không tắt đường nhận đơn đang chạy. Cần quan sát lỗi RPC/latency vận hành sau triển khai trước khi kết luận hiệu quả định lượng.

Người dùng chưa cần thao tác gì. Thay đổi chỉ tác động các lần đọc thống kê tiếp theo, không làm mới hoặc khởi động lại luồng nhận đơn.
