# Lưu các đợt tối ưu Supabase — 06/10/2026

## Trạng thái vận hành

Frontend tối ưu refresh/cache đã có trên production từ commit 4d18853. Năm migration SQL đã áp dụng trực tiếp trên Supabase và được kiểm chứng theo từng báo cáo. Việc lưu các file này lên nhánh `codex/supabase-safe-optimization-20261006` là lưu lịch sử, kiểm chứng và hoàn tác; không triển khai lại frontend hoặc Android.

Các báo cáo đợt 2–4 có câu “chưa commit/push” mô tả thời điểm hoàn tất từng đợt. Bản lưu này gom các file đã áp dụng, không yêu cầu chạy lại SQL. Không đưa ứng viên analytics cũ, ảnh có thông tin tài khoản, backup local, báo cáo quyền chi tiết hoặc thay đổi POS/kho/worker đang làm dở vào bản lưu.

## Những gì đã tối ưu

| Phần | Thay đổi | Bằng chứng và giới hạn |
|---|---|---|
| Analytics | Nối partner items đúng UUID để dùng index | Output mẫu tương đương; plan dùng index; chưa benchmark toàn tải |
| Tổng đơn khách | Lọc đúng phone trước chuẩn hóa status, tránh vật hóa JSON lớn | 6 fixture + 3 mẫu thật tương đương; quyền/công thức giữ nguyên |
| Rule tích điểm | Planner ước lượng đúng một dòng | Chỉ ROWS metadata, thân hàm/tỷ lệ điểm không đổi |
| Dashboard | Chỉ xử lý đơn thuộc ba kỳ báo cáo | 12 fixture + 2 đối chiếu dữ liệu thật, kiểm tra RPC sau áp dụng; chưa đo CPU |
| Hồ sơ khách | Tên thiếu dùng chuỗi rỗng thay NULL | 9 case đạt, tên thật giữ nguyên; chưa thử ghi hồ sơ thật |

Supabase AI đã phản biện từng phương án. Codex đối chiếu bằng catalog, source và truy vấn giới hạn trước khi áp dụng. Bốn fingerprint SQL cũ được kiểm tra lại trong đợt 5. Không thay quyền/RLS trong các migration này.

Build workspace đạt, kiểm tra UTF-8 656 file. Bản build local có các thay đổi đang làm dở; chỉ các file SQL/báo cáo liệt kê dưới đây được lưu trong commit này.

Migration/rollback customer count và dashboard chuẩn hóa CRLF của chuỗi SQL mới về LF để fingerprint không sai khi đọc trên Windows; không đổi thêm hàm live. Migration dừng nếu version không đúng. Dữ liệu synthetic trong fixture không phải hồ sơ/đơn thật.

## Danh sách file trong bản lưu

- supabase/migrations/20261006073603_optimize_analytics_partner_uuid_join.sql
- supabase/migrations/20261006075230_optimize_customer_count_filter_before_status.sql
- supabase/migrations/20261006075728_correct_loyalty_rule_row_estimate.sql
- supabase/migrations/20261006080610_filter_dashboard_active_periods.sql
- supabase/migrations/20261006081552_fix_stub_profile_empty_name.sql
- docs/supabase-optimization-2026-10-06.md
- docs/supabase-optimization-phase2-2026-10-06.md
- docs/supabase-optimization-phase3-2026-10-06.md
- docs/supabase-optimization-phase4-2026-10-06.md
- docs/supabase-optimization-phase5-2026-10-06.md
- docs/supabase-sql/2026-10-06-analytics-uuid-join-applied.sql
- docs/supabase-sql/2026-10-06-analytics-uuid-join-rollback.sql
- docs/supabase-sql/2026-10-06-analytics-uuid-join-validation.sql
- docs/supabase-sql/2026-10-06-customer-count-real-validation.sql
- docs/supabase-sql/2026-10-06-customer-count-validation.sql
- docs/supabase-sql/2026-10-06-customer-count-rollback.sql
- docs/supabase-sql/2026-10-06-dashboard-period-validation.sql
- docs/supabase-sql/2026-10-06-dashboard-period-rollback.sql
- docs/supabase-sql/2026-10-06-loyalty-rule-estimate-validation.sql
- docs/supabase-sql/2026-10-06-loyalty-rule-estimate-rollback.sql
- docs/supabase-sql/2026-10-06-stub-profile-name-validation.sql
- docs/supabase-sql/2026-10-06-stub-profile-name-rollback.sql
- docs/supabase-optimization-publication-2026-10-06.md

Tất cả file trên là file mới trong Git. Các migration/rollback customer count và dashboard được điều chỉnh cục bộ về xử lý xuống dòng trước khi lưu. Không sửa thêm frontend trong đợt 5.

## Việc người dùng cần làm

Không cần cài lại POS, chạy SQL hoặc thao tác Vercel. Lượt kiểm tra tiếp theo nên đối chiếu một hồ sơ phát sinh tự nhiên thiếu tên và đo lỗi/độ trễ sau triển khai. Chưa kết luận mọi lỗi đã hết hoặc mức giảm CPU/latency.
