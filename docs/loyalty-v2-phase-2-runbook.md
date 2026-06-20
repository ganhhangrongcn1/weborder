# Loyalty V2 — Phase 2: Database foundation

Ngày hoàn tất code: 20/06/2026

Trạng thái production: **Chưa deploy migration**

## Kết quả Phase 2

Phase 2 đã chuẩn bị đầy đủ nền tảng database:

- `loyalty_rule_versions`: phiên bản quy tắc bất biến.
- Snapshot rule/tiền/điểm trên `orders` và `partner_orders`.
- Định danh sự kiện chuẩn trên `loyalty_ledger`.
- Unique index chống cộng/trừ/hoàn trùng.
- Quan hệ giữa giao dịch đảo và giao dịch gốc.
- Một façade `process_order_loyalty` cho web, QR, POS và đối tác.
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

Đã chạy trên linked production trong transaction `ROLLBACK`:

- Preflight audit: chạy thành công.
- Toàn bộ migration: biên dịch và chạy thành công.
- Rule active: đúng một phiên bản.
- Snapshot web/QR/POS/partner: backfill đầy đủ trong dry-run.
- Tổng `loyalty_accounts` vẫn khớp tổng `loyalty_ledger`.
- Các RPC V2 được tạo đúng signature.
- `anon` không có quyền gọi `process_order_loyalty`.
- Transaction đã rollback hoàn toàn.

Dry-run cũng phát hiện 2 nhóm dữ liệu điểm danh legacy bị trùng ngày Việt Nam do index cũ tính ngày UTC. Migration không xóa/gộp lịch sử này. Sự kiện mới dùng `entry_type = CHECKIN_V2` và unique business-event theo ngày `Asia/Ho_Chi_Minh`, nên không tiếp tục lỗi lệch ngày và không va chạm index legacy.

Đã xác nhận sau dry-run:

```txt
loyalty_rule_versions chưa tồn tại trên production
orders.loyalty_rule_version_id chưa tồn tại trên production
```

Vì vậy production chưa nhận thay đổi schema nào từ Phase 2.

## Trình tự deploy sau khi anh duyệt

1. Xác nhận backup database mới nhất vẫn còn khả dụng.
2. Chạy preflight audit.
3. Lưu kết quả count/tổng điểm làm mốc.
4. Chạy migration foundation.
5. Chạy postcheck.
6. Chạy smoke RPC bằng dữ liệu test có cleanup.
7. Theo dõi runtime legacy; chưa chạy security cutover.
8. Sang Phase 3 mới chuyển website/QR bằng feature flag.

Lệnh dự kiến:

```powershell
supabase db query --linked --file docs/supabase-sql/loyalty-v2-phase-2-audit.sql
supabase db query --linked --file supabase/migrations/20260620110353_loyalty_v2_phase_2_foundation.sql
supabase db query --linked --file docs/supabase-sql/loyalty-v2-phase-2-postcheck.sql
npm run smoke:loyalty-v2
supabase migration repair 20260620110353 --status applied --linked
```

Remote hiện chưa ghi nhận lịch sử của bốn migration local cũ. Vì vậy **không dùng** `supabase db push --include-all`. Chỉ đánh dấu version `20260620110353` là `applied` sau khi foundation và postcheck đều thành công. Việc đối chiếu bốn migration cũ là một công việc riêng, không tự repair khi chưa audit từng file.

Không chạy `loyalty-v2-phase-2-security-cutover.sql` trong bước deploy foundation.

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
- [ ] Anh duyệt thời điểm deploy migration foundation lên production.
- [ ] Postcheck sau deploy đạt.

Phase 3 chưa được bắt đầu và frontend hiện tại chưa gọi RPC V2.
