# Tuyển dụng Website và Admin

## Phạm vi

- Public `/tuyendung`: form riêng, không Google Form, không đăng nhập. Dùng logo siteBrand đang có, màu vàng/đen, chữ Việt có dấu, Inter/system-ui/Arial.
- Admin `/admin/recruitment`, danh mục Tuyển dụng trong Nhân sự & giám sát: tab Hồ sơ, Tổng hợp, Câu hỏi & cài đặt.
- Bộ lọc tuyển dụng riêng theo chi nhánh và ngày nộp (múi giờ Việt Nam), phân trang 25 hồ sơ. Danh sách và tổng hợp dùng cùng bộ lọc; thống kê tính toàn bộ bộ lọc, không chỉ trang đang xem.
- Xem từng hồ sơ và trạng thái thông báo; biểu đồ số lượt chọn cho câu radio/checkbox. Câu nhiều lựa chọn có thể nhiều lượt/hồ sơ. Không có đánh giá hay quyết định tuyển dụng tự động.
- Sửa lời giới thiệu/thông báo, mở đóng nhận hồ sơ; sửa nhãn/lựa chọn/thứ tự/bắt buộc, thêm câu mới, ẩn câu cũ. Họ tên/điện thoại/chi nhánh luôn bắt buộc; mã chi nhánh và loại câu hỏi gốc giữ ổn định.
- Lưu snapshot câu hỏi và phiên bản trên từng hồ sơ. Sửa form không thay câu trả lời/câu hỏi của hồ sơ cũ. Lưu cấu hình dùng revision CAS; bản nháp không bị mất khi save lỗi.
- UI → hook → service → repository → Edge Function → Supabase. Không thêm dependency sản phẩm; QA renderer/PostgreSQL WASM ở ngoài repo.

## Trạng thái triển khai

Main đã xác minh `71f3b022b85a997cba81339e99b3dd86de33f413`, PR draft #6. Backend thực tế là project Supabase `qjaklysckgzdfjthzkzu`, PostgreSQL 17, chưa có recruitment backend trước PR.
Chưa áp dụng SQL/deploy function, chưa bật intake, chưa merge/deploy production và chưa gửi tin Zalo thật.
Preview chưa có API sẽ hiển thị bộ câu hỏi mặc định để review nhưng khóa nút gửi; Admin không giả lập dữ liệu hồ sơ/thống kê khi API lỗi.

## Workflow n8n đã chuẩn bị

Đã đăng nhập cloud browser và tạo bản sao riêng **Tuyển dụng Website — Webhook (Bản nháp)**:
https://n8nhosting-13007771.phoai.vn/workflow/bpQbMYRmcrmKEB1w
Trạng thái đã quan sát: **Saved, Inactive**. Không có Google Sheets Trigger hoặc Code đọc lại Sheet trong workflow này.
Luồng: Webhook POST → HTTP gate Supabase → IF allowed → node Zalo → Respond to Webhook. Nhánh không allowed trả ack chỉ khi database đã xác nhận hồ sơ được gửi.
Đã kiểm tra node Zalo dùng đúng credential **Zalo Cá Nhân**, người nhận `7445001328904030710`, loại nhóm `0`, message `{{$json.message}}`. Không thay credential/người nhận.
Workflow Google Sheet gốc `jrb965LstWDC0QlN` được giữ nguyên, không sửa Code xử lý production/test đã bàn giao.

URL production đã quan sát trong node Webhook (chưa hoạt động khi workflow Inactive):
https://n8nhosting-13007771.phoai.vn/webhook/ghr-recruitment-5f4ff68e-39e2-45bc-a80b-f53a4bd401b8
Không dùng URL workflow quản trị làm webhook. Không dùng webhook đơn đặt hàng cho tuyển dụng.

## Giao nhận và chống trùng

Server lưu hồ sơ cùng pending queue trong một transaction rồi mới xác nhận với ứng viên.
UUID chống nhấn gửi lại; fingerprint có salt + phiên bản form chống hồ sơ giống nhau trong 24h. Admission lock chống race; tối đa 3 hồ sơ khác/số điện thoại/24h và 10/IP/giờ. Không lưu IP thô.
Server giữ master `RECRUITMENT_INTAKE_ENABLED`; config.accepting chỉ có tác dụng sau khi master được bật. Validation phía server theo config hiện tại; database khóa config và kiểm tra revision/snapshot trong transaction để không nhận nhầm câu hỏi khi Admin vừa sửa.

Sau lưu thành công, EdgeRuntime.waitUntil khởi chạy dispatcher nền (không chặn receipt). Endpoint retry riêng dùng cho khôi phục nếu môi trường không chạy background hoặc worker crash.
Dispatcher claim tối đa 10 hồ sơ/đợt, lease 2 phút. Payload JSON mỗi request:

```json
{
  "event": "recruitment_application_received",
  "application_id": "UUID hồ sơ",
  "delivery_lease": "UUID lease",
  "submitted_at": "ISO từ database",
  "application": { "fullName": "...", "phone": "...", "branch": "..." },
  "form_snapshot": { "questions": [] },
  "zaloMessage": "Thông báo tóm tắt và link Admin"
}
```

