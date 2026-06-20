# Loyalty V2 - Phase 2: Database foundation

Ngày hoàn tất code: 20/06/2026

Trạng thái production: **Đã deploy migration foundation ngày 20/06/2026**

Security cutover: **Chưa chạy**

## Kết quả Phase 2

Phase 2 đã chuẩn bị đầy đủ nền tảng database:

- `loyalty_rule_versions`: phiên bản quy tắc bất biến.
- Snapshot rule/tiền/điểm trên `orders` và `partner_orders`.
- Định danh sự kiện chuẩn trên `loyalty_ledger`.
- Unique index chống cộng/trừ/hoàn trùng.
- Quan hệ giữa giao dịch đảo và giao dịch gốc.
- Một facade `process_order_loyalty` cho web, QR, POS và đối tác.
- RPC điểm danh/milestone xử lý tại database.
- RPC admin điều chỉnh điểm qua ledger.
- RPC kích hoạt rule mới mà không tính lại đơn cũ.
- Trigger tự snapshot rule cho đơn mới.
- Backfill snapshot và định danh legacy, không tự cộng bù điểm.
- Assertion tự dừng migration nếu số dư hoặc snapshot không đạt.

## Các file Phase 2

| File | Mục đích |
| --- | --- |
| `docs/supabase-sql/loyalty-v2-phase-2-audit.sql` | Audit chỉ đọc trước migration |
| `supabase/migrations/20260620110353_loyalty_v2_phase_2_foundation.sql` | Migration nền tảng chính thức |
| `docs/supabase-sql/loyalty-v2-phase-2-postcheck.sql` | Đối chiếu chỉ đọc sau migration |
| `docs/supabase-sql/loyalty-v2-phase-2-deploy-verify.sql` | Verify production sau deploy bằng 1 kết quả tổng hợp |
| `docs/supabase-sql/loyalty-v2-phase-2-security-cutover.sql` | Thu hồi quyền legacy khi tất cả runtime đã chuyển V2 |
| `scripts/smoke-loyalty-v2-sql.mjs` | Smoke test cấu trúc và nguyên tắc an toàn của SQL |

## Những gì migration foundation thay đổi

Migration foundation là additive-first:

- Thêm bảng/cột/index/constraint/function/trigger mới.
- Backfill các trường V2 nhưng không thêm hoặc xóa điểm.
- Giữ RPC và RLS legacy hoạt động để web/POS hiện tại không bị gián đoạn.
- Không chuyển frontend sang V2.
- Không chạy bù các đơn thiếu điểm.

Security cutover được tách riêng vì chạy sớm sẽ làm các service legacy mất quyền ghi. File cutover có khóa bảo vệ và không thể chạy nếu chưa chủ động bật cờ xác nhận.

## Kết quả kiểm tra ngày 20/06/2026

Đã chạy dry-run trước khi deploy thật:

- Preflight audit: thành công.
- Toàn bộ migration: biên dịch và chạy thành công trong transaction thử nghiệm.
- Rule active: đúng một phiên bản.
- Snapshot web/QR/POS/partner: backfill đầy đủ trong dry-run.
- Tổng `loyalty_accounts` vẫn khớp tổng `loyalty_ledger`.
- Các RPC V2 được tạo đúng signature.
- `anon` không có quyền gọi `process_order_loyalty`.
- Transaction dry-run đã rollback hoàn toàn.

Dry-run cũng phát hiện 2 nhóm dữ liệu điểm danh legacy bị trùng ngày Việt Nam do index cũ tính ngày UTC. Migration không xóa/gộp lịch sử này. Sự kiện mới dùng `entry_type = CHECKIN_V2` và unique business-event theo ngày `Asia/Ho_Chi_Minh`, nên không tiếp tục lỗi lệch ngày và không va chạm index legacy.

## Kết quả deploy production ngày 20/06/2026

Đã chạy trực tiếp trên linked production:

1. `supabase db query --linked --file docs/supabase-sql/loyalty-v2-phase-2-audit.sql`
2. `supabase db query --linked --file supabase/migrations/20260620110353_loyalty_v2_phase_2_foundation.sql`
3. `supabase db query --linked --file docs/supabase-sql/loyalty-v2-phase-2-postcheck.sql`
4. `supabase db query --linked --file docs/supabase-sql/loyalty-v2-phase-2-deploy-verify.sql`
5. `npm run smoke:loyalty-v2`
6. `supabase migration repair 20260620110353 --status applied --linked`

Kết quả verify production:

- `active_rule_count = 1`
- `orders_missing_snapshot = 0`
- `partner_orders_missing_snapshot = 0`
- `account_total = 78151`
- `ledger_total = 78151`
- Legacy runtime vẫn còn mở như kỳ vọng trước cutover
- Smoke test `Loyalty V2 SQL` pass
- Migration history remote đã ghi đúng version `20260620110353`

Ghi chú:

- Không dùng `supabase db push --include-all`
- Không chạy `loyalty-v2-phase-2-security-cutover.sql`
- Bốn migration local cũ vẫn chưa được repair lên remote, đây là việc riêng và chưa được đụng vào

## Lệnh deploy chuẩn

```powershell
supabase db query --linked --file docs/supabase-sql/loyalty-v2-phase-2-audit.sql
supabase db query --linked --file supabase/migrations/20260620110353_loyalty_v2_phase_2_foundation.sql
supabase db query --linked --file docs/supabase-sql/loyalty-v2-phase-2-postcheck.sql
supabase db query --linked --file docs/supabase-sql/loyalty-v2-phase-2-deploy-verify.sql
npm run smoke:loyalty-v2
supabase migration repair 20260620110353 --status applied --linked
```

Remote hiện chỉ ghi nhận lịch sử cho version `20260620110353`. Vì vậy **không dùng** `supabase db push --include-all`. Việc đối chiếu bốn migration local cũ là một công việc riêng, không tự repair khi chưa audit từng file.

## Rollback

Migration foundation chưa đổi frontend nên rollback vận hành ưu tiên là:

1. Dừng chuyển traffic sang RPC V2.
2. Giữ frontend/service ở luồng legacy.
3. Không xóa ledger hoặc snapshot đã tạo.
4. Nếu migration thất bại giữa chừng, transaction tự rollback toàn bộ.
5. Nếu migration đã commit nhưng phát hiện vấn đề, không drop dữ liệu ngay; lập migration rollback có kiểm tra phụ thuộc và backup mới trước khi chạy.

## Điều kiện vào Phase 3

- [x] Migration được tạo bằng Supabase CLI.
- [x] SQL dry-run trên schema production đạt.
- [x] Backfill không làm thay đổi tổng điểm.
- [x] RPC đơn hàng không nhận phone/points/amount từ client.
- [x] Idempotency được enforce bằng unique index tại database.
- [x] Điểm danh và milestone được quyết định tại database.
- [x] Admin adjustment tạo ledger thay vì sửa số dư trực tiếp.
- [x] Security cutover được tách khỏi foundation.
- [x] Migration foundation đã deploy production.
- [x] Postcheck sau deploy đạt.
- [ ] Frontend website/QR/POS chuyển sang RPC V2.
- [ ] Security cutover được duyệt và chạy sau khi toàn bộ runtime đã chuyển xong.

Phase 3 chưa được bắt đầu và frontend hiện tại vẫn chưa gọi RPC V2.
