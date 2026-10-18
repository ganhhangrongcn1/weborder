# Gánh Reply — audit và kế hoạch tích hợp

Ngày audit: 18/10/2026. Phạm vi: mã nguồn và kiểm tra metadata chỉ đọc trên Supabase project khớp `.env.example`. Chưa áp dụng SQL hoặc triển khai remote.

## Kết quả audit

- React 18, Vite 5, React Router 6; `src/app/routes.jsx` đăng ký route, `src/app/routeState.js` ánh xạ URL/menu. `src/features/app/AppAdminRoutes.jsx` bọc `AdminAuthBoundary`, `AdminApp` và `AdminPageContent`.
- `src/services/adminAuthService.js` xác minh Supabase session, đọc `profiles` theo `auth_user_id`, yêu cầu `status = active`; các vai trò được đăng nhập là admin/staff/kitchen. Không có Manager độc lập trong auth hiện tại.
- `adminModuleAccessPolicy.js` giới hạn tài khoản chi nhánh vào ca và kho. Tích hợp chỉ thêm quyền truy cập mục Gánh Reply cho admin/staff; quyền thực tế do backend kiểm tra lại.
- Supabase client có scope admin riêng. Các write phải tuân thủ `shouldWriteDomainToSupabase`, không dùng localStorage làm nguồn dữ liệu chuẩn.
- Đã có `partner_reviews`, `partner_review_sources`, `partner_review_reply_commands` và Edge Function `partner-review-source-api`; có khả năng gửi phản hồi GrabFood. Module mới KHÔNG gọi hoặc ghi vào các cấu trúc này.
- Schema được kiểm tra từ `docs/supabase-sql`, `supabase/migrations` và services. Connector Supabase cho phép kiểm tra metadata live chỉ đọc: `branches.id` là bigint, khóa liên kết phải là `branches.branch_uuid` (UUID, unique); `profiles.auth_user_id` unique; các bảng module chưa tồn tại. SQL module sử dụng đúng khóa branch_uuid. Không đọc dữ liệu khách.
- Không có secret/runtime variable được cấp bởi môi trường. HTTP proxy hiện không kết nối được; không thể gọi OpenAI hoặc triển khai staging qua shell từ phiên này. Đã tra tài liệu auth hiện tại qua connector Supabase.

## Kiến trúc

`AdminPageContent -> GanhReplyWorkspace -> useGanhReply -> ganhReplyService -> ganhReplyRepository -> ganh-reply-api -> Supabase/OpenAI`.

Một route độc lập `/admin/ganh-reply`, bốn tab: soạn, lịch sử, Brain, thống kê. Lazy load trang. Thêm domain write policy riêng, mặc định tắt bằng feature flag. Backend có kill switch độc lập.

Mọi bảng mới bật RLS, thu hồi quyền anon/authenticated; chỉ backend service role truy cập sau khi xác thực user và kiểm tra active profile, module grant, branch. Không dùng user_metadata để cấp quyền. Grant Manager/Staff lưu riêng ở `ai_module_access`, do global Admin cấp. Không đổi enum hoặc chính sách của profiles.

Brain: tài liệu và quy tắc có thể sửa trên dashboard; truy xuất theo từ khóa, kèm ví dụ đã duyệt và feedback sửa gần đây liên quan. Đây là retrieval/few-shot, không fine-tune. Quy tắc an toàn bất biến nằm trong system prompt và bộ kiểm tra backend. Dữ liệu khách và tài liệu là context, không phải system instructions.

Backend: trích xuất ảnh -> người dùng kiểm tra văn bản -> phân tích + 3 đề xuất có JSON schema -> lưu phiên bản -> chỉnh sửa/yêu cầu viết lại -> gửi duyệt hoặc duyệt -> sao chép. Nội dung nhạy cảm chỉ được sao chép sau khi Manager/Admin duyệt đúng phiên bản. Không có endpoint đăng mạng xã hội.

## File tích hợp sẽ sửa

- `src/app/routes.jsx`, `src/app/routeState.js`: URL và ánh xạ điều hướng.
- `src/pages/admin/adminNavigation.js`, `adminModuleAccessPolicy.js`: mục menu và khả năng mở workspace cho staff/admin.
- `src/pages/admin/pages/AdminPageContent.jsx`: lazy mount workspace.
- `src/services/repositories/writeThroughPolicy.js`: domain remote-only, không fallback.

## File module mới

- `src/pages/admin/ganh-reply/GanhReplyWorkspace.jsx`, `ganhReply.css`.
- `src/features/ganh-reply/useGanhReply.js`.
- `src/services/ganhReplyService.js`, `src/services/repositories/ganhReplyRepository.js`.
- `supabase/functions/ganh-reply-api/index.ts`, `policy.js`.
- `docs/supabase-sql/ganh-reply-module.sql`: schema độc lập, grants và atomic rate limit.
- `scripts/ganh-reply.test.mjs`: 10 tình huống và các ca phân quyền/prompt injection.
- `docs/ganh-reply/README.md`: staging, biến môi trường, chi phí và hướng dẫn.

## Thứ tự và điều kiện kiểm chứng

1. Audit và công bố kế hoạch này trước khi chỉnh mã tích hợp.
2. Thêm SQL/backend/Brain, không áp dụng vào database production.
3. Thêm UI độc lập và write guard.
4. Kiểm thử hợp đồng, an toàn, build; đánh giá ngôn ngữ thật cần API staging.
5. Preview build cục bộ; staging đầy đủ cần Supabase staging, OpenAI key và quyền triển khai.
6. Báo cáo kết quả và các giới hạn thật. Chỉ production sau xác nhận của chủ dự án.
