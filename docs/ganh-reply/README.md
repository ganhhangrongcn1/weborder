# Gánh Reply — triển khai và sử dụng

## Trạng thái bàn giao

Chủ dự án đã xác nhận triển khai production và chọn dùng project Supabase hiện tại, không tạo môi trường riêng trả phí. OpenAI key đã được chủ dự án xác minh trong Dashboard với kết quả `OPENAI_CONNECTED` (chỉ kiểm tra metadata model).

Database module và backend `ganh-reply-api` đã triển khai; công tắc database ban đầu để tắt. Bản giao diện được phát hành từ đúng nền production `7836910bdb0572d40ab73c510732d114b011121a`, chỉ thêm thay đổi Gánh Reply. Điểm truy cập sau phát hành: `/admin/ganh-reply`.

Đã kiểm tra SQL thật trong giao dịch hoàn tác: quyền/RLS, lưu-gửi duyệt, duyệt đúng version, ví dụ chuẩn, chống ghi đè bản cũ, giữ nhạy cảm khi viết lại, phạm vi thống kê và quota. Xác nhận không còn feedback/suggestion/revision/example/usage thử sau rollback.

Audit ban đầu và danh sách điểm tích hợp: [implementation-plan.md](implementation-plan.md). Toàn bộ file thay đổi: [changed-files.md](changed-files.md).

Kiến trúc: UI → hook → service → repository (client admin hiện tại) → `ganh-reply-api` → Supabase/OpenAI. Module không đọc/ghi đơn hàng, thanh toán, tích điểm, khách hàng hoặc lệnh đăng bình luận đối tác. Chỉ đọc metadata profile/chi nhánh phục vụ xác thực và phạm vi quyền.

## Database

[SQL module](../supabase-sql/ganh-reply-module.sql) tạo 10 bảng:

| Bảng | Mục đích |
| --- | --- |
| ai_module_settings | Công tắc module, model và ngân sách, tách khỏi cấu hình nghiệp vụ |
| ai_module_access | Grant Manager/Staff và quyền Brain, tách khỏi role profile |
| ai_brain_documents | Identity, voice, knowledge, principles có version |
| ai_response_rules | Quy tắc chủ cửa hàng bổ sung |
| ai_approved_examples | Ví dụ đã được duyệt, chỉ người có quyền Brain bổ sung/xóa |
| customer_feedback | Bình luận, dữ kiện, insight, trạng thái và phiên bản hiện tại |
| ai_response_suggestions | Ba đề xuất, lý do khuyến nghị và ID/version nguồn retrieval |
| ai_response_revisions | Nội dung chỉnh sửa, đề xuất gốc, tác giả và lý do |
| ai_feedback_reviews | Người duyệt/gửi duyệt và version |
| ai_usage_logs | Model, token thực tế, reservation và trạng thái; không chứa nội dung khách |

RLS bật trên cả 10 bảng. `anon`/`authenticated` không được truy cập trực tiếp; không có policy mở rộng quyền browser. Chỉ `service_role` được truy cập qua backend đã xác thực JWT bằng `getUser` và kiểm tra profile active, module grant, quyền thao tác, chi nhánh và tác giả. Bốn RPC `SECURITY INVOKER`, chỉ grant EXECUTE cho service_role: reserve, store_generation, save_revision, stats. Không có SECURITY DEFINER mới.

Metadata live chỉ đọc đã xác nhận project trong `.env.example`: `branches.id` là bigint, `branches.branch_uuid` UUID unique; `profiles.auth_user_id` unique. Các bảng Gánh Reply chưa tồn tại ở bước preflight; đã được tạo bởi migration module. SQL liên kết `branches(branch_uuid)`, không liên kết id số. Không thay đổi bảng nghiệp vụ hiện có.

Hai thao tác tạo phiên bản và duyệt lưu trong transaction RPC. So sánh version và đề xuất mới nhất để chặn duyệt bản cũ hoặc ghi đè chỉnh sửa khi AI đang chạy. Duyệt ví dụ chuẩn đồng thời với phiên bản cuối.

## Cấu hình staging

