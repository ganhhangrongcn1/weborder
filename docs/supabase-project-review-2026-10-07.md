# Rà tổng thể — vòng 1, 07/10/2026

Đây là kiểm tra metadata toàn DB và rà source/kiểm thử một số đường chính, chưa phải kiểm chứng từng thao tác của toàn dự án. Project qjaklysckgzdfjthzkzu. Không DDL/DML, không thay RLS, không gọi thanh toán/claim/refund, không đổi worker hoặc xóa file production. Frontend đợt 8–15 ở nhánh thử; không coi push/build là production.

## Snapshot chỉ đọc

Log Postgres mặc định 24 giờ tại thời điểm kiểm tra: 42501=227; 42703=74; 57014=23; P0001=7; 23502=3; 42883=2; 40P01=2. Đây là số sự kiện, không phải đơn lỗi duy nhất. Không xuất query thô/PII. Không so sánh trực tiếp với cửa sổ khác để tuyên bố giảm lỗi.

Advisor performance: 85 FK thiếu index, 92 index unused, 113 multiple permissive policies, 2 nhóm duplicate, 4 auth initplan, 10 bảng không PK. Đây là ứng viên kiểm tra, không phải danh sách cần xóa/tạo index. Advisor security: 31 bảng RLS không policy, 19 function search_path mutable, 11 function anon/20 authenticated SECURITY DEFINER executable. Không coi thiếu policy server/private là cần mở quyền.

Nguồn hướng dẫn: [FK index](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [index unused](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), [policy](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), [function quyền](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

pg_stat_statements: top query fingerprint 5976230070775549084 có 12.730.423 calls/mean7,26ms; fingerprint -7006697586435768560 có 4.854 calls/mean2044,09ms và 3.504.920 temp blocks. Chỉ đọc counters, không xuất SQL text, không reset stats. Không gán query ID mới vào caller chỉ dựa trên lịch sử; counters tích lũy không đại diện sau sửa.

Top table sizes gồm partner_orders 141.189.120 bytes, cron.job_run_details 136.986.624, partner_order_items 67.870.720. n_live_tup/n_dead_tup là estimates; không coi dead tuples là dữ liệu rác và không VACUUM FULL/xóa lịch sử. Cron log là nhóm retention cần rà riêng trước dọn.

## Phạm vi và gates còn lại

| Nhóm | Bằng chứng hiện có | Còn cần chứng minh |
|---|---|---|
| Web checkout | Mock lưu đơn và giới hạn lợi ích | Luồng thật dưới role khách; không tạo giao dịch production để test |
| Customer/loyalty | Rà classifier RPC; công thức giữ nguyên | Caller của lỗi quyền/cột; claim/refund/idempotency trên môi trường cô lập |
| Admin reports/orders | Cache/session/race mock và preview các đợt trước | Release đúng SHA, bộ lọc/session thật và hiệu quả workload |
| Inventory | Threshold/lot/unit mock | 1 ca quy đổi unit chưa khớp contract; không sửa số lượng theo phỏng đoán |
| POS/Kitchen/print | Inventory source timer/subscription, không thay | Android/device/queue/reconnect/branch và giấy/âm thanh thực |
| Partner/NexPOS/worker | Metadata DB/source inventory, giữ diff dở dang | Caller bên ngoài/n8n, live cancellation/status/reconnect; không chạy worker thứ hai |
| Cake/checklist/review | Schema/advisory và resource inventory | Thao tác nghiệp vụ theo quyền và evidence links |
| Storage/SQL snippets | Kiểm kê Storage đợt 13 | Links external, rollback/retention; Saved SQL Snippets chưa inventory; chưa xóa |

## Sửa nhỏ đợt này

customerOrderCountingRpcService trước đây coi `does not exist` hoặc missing code bất kỳ là RPC đích chưa có, đánh dấu unavailable5 phút. Nay cần đúng tên function đích cùng missing code/thông điệp. Lỗi column/table/nested function/permission không vô hiệu hóa nhầm RPC. Không đổi query, công thức summary/points/gifts, TTL kết quả, return null trên lỗi hoặc fallback nghiệp vụ. Rủi ro: lỗi thật còn tồn tại có thể được gọi lại ở lượt đọc tiếp thay vì bị tắt nhầm; không thêm retry tự động.

5 ca classifier đạt, gồm kiểm tra negative-cache thực và hết hạn 5 phút. Hai RPC liên quan hiện mỗi hàm có một signature, đã xác minh catalog; matcher cuối yêu cầu đồng thời đúng tên function và code 42883/PGRST202. Suite mở rộng 55 ca: 54 đạt/1 chưa đạt ở inventory-unit-conversion (6 vs1200). Hai suite dùng VM phải chạy với --experimental-vm-modules; lỗi startup thiếu flag đã giải quyết, không phải regression nghiệp vụ. Static flow smoke còn báo Admin sidebar vì kỳ vọng class string cũ, hiện component dùng class động; chưa đổi kiểm thử để coi là kiểm chứng UI thật. Build đạt 661 encoding/5264 modules; lint file sửa không lỗi. Không coi toàn bộ suite hoặc toàn dự án đạt.

## Ưu tiên đã trao đổi với Supabase AI

1. Xác định caller/table/column an toàn của 42501/42703, giữ kiểm soát truy cập; không mở grants chỉ để hết lỗi.
2. Hoàn tất kiểm thử các thay đổi đọc/cache và contract unit Kho trên nhánh riêng trước release, không publish diff dở dang.
3. Đo hot paths bằng cùng cửa sổ trước/sau release; chỉ thay index/Realtime/retention từng đối tượng có bằng chứng. Giữ polling/queue/idempotency cho vận hành.

Phần quyền/thanh toán/hoàn điểm tiếp tục cần role matrix và môi trường cô lập, theo lựa chọn trước đó chưa triển khai staging. Không giả vờ đã hoàn tất full audit. File cập nhật: customerOrderCountingRpcService.js. File mới: customer-order-rpc-classifier.test.mjs và báo cáo này. Rollback: hoàn nguyên đúng classifier diff. Chưa deploy production.
