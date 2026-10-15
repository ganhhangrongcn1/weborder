# Kết nối Analy trên Supabase

Phạm vi: quản lý tài khoản/phiên và kiểm tra địa chỉ, báo giá. Chưa tích hợp website/POS, không có API tạo/hủy chuyến, không gắn vào worker local.

## Luồng

Server/admin được cấp quyền → `analy-session` → đọc phiên trong `integration_sessions` → đăng nhập Analy nếu chưa có phiên hợp lệ → tìm địa chỉ/báo giá → trả kết quả đã loại thông tin nhạy cảm.

- Actions: `status`, `connect`, `check_api`. `check_api` dùng tọa độ thử công khai ở Thủ Dầu Một, không phải đơn giao thực tế.
- `status` không trả token, mật khẩu hoặc tài khoản. `delivery_creation_enabled=false`.
- Secret: `ANALY_USERNAME`, `ANALY_PASSWORD`, `ANALY_DEVICE_ID`, `ANALY_ACCOUNT_MODE`, `ANALY_SERVER_KEY_SHA256`.
- Mật khẩu lưu trong Supabase Secrets. Token lưu server-side trong bảng có RLS; `anon`/`authenticated` không có quyền đọc bảng phiên theo audit ngày 15/10/2026.
- Khóa phiên có fingerprint theo tài khoản + thiết bị. Đổi tài khoản không sử dụng nhầm token cũ.
- TTL bộ đệm lấy theo `exp`, tối đa 6 giờ; token opaque chỉ lưu 5 phút. Đây là giới hạn cache, không khẳng định thời hạn tài khoản/gói.
- API Analy trả 401: đăng nhập lại và thử đúng một lần. Không tự đăng nhập liên tục khi gặp 403/428. Yêu cầu duyệt thiết bị sẽ dừng và báo trạng thái.
- Có khóa lease chống nhiều lượt đăng nhập đồng thời và thời gian chờ lại sau lỗi.
- `account_mode=trial_7_days` chỉ ghi nhận thông tin người dùng cung cấp. Chưa biết ngày kết thúc cụ thể; không bảo đảm quyền dịch vụ sau khi hết thử.

## Xác thực API

Chấp nhận khóa server chính xác do môi trường Supabase cấp hoặc JWT người dùng được Supabase Auth xác thực và có profile admin active. Không tin role JWT chỉ được decode.

CLI hiện trả legacy service key khác khóa môi trường. Đường gọi server từ công cụ cấu hình dùng header `x-analy-server-key`, đối chiếu SHA-256 với `ANALY_SERVER_KEY_SHA256` được tạo từ service_role key lấy qua Supabase Management CLI. Không hardcode giá trị khóa hoặc hash trong source. Khi xoay/thu hồi service key, phải cập nhật/xóa fingerprint tương ứng. Không đưa header/khóa này vào frontend.

## Cấu hình và kiểm tra

Trên Windows, chạy `scripts/analy/configure-analy-server.ps1`. Nhập mật khẩu kín. CLI nhận secrets qua named pipe Windows, không qua tham số command line hay file plaintext; dữ liệu chỉ được lưu ở Supabase theo yêu cầu. Cloud không cần chạy lại công cụ này nếu dùng cùng dự án Supabase đã cấu hình; secret không nằm trong Git. Nếu cần đổi tài khoản từ môi trường khác, dùng Supabase Dashboard → Edge Function Secrets.

Công cụ lưu kết quả an toàn vào `tmp/analy-server-setup-results.json`: `connect` → `check_api` → `status`. So sánh `session_updated_at` chứng minh phép thử dùng lại cùng phiên. Bằng chứng chạy local trước khi push nằm tại `tmp/analy-api-audit/analy-server-setup-results.json`, không đưa vào Git.

Triển khai lại riêng function: `supabase functions deploy analy-session --project-ref qjaklysckgzdfjthzkzu`. `supabase/config.toml` giữ đúng cấu hình xác thực tại handler như bản đang chạy. Không triển khai API thử tạm hoặc bật thao tác tạo chuyến.

Kiểm tra tự động: `node --test scripts/analy-session.test.mjs`.

Tài liệu Supabase: https://supabase.com/docs/guides/functions/secrets

## Kết quả xác nhận ngày 15/10/2026

Lúc 18:48 giờ Việt Nam, cấu hình tài khoản mới đã được lưu trong Supabase Secrets qua named pipe. `connect`, `check_api`, `status` đều HTTP 200. Tìm địa chỉ trả 5 kết quả; tuyến tọa độ thử trả báo giá 20.000đ. `session_updated_at` không đổi giữa connect và status sau phép thử, xác nhận dùng lại phiên. `deliveries_created=0`, `delivery_creation_enabled=false`. Tài khoản vẫn được đánh dấu thử 7 ngày.

Sáu kiểm tra tự động và build chính của dự án đã đạt. Chưa tích hợp UI/website/POS. API kiểm tra tạm đã gỡ; chỉ giữ kết nối `analy-session`.

## Khôi phục bản trước

Mã bản trước khi thay đổi nằm tại `.local-backups/analy-server-20261015/analy-session-v6.json` (không có credentials/token). Có thể triển khai lại mã này. Secret mới không khôi phục mật khẩu cũ tự động; muốn quay về tài khoản cũ cần nhập lại bằng kênh bảo mật. Không sửa/hủy phiên NexPOS và không thay đổi RLS.

## Tệp trong phạm vi

- `supabase/functions/analy-session/index.ts`
- `supabase/functions/_shared/analy-auth.mjs`
- `supabase/functions/_shared/analy-session.mjs`
- `supabase/functions/_shared/analy-delivery-probe.mjs`
- `scripts/analy-session.test.mjs`
- `scripts/analy/configure-analy-server.mjs`
- `scripts/analy/configure-analy-server.ps1`
- `supabase/config.toml` (chỉ stanza Analy)
- `docs/analy-server-session.md`