Quy trình tham khảo cho môi trường riêng. Với lần phát hành này, chủ dự án đã xác nhận dùng production hiện tại; không tạo Supabase branch trả phí. Không áp dụng lại SQL nếu migration đã có.

1. Chuẩn bị staging có schema `profiles`, `branches` và Supabase Auth tương thích. Tài khoản thử có profile `role=admin`, `status=active`, `branch_uuid=null`.
2. Chạy audit chỉ đọc để xác nhận chưa trùng tên bảng module và kiểu khóa chi nhánh. Áp dụng `docs/supabase-sql/ganh-reply-module.sql` bằng SQL Editor staging. Script có transaction, không tự thực thi khi build. Với lịch sử migration quản lý bằng CLI, tạo migration bằng `supabase migration new ganh_reply_module` rồi đưa nội dung SQL đã review vào migration đó; tránh chạy cả hai lần như hai bản migration khác nhau.
3. Cấu hình Edge Function secrets dưới đây bằng Dashboard; không đưa key vào chat hay git. `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` là biến server tiêu chuẩn của Supabase Edge runtime.
4. Deploy riêng function `ganh-reply-api` vào staging. Giữ xác minh JWT của gateway; function cũng tự xác minh token người dùng. Không deploy các function nghiệp vụ khác.
5. Tạo bản frontend preview trỏ vào URL/publishable key staging; bật các flag bên dưới. Dùng route `/admin/ganh-reply`.
6. Admin nhập Brain thật: ít nhất Brand Identity và Brand Voice. Chỉ thêm chính sách/sản phẩm đã xác minh; không có seed chính sách kinh doanh hoặc số liệu giả.
7. Trong Brain, cấp module role cho auth user UUID tương ứng profile đang hoạt động. Manager dùng profile admin/staff hiện có, không thêm role `manager` vào schema auth toàn hệ thống. Phạm vi grant không được rộng hơn chi nhánh profile. Chỉ Manager toàn hệ thống được ủy quyền Brain; Manager chi nhánh duyệt trong chi nhánh, Staff chỉ xem/chỉnh phản hồi do mình tạo.
8. Kiểm thử thực tế 10 tình huống bên dưới, các vai trò, RLS và race giữa chỉnh sửa/duyệt trước khi cân nhắc production.

| Biến | Nơi cấu hình | Ý nghĩa |
| --- | --- | --- |
| OPENAI_API_KEY | Edge secrets, bắt buộc | Chỉ server gọi OpenAI API chính thức |
| GANH_REPLY_ENABLED | Edge secrets, tùy chọn | Giá trị false là kill switch server ưu tiên cao nhất; khi không đặt thì dùng ai_module_settings.enabled |
| GANH_REPLY_MODEL | Edge secrets hoặc ai_module_settings | Mặc định `gpt-4.1-mini`; cần model hỗ trợ ảnh và strict JSON schema |
| GANH_REPLY_DAILY_TOKEN_BUDGET | Edge secrets hoặc ai_module_settings | Mặc định 2.400.000 token reservation/ngày UTC; giới hạn từ 54.000 đến 24.000.000 |
| VITE_ENABLE_GANH_REPLY=true | Build frontend | Mở workspace; mặc định tắt |
| VITE_DATA_SOURCE=supabase | Build frontend | Dùng nguồn Supabase hiện có |
| VITE_SUPABASE_URL | Build frontend | URL staging |
| VITE_SUPABASE_ANON_KEY | Build frontend | Publishable/anon key staging, không dùng service key |
| VITE_ENABLE_SUPABASE_RUNTIME_WRITES=true | Build frontend | Write gate hiện có; chỉ bật trong preview riêng trỏ staging |

Không đặt OPENAI_API_KEY hay service role key vào biến `VITE_*`. Không dùng ChatGPT session, cookie hoặc token tài khoản ChatGPT cá nhân.

## Hướng dẫn nhân viên — giao diện rút gọn

1. Dán bình luận của khách, bấm **Tạo gợi ý trả lời**.
2. Đọc câu được khuyến nghị, sửa trực tiếp nếu muốn.
3. Admin/Manager bấm **Duyệt & sao chép**. Với phản hồi thông thường, Staff dùng **Lưu & sao chép**. Sau đó dán câu trả lời lên nền tảng của khách.