Bearer `RECRUITMENT_N8N_WEBHOOK_SECRET` theo request. Node HTTP n8n chuyển header đó đến Edge action `claim_delivery` với applicationId/lease. Node Webhook không tự tin vào dữ liệu/ID người nhận từ caller.
Gate kiểm tra secret và RPC service-only `authorize_recruitment_delivery`: CAS đúng ID, lease còn hạn, status sending, `delivery_started_at IS NULL`; ghi mốc cấp quyền gửi bền vững trước khi trả `allowed:true` cùng message được dựng từ hồ sơ trong DB. Replay cùng ID/lease không được gửi Zalo lần nữa. Caller không thể sửa nội dung message bằng payload.
Node Zalo dùng message của gate, không payload tự khai của caller. Nhánh true Respond `{ok:true,application_id}` sau node Zalo thành công; nhánh false chỉ ok true nếu DB đã có sent.

Không tuyên bố exactly-once. Nếu timeout/mất ack: chuyển **uncertain**, không tự gửi lại. Nếu worker crash sau gate/đã gửi nhưng trước khi lưu ack: `delivery_started_at` ngăn reclaim. Worker crash trước gate được reclaim sau lease; lease cũ bị từ chối. Tối đa 5 claim trước khi cần đối soát.
Admin thấy pending/sending/sent/failed/uncertain, số lần và mã lỗi không chứa PII/secret. Hồ sơ không bị xóa hoặc sửa do lỗi thông báo. Retry sau gate cần đối soát Zalo/n8n trước; không reset batch mù.

## Quyền và bí mật

Bảng recruitment_applications và recruitment_form_settings bật RLS, thu hồi SELECT/INSERT/UPDATE/DELETE của anon/authenticated. RPC chỉ service_role. Public endpoint chỉ trả cấu hình form và receipt, không trả hồ sơ ứng viên.
Các action Admin yêu cầu JWT được xác minh bằng auth.getUser, profile active có role admin và không gắn branch_uuid (Admin tổng). Không tin user_metadata hay role do frontend gửi. Giữ nguyên phân quyền các module khác.
Không có secret n8n/Zalo/Google trong frontend hoặc repo; node n8n giữ tham chiếu credential hiện hữu. Public clients dùng publishable key trong apikey, không bearer.

## Các bước sau khi chủ quán duyệt

1. Áp dụng hai migration theo thứ tự `20261014105926_recruitment_applications.sql` rồi `20261014121225_recruitment_form_admin.sql`. Bản SQL tương đương có trong docs/supabase-sql; không chạy cả hai bản sao cùng lúc.
2. Deploy riêng `recruitment-api --no-verify-jwt`; không thay function khác.
3. Đặt secrets server: RECRUITMENT_HASH_SECRET (ngẫu nhiên, ổn định), RECRUITMENT_DISPATCH_SECRET (ngẫu nhiên riêng), RECRUITMENT_N8N_WEBHOOK_SECRET (ngẫu nhiên riêng), RECRUITMENT_N8N_WEBHOOK_URL (URL đã xác minh), RECRUITMENT_ALLOWED_ORIGINS (origin chính xác, gồm preview khi cần). SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY chỉ server.
4. Kiểm thử staging/synthetic với node Zalo được thay bằng stub để không gửi người nhận thật. Kiểm tra gate/replay/timeout/ack, rồi đối soát output và error behavior của CUSTOM.ZaloUser trước enable. Bản này chưa chứng minh output thực tế của node custom hoặc production end-to-end.
5. Sau duyệt, activate workflow n8n và bật RECRUITMENT_NOTIFICATIONS_ENABLED=true. Có thể tạo scheduler dự phòng phía server/n8n gọi mỗi phút `POST /functions/v1/recruitment-api` Bearer RECRUITMENT_DISPATCH_SECRET, body `{ "action": "retry_notifications" }`. Chưa tạo/activate lịch trong bản nháp này.
6. Bật RECRUITMENT_INTAKE_ENABLED=true và merge/deploy sau khi duyệt. VITE_DATA_SOURCE=supabase và VITE_ENABLE_SUPABASE_RUNTIME_WRITES=true theo chính sách hiện có. Không mở quyền public vào table.
7. Gửi Zalo thật là bước riêng cần chủ quán duyệt. Thống kê mặc định chỉ hồ sơ website mới; không nhập 28 hồ sơ Google Form cũ hoặc gửi lại chúng.

## Kiểm chứng

- npm run build + UTF-8; ESLint phạm vi chạm; smoke:success thanh toán.
- node --test scripts/recruitment-api.test.mjs scripts/recruitment-admin.test.mjs: validation, no false success, body bound/CORS, quyền Admin, filter/pagination/timezone, revision conflict, delivery gate.
- Database PostgreSQL cô lập (PGlite ngoài repo): schema rerun/RLS/grants, idempotency đồng thời, rate limit, summary/filter, snapshot bất biến, config revision, lease/replay/gate không tự gửi lại sau kết quả chưa rõ.
- React renderer cô lập: public form, lỗi giữ nội dung, double click, retry UUID, receipt; Admin filter/detail/summary và save lỗi giữ bản chỉnh sửa.
- smoke:flows lỗi Admin sidebar layout missing đã tái hiện trên main chưa sửa; không sửa module Admin cũ ngoài phạm vi.
- Chưa browser QA/mobile screenshot trang React do thiếu control-browser skill; ảnh n8n chỉ xác minh cấu hình workflow Saved/Inactive.

```sh
npm install --prefix /tmp/ghr-recruitment-qa @electric-sql/pglite react-test-renderer@18.2.0 --no-audit --no-fund
RECRUITMENT_PGLITE_MODULE=/tmp/ghr-recruitment-qa/node_modules/@electric-sql/pglite/dist/index.js node --test scripts/recruitment-database.test.mjs
RECRUITMENT_RENDERER_MODULE=/tmp/ghr-recruitment-qa/node_modules/react-test-renderer/index.js node scripts/run-recruitment-ui-tests.mjs
```
