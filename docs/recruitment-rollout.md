# Trang tuyển dụng /tuyendung

## Phạm vi và trạng thái

- Nhánh được tạo từ main `71f3b022b85a997cba81339e99b3dd86de33f413`.
- Route public riêng, không Google Form, không login. Dùng logo `siteBrand` hiện có, font system-ui/Inter/Arial, màu vàng/đen; không vẽ lại logo.
- Giữ 13 câu hỏi bắt buộc và bốn cửa hàng. Chuẩn hóa dấu câu, `Partime` thành `Part-time`; `Mục khác` có ô nhập. Người không đi học/chưa đi làm được hướng dẫn ghi rõ thay vì bỏ mục bắt buộc.
- Giới tính chỉ là câu trả lời, không có điểm số, lọc hay quyết định tuyển dụng tự động.
- Hồ sơ + trạng thái thông báo được lưu cùng một transaction. Không dùng localStorage làm nơi lưu hồ sơ. Nội dung trong trang được giữ khi lỗi; reload sẽ xóa bản nháp trên trình duyệt.
- Không thay đổi workflow Google Sheets hiện hữu, người nhận `7445001328904030710`, loại nhóm `0` hay credential Zalo.
- Chưa áp dụng SQL, deploy function, bật nhận hồ sơ hoặc gửi Zalo ở production.

## Backend đã xác minh (chỉ đọc)

Supabase project `qjaklysckgzdfjthzkzu` khớp cấu hình repo, PostgreSQL 17, đang ACTIVE_HEALTHY.
Có Edge Functions dùng service role; chưa có bảng/function tuyển dụng. Chọn thêm một bảng và một Edge Function vào backend hiện hữu, không tạo backend/site thay thế.
Không có công cụ quản lý n8n trong phiên cloud này. URL workflow quản trị không phải URL webhook nhận hồ sơ; không được dùng URL đó làm endpoint.

## Sau khi chủ quán duyệt bản review

1. Áp dụng **một** bản SQL: migration `supabase/migrations/20261014105926_recruitment_applications.sql` hoặc bản tương đương `docs/supabase-sql/recruitment-applications.sql` (không cần cả hai). Kiểm tra quyền table/RPC và RLS trước bật ghi.
2. Deploy `recruitment-api` với `--no-verify-jwt` riêng function này. Không thay verify_jwt function khác. Frontend gửi publishable key qua `apikey`, không dùng khóa này làm JWT; không gọi auth.
3. Secrets phía server: `RECRUITMENT_HASH_SECRET` (ngẫu nhiên dài, giữ ổn định để dedup), `RECRUITMENT_DISPATCH_SECRET` (ngẫu nhiên riêng), `RECRUITMENT_ALLOWED_ORIGINS` (danh sách origin chính xác, dấu phẩy). `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` chỉ server.
4. Mặc định `RECRUITMENT_INTAKE_ENABLED` và `RECRUITMENT_NOTIFICATIONS_ENABLED` đều tắt. Giữ tắt trong preview production; nếu cần kiểm thử end-to-end dùng project/staging riêng và dữ liệu giả.
5. Giữ runtime policy frontend hiện có (`VITE_DATA_SOURCE=supabase`, `VITE_ENABLE_SUPABASE_RUNTIME_WRITES=true`). Không cần mở quyền đọc/ghi bảng cho anon hoặc authenticated.

## Hợp đồng nối n8n → Zalo (chưa nối)

Ít thay đổi nhất với quyền hiện tại là **server → webhook mới trong n8n → node Zalo hiện hữu**.
Không ghi hồ sơ vào Sheet cũ trong bản này; không cho webhook quét Sheet hay đọc lại hồ sơ cũ.
Thêm nhánh Webhook POST có xác thực Bearer bằng secret; giữ nguyên Google Sheets Trigger/Code production/test đang hoạt động.

Payload gửi **một** hồ sơ mỗi request:

```json
{
  "event": "recruitment_application_received",
  "application_id": "UUID bền vững",
  "submitted_at": "ISO 8601 từ database",
  "application": {
    "fullName": "...", "birthDate": "YYYY-MM-DD", "phone": "...", "address": "...",
    "gender": "...", "branch": "...", "education": "...", "educationOther": "...",
    "school": "...", "shifts": ["..."], "workTypes": ["..."],
    "impression": "...", "previousJob": "...", "selfDescription": "..."
  }
}
```

n8n cần kiểm tra secret, event/schema; dedup **bền vững** theo `application_id` trước xử lý.
Node Code mới map riêng payload webhook thành `message`, dùng `submitted_at` format `Asia/Ho_Chi_Minh` (không `new Date()` thay thời điểm nộp), giữ `pairedItem`.
Node Zalo giữ đúng credential và người nhận hiện tại. Không sửa Code của nhánh Sheet để dùng chung hai loại payload.
Respond to Webhook chỉ trả `{ "ok": true, "application_id": "đúng UUID" }` sau khi xử lý hoàn tất hoặc đã xác minh UUID từng hoàn tất; không trả 200 thành công ngay khi bắt đầu workflow.