- Thông tin cửa hàng đã xác minh, nền tảng, chi nhánh và ảnh nằm trong **Thêm thông tin cửa hàng hoặc ảnh**. Nếu thiếu dữ kiện, hệ thống giữ trách nhiệm chưa rõ và không tự đoán. Ảnh vẫn cần kiểm tra và xác nhận văn bản trước khi phân tích.
- **Đổi cách trả lời** mở đủ ba phương án A/B/C. **Xem phân tích và thông tin cần xác minh** mở insight/rủi ro/trách nhiệm chi tiết. Phần chính chỉ hiện insight ngắn và câu đang chọn.
- **Viết lại** có hướng dẫn mặc định, không cần nhập prompt hoặc lý do. Có thể góp ý riêng trong phần mở rộng; bản chỉnh và lý do vẫn được lưu trước khi AI viết lại.
- Phản hồi nhạy cảm của Staff chỉ có **Gửi quản lý duyệt**, không sao chép trước duyệt. Bản đã gửi và chưa chỉnh lại hiển thị **Đang chờ quản lý duyệt**. Khi được duyệt, mở lại từ lịch sử để sao chép.
- Nút kết hợp lưu/duyệt rồi yêu cầu backend trả bản được phép sao chép. Chỉ sao chép đúng version được duyệt. Sao chép lại bản không thay đổi không tạo thêm revision. Nếu trình duyệt từ chối clipboard, bản đã lưu vẫn giữ nguyên và có thể bấm sao chép lại.
- **Lưu bản nháp và góp ý cho Gánh** giữ lựa chọn lưu để xử lý sau, đánh dấu ví dụ tốt (theo quyền Brain) và xem các phiên bản cũ.
- **Bình luận mới** bắt đầu tình huống khác. Các mục **Lịch sử**, **Kiến thức Gánh**, **Thống kê** vẫn có sẵn. Không tự đăng bình luận lên mạng xã hội.

## Gánh Brain và giới hạn AI

System prompt giữ các nguyên tắc bất biến. Bình luận, ảnh, tài liệu và feedback chỉ là dữ liệu ngữ cảnh. Có kiểm tra JSON và chặn các mẫu nhận lỗi/cam kết không phù hợp ở backend, nhưng regex không chứng minh mô hình luôn hiểu đúng sự thật hoặc mọi cách diễn đạt. Nhân viên vẫn phải xem xét nội dung; tình huống an toàn thực phẩm/hoàn tiền/pháp lý hoặc AI đánh giá nhạy cảm phải qua người duyệt.

Retrieval phiên bản đầu dùng từ khóa Unicode, không thêm embedding/vector dependency: Brand Identity/Voice/Principles gần nhất, kiến thức liên quan, tối đa 3 ví dụ chuẩn và 3 memory sửa liên quan. Ví dụ chuẩn được giới hạn theo chi nhánh hiện tại hoặc ví dụ toàn hệ thống. Memory chỉ lấy trong phạm vi quyền và chi nhánh. Tìm ứng viên trong 100 tài liệu/ví dụ/phản hồi gần nhất, 50 quy tắc; đây là giới hạn v1 cần mở rộng bằng full-text/vector index khi lượng dữ liệu tăng. Không tuyên bố tự học hay fine-tune. Thay đổi Brain áp dụng ở lần phân tích tiếp theo, không cần deploy lại.

Nội dung context bị giới hạn trước khi gọi API; bộ identity/voice/principles được chọn và toàn bộ quy tắc trong danh sách ứng viên phải vừa giới hạn, nếu quá dài sẽ yêu cầu rút gọn thay vì bỏ quy tắc; nếu quá dài hệ thống yêu cầu rút gọn, thay vì âm thầm gửi request không giới hạn. Không lưu ảnh ở ứng dụng; `store=false` trên Chat Completions không đồng nghĩa cam kết zero retention của nhà cung cấp. Cần áp dụng chính sách dữ liệu của tài khoản OpenAI đang sử dụng.

## Giới hạn request và chi phí dự kiến

