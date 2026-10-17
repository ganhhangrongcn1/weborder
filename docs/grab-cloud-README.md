# Grab cloud: mã nguồn và vận hành

Đây là mục lục trạng thái hiện tại, thay cho các kết luận thử nghiệm ban đầu trong báo cáo Vietsing.

## Trạng thái ngày 17/10/2026

- Cả 5 gian hàng dùng `grab-vietsing-pilot` trên Supabase: hai gian hàng 30/4, Lê Hồng Phong, Thích Quảng Đức và Vietsing.
- Đánh giá/tài chính đồng bộ mỗi giờ; trạng thái cửa hàng được kiểm tra mỗi 5 phút bằng các lịch SQL đã lưu.
- Phiên còn hạn dùng lại cookie Vault; HTTP 401 mới được phép đăng nhập qua Browserless Free. Không sử dụng proxy, CAPTCHA solver hay tự mua gói. Khi gặp yêu cầu xác thực tương tác/hết quota thì cần xử lý tiếp, không đảm bảo đăng nhập vô điều kiện.
- Khi công tắc Bận bật, cloud có thể đặt thời gian chuẩn bị 15 phút và kiểm tra lại trạng thái. Khi đã thấy BUSY rồi quan sát NORMAL, tự tắt công tắc để tôn trọng thao tác trên Grab. Không tự mở cửa hàng đóng/tạm nghỉ.
- Worker Windows đã dừng; task `GHR Partner Review Worker` đã Disabled. Sau khi dừng, 5 lượt sync từ Supabase đều HTTP 200, ok=true, remaining=0. Không xóa chương trình, profile hoặc secret trên máy.
- Giao diện đã triển khai từ commit `4003424e42d1bea07b32737dd820b91bac625ea1` trên nhánh `codex/grab-cloud-store-control-20261016`. Việc bổ sung mã nguồn backend/tài liệu vào nhánh này chỉ lưu phiên bản, không yêu cầu chạy lại SQL hoặc deploy lại.

## Mã nguồn

- `supabase/functions/grab-vietsing-pilot/`: handler, allowlist nguồn/merchant, Browserless, quản lý cookie, đánh giá/tài chính và điều khiển cửa hàng.
- `supabase/functions/partner-review-source-api/index.ts`: API domain đã có; bổ sung trả snapshot trạng thái thật và lý do tự tắt Bận.
- `supabase/config.toml`: function tự xác thực header bí mật; không dùng khóa service-role trong frontend.

## Thiết lập trên môi trường mới

Không chạy các bước này lại trên production đang hoạt động chỉ để lưu mã nguồn.

1. Chuẩn bị domain API, bảng nghiệp vụ và Vault theo dự án hiện có. SQL tạo nguồn Vietsing chỉ dùng khi nguồn chưa được cấu hình.
2. Deploy `grab-vietsing-pilot` cùng toàn bộ file tương đối trong thư mục; handler tự kiểm tra `x-automation-secret` trước khi truy cập dữ liệu.
3. Thiết lập Edge Function Secrets `PARTNER_REVIEW_AUTOMATION_SECRET`, `BROWSERLESS_API_TOKEN`; Supabase cung cấp `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`. Chỉ lưu giá trị ở Secret/Vault, không điền vào mã hoặc SQL.
4. Dùng action `provision_cron` có xác thực để chuẩn bị secret lịch trong Vault. Lần lượt áp dụng SQL lịch pilot, các gian hàng còn lại và điều khiển trạng thái. Kiểm tra allowlist UUID/Merchant ID đúng môi trường trước khi thực hiện.
5. Kiểm tra phiên đang lưu với `sync`/`store_status`. Phép thử `browserless_probe` có chủ đích đăng nhập mới, có tiêu thụ quota; không gọi liên tục.

## Kiểm tra cục bộ

Yêu cầu Node hỗ trợ trực tiếp các file `.ts` chỉ chứa cú pháp JavaScript và đã cài dependency trong `package-lock.json`.

```sh
node --test scripts/grab-cloud-store-control.test.mjs scripts/grab-cloud-store-ui.test.mjs scripts/partner-review-store-ui.test.mjs scripts/grab-vietsing-pilot.test.mjs scripts/grab-vietsing-browserless.test.mjs
npm run build
```

46 kiểm thử đã qua; build và encoding đã qua. Chưa phát lệnh BUSY trên cửa hàng thật để thử nghiệm và chưa quan sát nhân viên bỏ BUSY thật; không đánh đồng kiểm thử giả lập với bằng chứng thao tác cửa hàng thật.

## Tài liệu và rollback

- `vietsing-supabase-grab-pilot-2026-10-16.md`: nhật ký điều tra ban đầu, gồm cả các kết luận đã được thay thế ở những bước sau.
- `grab-cloud-all-branches-2026-10-16.md`: mở rộng 5 gian hàng và kiểm chứng đăng nhập mới.
- `grab-cloud-store-control-2026-10-16.md`: trạng thái/Bận, triển khai giao diện, giới hạn kiểm chứng và rollback.
- Bốn SQL Grab ngày 16/10 trong `docs/supabase-sql/`: tạo nguồn, lịch pilot, lịch các chi nhánh, lịch trạng thái.

Rollback lịch bằng cách disable đúng job theo chú thích SQL; không xóa dữ liệu, cookie hoặc secret. Không tự bật lại task Windows khi cloud vẫn đang chạy nếu chưa xác định nhu cầu vận hành.
