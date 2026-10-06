# Đợt 11 — cache CRM theo phiên đăng nhập

## Đã sửa

Cache CRM trước đây tồn tại theo module, chưa xóa khi người dùng thay đổi. Bổ sung boundary đọc session cục bộ trước khi dùng cache; xóa cache/in-flight khi đổi client, đổi user, đăng xuất hoặc USER_UPDATED. Kết quả về muộn từ ngữ cảnh trước trả null và không ghi lại cache.

Không lưu token, không gọi bảng dữ liệu, không thay client/auth scope/RLS, không đổi TTL 60 giây hoặc force refresh. TOKEN_REFRESHED cùng user không tự xóa cache. Callback auth chỉ cập nhật bộ nhớ, không gọi SDK bên trong. Khi thay client, listener cũ được unsubscribe; module giữ một listener cho client đang dùng. Helper có dispose cho lifecycle cần kết thúc.

## Kiểm chứng

12 kiểm thử giả lập gồm 7 CRM và 5 boundary: cache sau đổi user, response sau logout, replacement/cleanup, refresh token cùng user, auth thay đổi giữa lúc đọc session, lỗi session và giữ các kiểm thử fallback/race trước đó. Build, UTF-8 và lint các file thay đổi đạt.

## Giới hạn

Chỉ áp dụng CRM. Cache dashboard/business analytics đã có ngày/chi nhánh trong key nhưng chưa được xử lý theo session trong đợt này. USER_UPDATED và đổi session được nhận diện; thay quyền/chi nhánh trực tiếp trên database mà không có auth event chưa tự invalidation. Đây là cache correctness, không thay thế RLS, không chứng minh quyền live và không đo mức giảm CPU/latency. Chưa triển khai production.

## File

- Cập nhật `src/services/adminCrmAnalyticsService.js`, `scripts/crm-analytics-fallback.test.mjs`.
- Mới `src/services/supabase/sessionCacheBoundary.js`, `scripts/session-cache-boundary.test.mjs`, báo cáo này.

Hoàn tác bằng revert commit của đợt này. Bước tiếp theo: áp dụng boundary tương tự cho dashboard/business analytics sau kiểm tra caller; đo theo endpoint/cửa sổ thời gian trước đánh giá hiệu năng.