**Giới hạn giao nhận:** HTTP timeout có thể xảy ra sau khi Zalo đã gửi. Queue có delivery at least once, không tuyên bố exactly once. n8n phải lưu trạng thái nhận/gửi bền vững theo ID, chặn execution song song cùng ID và xử lý trạng thái “không rõ đã gửi” bằng đối soát, không tự gửi lại mù. Chưa xác minh khả năng này nên chưa bật gửi thật.

Khi nhánh webhook và chống trùng đã kiểm thử cô lập: đặt `RECRUITMENT_N8N_WEBHOOK_URL`/`RECRUITMENT_N8N_WEBHOOK_SECRET` ở Edge secrets và bật `RECRUITMENT_NOTIFICATIONS_ENABLED=true`.
Thiết lập scheduler phía server/n8n gọi function mỗi phút bằng secret riêng:
`POST /functions/v1/recruitment-api`, Bearer `RECRUITMENT_DISPATCH_SECRET`, JSON `{ "action": "retry_notifications" }`.
Không đặt secret hay lịch dispatch trong frontend. Không tự kích hoạt lịch trong PR này.
Cuối cùng bật intake và merge/deploy route sau khi anh duyệt. Test tin Zalo thật là bước riêng cần anh duyệt.

## Quan sát và xử lý lỗi

Queue claim tối đa 10 hồ sơ, lease 2 phút, tối đa 5 lần; retry backoff 2/4/8/16/32 phút. Hai worker không claim cùng lease.
Trạng thái `pending/sending/sent/failed`, attempts, `notification_last_error`, thời điểm retry nằm trên hồ sơ. Không log PII, secret, nội dung response webhook.
`sent` chỉ có khi webhook trả ack đúng ID. Lỗi Zalo không đổi kết quả tiếp nhận hồ sơ.
Sau 5 lần hoặc crash lần thứ 5: đối soát thủ công ID trước khi retry. Không reset batch mù.

SQL chỉ đọc để kiểm tra hàng đợi, không cần đọc nội dung hồ sơ:

```sql
select id, submitted_at, notification_status, notification_attempts,
       notification_last_error, notification_next_attempt_at, notification_lease_until
from public.recruitment_applications
where notification_status <> 'sent' order by submitted_at;
```

Chống trùng: UUID cho một lần gửi + fingerprint của nội dung đã chuẩn hóa trong 24 giờ. Cùng UUID khác nội dung trả 409. Admission lock ngăn race; tối đa 3 hồ sơ khác nhau/số điện thoại/24h và 10/IP/giờ. IP hash có salt, không lưu IP thô; header IP phụ thuộc độ tin cậy gateway Supabase, không xem CORS/honeypot là xác thực. Không có CAPTCHA; nếu gặp bot phân tán cần thêm biện pháp chống bot ở gateway trong phạm vi riêng.
Không có public read, không auto đánh giá. Cần chốt thời hạn giữ hồ sơ và quy trình xóa theo vận hành trước mở rộng.

## Kiểm chứng cô lập

`node --test scripts/recruitment-api.test.mjs` kiểm tra schema, save/error, giới hạn body/CORS, dispatch private, ack webhook.
DB test dùng PostgreSQL WASM PGlite **ngoài repo**, không thêm dependency sản phẩm:

```sh
npm install --prefix /tmp/ghr-recruitment-qa @electric-sql/pglite --no-audit --no-fund
RECRUITMENT_PGLITE_MODULE=/tmp/ghr-recruitment-qa/node_modules/@electric-sql/pglite/dist/index.js node --test scripts/recruitment-database.test.mjs
```

Môi trường cloud không có browser-control skill nên chưa chạy kiểm thử browser/screenshot/mobile thực tế. Build và test cô lập không chứng minh production Edge/n8n/Zalo đang nối. Không dùng ứng viên thật để test.

Kiểm thử React thực tế bằng renderer QA ngoài repo (không thay dependency sản phẩm):

```sh
npm install --prefix /tmp/ghr-recruitment-qa react-test-renderer@18.2.0 --no-audit --no-fund
RECRUITMENT_RENDERER_MODULE=/tmp/ghr-recruitment-qa/node_modules/react-test-renderer/index.js node scripts/run-recruitment-ui-tests.mjs
```

Hook/page đã kiểm tra validation, click gửi hai lần khi pending, nội dung còn sau lỗi, retry giữ UUID, sửa nội dung tạo UUID mới, màn hình receipt sau save, logo và đủ trường bắt buộc. Renderer không đo bố cục/mobile thực tế.
`smoke:flows` hiện lỗi `Admin sidebar layout missing`, đã tái hiện trên checkout main không sửa; không sửa Admin ngoài phạm vi. `smoke:success` thanh toán pass.