- 6 lần gọi AI/phút/người, 100/ngày/người. Quota toàn hệ thống được reserve nguyên tử bằng advisory lock trong database, áp dụng cho cả OCR và viết lại.
- Mỗi lần giữ chỗ 54.000 token; text input tối đa 48.000 byte, output tối đa 3.500 token và ảnh low detail. Reservation là trần thận trọng cho kiểm soát chi phí, không phải số token thực tế đã dùng. Lần lỗi vẫn giữ reservation đến hết ngày để chặn retry làm vượt ngân sách.
- Mặc định 2.400.000 token reservation cho phép tối đa 44 lần gọi AI/ngày toàn hệ thống. Có thể tăng ngân sách theo nhu cầu. `ai_usage_logs` lưu token API thực trả về để tính chi phí chính xác; không log bình luận, ảnh, key hoặc raw provider error.
- Công thức: `(input_tokens × giá input + output_tokens × giá output) / 1.000.000`. Cộng OCR, viết lại, các request bị tính phí dù validation thất bại; chi phí Supabase/hosting tính riêng.
- Ví dụ ngân sách, KHÔNG phải báo giá đã xác minh: giả sử input $0,40/triệu và output $1,60/triệu, trung bình 5.000 input + 1.500 output token/phản hồi thì 1.000 phản hồi ≈ **$4,40**, chưa có OCR/viết lại. Nếu mỗi phản hồi viết lại một lần tương đương, khoảng **$8,80**. Kiểm tra giá model hiện hành tại [OpenAI API pricing](https://openai.com/api/pricing/) trước khi chốt ngân sách; phiên này chưa xác minh được bảng giá qua HTTP.

## Kiểm thử và bằng chứng

Môi trường kiểm thử: Node 24, Chromium cục bộ. Không thêm dependency.

```sh
npm run test:ganh-reply
npm run build
npm run dev -- --host 127.0.0.1 --port 5173
# terminal khác, chỉ dùng Vite cục bộ:
npm run test:ganh-reply:browser
```

- 26 test hợp đồng/guard qua, gồm 10 tình huống: giá mắc đúng định lượng, thiếu topping thật, chờ khai trương, ghé nhiều lần không mua được, hiểu nhầm đặt trước, khen, mỉa mai, ngôn ngữ tiêu cực, an toàn thực phẩm và yêu cầu hoàn tiền.
- Test dùng handler Edge Function thực đã bundle và Supabase/OpenAI giả lập. Kiểm tra phân quyền, chặn chi nhánh khác, không tự kết luận khi thiếu facts, phiên bản được duyệt trước sao chép, redaction và dữ liệu khách không được thay thế system prompt. Đây KHÔNG phải kết quả đánh giá chất lượng mô hình thật hoặc bằng chứng chống mọi prompt injection.
- Browser fixture kiểm tra hook/UI thực: nhập → phân tích → chọn B → lưu → duyệt → lịch sử → mở lại, tab Brain trống và dashboard trống; desktop 1440px/mobile 393px, không tràn ngang, không page error. Tất cả request backend được giả lập rõ trong script; không dùng dữ liệu giả trong dashboard thật. Script tạo HTML tạm và xóa sau khi chạy; screenshot tại `/tmp/ganh-reply-desktop.png`, `/tmp/ganh-reply-mobile.png`.
- Build và kiểm tra UTF-8 qua. Edge Function bundle cú pháp qua esbuild; backend đã được Supabase build/deploy; SQL production đã kiểm tra trong giao dịch rollback. Chưa có phiên browser đăng nhập Admin để kiểm tra đầy đủ sinh câu trả lời OpenAI.
- ESLint riêng toàn bộ file module/thay đổi qua. `npm run lint` toàn repo báo 118 errors/281 warnings trong mã có sẵn; không sửa ngoài phạm vi.
- `npm run smoke:flows` dừng ở `Admin sidebar layout missing`: script đòi literal `className="admin-sidebar"` vốn không có trong `HEAD:src/pages/admin/AdminSidebar.jsx`. File sidebar không được thay đổi. Chưa thể tuyên bố smoke toàn bộ hệ thống qua.

Trước nghiệm thu staging: chạy 10 tình huống qua API thật với Brain thật; chấm 6 tiêu chí (insight, sự thật, giọng Gánh, tôn trọng khách, uy tín, tự nhiên/ngắn gọn) theo thang 1–5. Không chấp nhận câu tự nhận lỗi/đề nghị bồi thường khi chưa có căn cứ. Kiểm tra token thực, request ảnh, lỗi OpenAI, quota đồng thời, RLS/RPC grants, Staff không duyệt/không sửa Brain, Manager bị khóa chi nhánh và thay đổi version trong lúc AI chạy. Kiểm tra advisors sau khi áp dụng SQL staging.

## Khôi phục và production

Đặt `GANH_REPLY_ENABLED=false`, hoặc tắt ai_module_settings.enabled; nếu cần ẩn UI thì tắt frontend flag và build lại. Mã mới không có trigger/subscription trên bảng nghiệp vụ. Không xóa bảng khi rollback nếu chưa xuất dữ liệu module. Cần chính sách lưu trữ/xóa dữ liệu module theo vận hành thực tế; chưa có job xóa dữ liệu tự động.

Chủ dự án đã bỏ qua môi trường riêng và xác nhận triển khai production. Migration module đã được áp dụng; backend mới triển khai riêng. Không gửi bình luận lên nền tảng nào. Khôi phục bằng công tắc riêng; không xóa bảng để rollback.

## Tóm tắt xác minh luồng

| Ranh giới | Kết quả | Bằng chứng/giới hạn |
| --- | --- | --- |
| Render UI desktop/mobile | Qua với fixture | Chromium 1440/393 px, không page error/tràn ngang |
| Hook → service → render | Qua với fixture | Phân tích, chọn, lưu, duyệt, lịch sử, Brain và dashboard trống |
| API → kiểm tra quyền/quy tắc → response | 26 test qua | Handler thật, DB/provider giả lập; không phải kiểm thử mô hình thật |
| Metadata database hiện tại | Đã đọc và đối chiếu | Khóa UUID chi nhánh và kiểu profile khớp; preflight xác nhận chưa có bảng trùng tên |
| SQL/RLS/RPC production | Qua | RLS/grants đúng trên 10 bảng, regression SQL chạy rồi rollback toàn bộ dữ liệu thử |
| OpenAI thật → dữ liệu → UI | Chưa xác minh đầy đủ | Key đã kiểm tra model thành công; cần phiên Admin đăng nhập để kiểm tra sinh câu trả lời từ UI |

Sau trao đổi: chủ dự án chọn OpenAI làm bộ não AI. Mã dùng OpenAI API chính thức; không yêu cầu người dùng hiểu prompt engineering hay có phiên ChatGPT cá nhân. Phí API cần tài khoản/API billing riêng theo OpenAI; đăng ký ChatGPT không tự cấu hình API key cho module.

## Kiểm tra key đã lưu trên Supabase

Chủ dự án đã xác nhận lưu `OPENAI_API_KEY` trong Secrets của project hiện tại. Giá trị key không được đưa vào chat, đọc ra hoặc sao chép vào workspace. Chủ dự án đã gửi kết quả HTTP 200, OPENAI_CONNECTED, model gpt-4.1-mini từ Dashboard; chưa kiểm tra generation hoặc số dư.

Đã chuẩn bị hàm độc lập `supabase/functions/ganh-reply-connection-check/index.ts`: chỉ chấp nhận server service-role Authorization, gọi GET metadata model OpenAI, trả trạng thái đã lọc. Với JWT được gateway mint, xác minh token bằng HEAD endpoint schema PostgREST, không truy vấn bảng hoặc đọc bản ghi khách. Không sinh câu trả lời, không kiểm tra số dư và không trả key/raw provider response. Không thay thế backend Gánh Reply; không bật frontend. Chủ dự án đã xác nhận “oke e” cho việc triển khai riêng hàm kiểm tra. Đã deploy version 2, trạng thái ACTIVE, verify_jwt=true vào project hiện tại. Request POST không có token trả 401 từ gateway như mong đợi. Request Dashboard đã trả OPENAI_CONNECTED; chưa kiểm tra sinh nội dung hoặc số dư bằng hàm này. Sau đó chủ dự án đã xác nhận riêng việc triển khai module và SQL production.

8 kiểm thử giả lập cho hàm kiểm tra đã qua (bao gồm regression gateway-minted JWT, JWT giả, anon/user JWT và fail-closed khi endpoint xác minh lỗi): từ chối caller không có quyền, thiếu key, metadata thành công và key bị provider từ chối. Chạy bằng `node --test --test-isolation=none scripts/ganh-reply-connection-check.test.mjs`.

### Sửa xác thực hàm kiểm tra — version 2

Nhật ký chỉ đọc xác nhận các request 403 có role service_role và compatibility mode minted: gateway đã đổi key thành JWT khác nên so sánh chuỗi với legacy key không phù hợp. Version 2 giữ đường so sánh legacy và bổ sung xác minh JWT minted qua HEAD API schema PostgREST. Payload role chỉ là bước lọc; không chấp nhận role tự khai nếu backend từ chối token. Không log token, không đọc dữ liệu bảng, giữ verify_jwt=true. Đã deploy bản sửa trong phạm vi hàm kiểm tra được chủ dự án cho phép; Dashboard đã xác nhận kết nối metadata OpenAI thật thành công.

## Kiểm soát rollout và khôi phục module

- Cấu hình `public.ai_module_settings` giữ row id `ganh-reply`. Khi enabled=false, backend đã xác thực cũng từ chối thao tác module. Đặt `GANH_REPLY_ENABLED=false` trong server secrets sẽ luôn thắng công tắc database.
- Rollback chức năng nhanh: `update public.ai_module_settings set enabled=false,updated_at=now() where id='ganh-reply';`. Không xóa bảng hoặc dữ liệu để rollback.
- Vercel production chỉ thêm flag công khai `VITE_ENABLE_GANH_REPLY=true`; không thay các flag ghi dữ liệu, khóa Supabase hoặc cấu hình thanh toán hiện có.
- Bộ tài liệu khởi đầu gồm Identity, Voice và Principles lấy từ yêu cầu chủ dự án; chưa có chính sách giá/đổi trả/bồi thường tự suy đoán hoặc ví dụ chuẩn giả. updated_by=null cho tài liệu hệ thống ban đầu; khi người dùng chỉnh trong UI sẽ ghi đúng auth user.
- Menu mới chỉ được bổ sung cho staff/Manager sau xác minh quyền backend; không mở thêm quyền kho, đơn hàng hoặc CRM. Có boundary riêng để lỗi render Gánh Reply không thay thế toàn bộ trang Admin.
- Security advisor ghi INFO `rls_enabled_no_policy` cho bảng module vì thiết kế server-only. Đây là chủ đích: browser bị thu hồi grants và không có policy đọc dữ liệu. Tham khảo [RLS Enabled No Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- 26 test module và 15 test inventory access qua; Supabase config smoke qua. Không tuyên bố checkout, thanh toán và toàn bộ nghiệp vụ đã được kiểm thử giao dịch thật.

## Cập nhật trải nghiệm theo phản hồi chủ dự án

Chủ dự án đã xác nhận luồng tạo ba phương án AI thật hoạt động, đồng thời yêu cầu giao diện đơn giản hơn. Bản rút gọn chỉ thay đổi frontend/hook và kiểm thử browser; không đổi database, backend, prompt, quota hoặc phân quyền. Kiểm thử browser có các nhánh: Admin duyệt+sao chép, sao chép lặp không thêm revision, viết lại không cần nhập prompt, đủ ba phương án mở rộng, lịch sử, desktop/mobile, Staff thường, Staff nhạy cảm, Admin nhạy cảm và phản hồi duyệt sai version bị chặn sao chép. Fixture không kết nối Supabase/OpenAI và không tạo dữ liệu trên production. Clipboard được giả lập có kiểm soát vì quyền clipboard của host headless khác trình duyệt người dùng; có kiểm tra cả từ chối clipboard rồi thử lại mà không tạo thêm revision.
