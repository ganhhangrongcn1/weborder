# Tối ưu Supabase đợt 3 — 06/10/2026

Đã áp dụng migration 20261006075728_correct_loyalty_rule_row_estimate trên weboder / qjaklysckgzdfjthzkzu.

## Nguyên nhân và thay đổi

public.get_loyalty_order_rule() là hàm PL/pgSQL trả bảng, đọc app_configs với id ghr_loyalty rồi RETURN NEXT duy nhất. Không có vòng lặp, nhánh trả sớm hay RETURN QUERY. Khi thành công luôn trả một dòng, kể cả thiếu cấu hình vì dùng giá trị mặc định.

Metadata prorows trước là 1000. Customer count CROSS JOIN rule nên planner ước lượng tập trung gian lớn hơn thực tế. Đã đổi duy nhất ROWS 1 bằng ALTER FUNCTION. Không sửa nội dung hàm, cấu hình điểm, dữ liệu hoặc quyền.

Theo [PostgreSQL 17 — ALTER FUNCTION](https://www.postgresql.org/docs/17/sql-alterfunction.html), ROWS thay đổi số dòng ước lượng, không giới hạn số dòng trả về.

## Kiểm chứng

- Trước: rule trả một dòng; summary phone NULL trả các tổng bằng 0.
- Sau: role authenticated đọc rule vẫn một dòng và summary NULL vẫn các tổng bằng 0.
- Body hash giữ nguyên: 1d54b15c0f6571f71193397405eadf73.
- ACL, SECURITY INVOKER, STABLE và proconfig NULL giữ nguyên.
- EXPLAIN toàn thân customer count với cùng phone giả, không ANALYZE: rule Plan Rows 1000 → 1, total estimated cost 8800.96 → 5172.97.
- Đây là cải thiện độ chính xác ước lượng. Chưa chứng minh phần trăm giảm latency/CPU hoặc hết timeout khi tải đồng thời.
- Catalog nhận diện hai caller: get_customer_order_count_summary và claim_partner_order_points. Caller claim dùng SELECT INTO hai giá trị rule. Không gọi thử claim hoặc ghi điểm production.
- Migration có body-hash guard, kiểm tra rows cũ, lock_timeout 2s và statement_timeout 5s. Có tệp hoàn tác riêng trả ROWS 1000.
- Build workspace thành công (5259 modules); kiểm tra UTF-8 thành công (656 file src). Không triển khai lại frontend từ các thay đổi có sẵn trong workspace.
- Supabase AI đã phản biện phạm vi mọi caller và rủi ro plan thay đổi. Codex đã sửa nhận định của AI rằng thiếu config có thể trả 0 dòng: thân hàm hiện tại vẫn RETURN NEXT với defaults.

## Phạm vi và giới hạn

Không đổi frontend, Android, checkout, POS, Kitchen, RLS hay grants. Không cần triển khai lại Vercel/cài POS. Không thử giao dịch nhận điểm thật. Nếu thân hàm sau này được đổi để trả nhiều dòng, phải cập nhật ROWS tương ứng. Nếu xuất hiện regression, hoàn tác riêng metadata bằng tệp rollback có guard.

## File mới

- supabase/migrations/20261006075728_correct_loyalty_rule_row_estimate.sql
- docs/supabase-sql/2026-10-06-loyalty-rule-estimate-validation.sql
- docs/supabase-sql/2026-10-06-loyalty-rule-estimate-rollback.sql
- docs/supabase-optimization-phase3-2026-10-06.md
- docs/supabase-optimization-phase3-ai-2026-10-06.jpg

Không có file frontend/Android cập nhật. Migration đã ghi nhận trên Supabase; các file báo cáo/migration này được lưu ở workspace, chưa commit/push. Người dùng chưa cần thao tác gì.
