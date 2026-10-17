# Lưu mã nguồn Grab cloud lên GitHub · 17/10/2026

## Phạm vi

Nhánh `codex/vietsing-grab-funnel-20261017` lưu giao diện phễu đúng tỷ lệ, bộ worker Supabase đang hoạt động và kiểm thử. Commit lưu backend có cha `d9c1bac88d6b4c222cf2015310dd8afecfbb55ba` (giao diện đã triển khai).

Backend trong bản lưu lấy trực tiếp từ Supabase `qjaklysckgzdfjthzkzu`: `grab-vietsing-pilot` v23 và `partner-review-source-api` v54. Không lấy các chỉnh sửa Marketing khác còn trong worktree. Các file backend được đối chiếu với nội dung cloud sau khi chuẩn hóa LF/UTF-8, không chứa secret hoặc session.

Đây là lưu mã nguồn, không chạy lại SQL, đăng nhập Grab, điều khiển cửa hàng hoặc triển khai lại Supabase/production. Không thay đổi main hay nhánh làm việc hiện tại trên máy. Giữ các lịch mỗi giờ và 5 phút đang chạy.

## Kiểm tra

63 kiểm thử qua trên chính thư mục snapshot backend trước khi commit: phễu nhiều gian hàng, quyền chi nhánh, các lease, phân loại 401/403/429, Browserless Free và trạng thái/Bận. Kiểm thử mô phỏng không thay thế thử thao tác BUSY hoặc ép hết phiên trên cửa hàng thật. Frontend đã build và kiểm tra web ở commit cha; bản lưu này không đổi frontend.

## File lưu trong commit backend

- `supabase/functions/grab-vietsing-pilot/index.ts`
- `supabase/functions/grab-vietsing-pilot/accounts.ts`
- `supabase/functions/grab-vietsing-pilot/collectors.ts`
- `supabase/functions/grab-vietsing-pilot/csrf.ts`
- `supabase/functions/grab-vietsing-pilot/session.ts`
- `supabase/functions/grab-vietsing-pilot/browserless.ts`
- `supabase/functions/grab-vietsing-pilot/diagnostics.ts`
- `supabase/functions/grab-vietsing-pilot/storeControl.ts`
- `supabase/functions/grab-vietsing-pilot/funnel.ts`
- `supabase/functions/partner-review-source-api/index.ts`
- `supabase/functions/partner-review-source-api/funnelReport.ts`
- `scripts/grab-conversion-funnel.test.mjs`
- `scripts/grab-vietsing-pilot.test.mjs`
- `scripts/grab-vietsing-browserless.test.mjs`
- `scripts/grab-cloud-store-control.test.mjs`
- `docs/grab-vietsing-funnel-cloud-2026-10-17.md`
- `docs/grab-all-funnels-cloud-2026-10-17.md`
- `docs/supabase-sql/20261017_grab_funnel_checks.sql`
- `docs/supabase-sql/20261017_grab_all_funnels_checks.sql`
- Tài liệu này.

## Hợp đồng triển khai cần giữ

Cả hai Edge Functions hiện `verify_jwt=false` vì handler có cơ chế xác thực riêng. Domain API vẫn xác minh active Admin và quyền chi nhánh cho báo cáo; automation kiểm tra `x-automation-secret`. Worker từ chối header sai trước truy cập database. Không đổi các thiết lập này khi chỉ lưu mã nguồn.

Khi phục hồi hoặc deploy có chủ đích, giữ bố cục thư mục `supabase/functions/`: domain API import `../grab-vietsing-pilot/accounts.ts`. Deploy từng function cùng các dependency tương đối. `PARTNER_REVIEW_AUTOMATION_SECRET` và `BROWSERLESS_API_TOKEN` chỉ ở Edge Function Secrets/Vault; Supabase cung cấp `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`. Không điền giá trị bí mật vào Git hoặc SQL.

Không cần bật worker Windows. Cần xem trạng thái triển khai, dữ liệu và giới hạn kiểm chứng trong `grab-all-funnels-cloud-2026-10-17.md`.
