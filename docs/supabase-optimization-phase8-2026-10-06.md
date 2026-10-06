# Đợt 8 — theo dõi kết nối và kiểm thử an toàn

## Đã thực hiện trong mã nguồn

- Bổ sung bảng kết nối thu gọn ở dashboard quản trị. Dữ liệu chỉ thuộc tab hiện tại, lưu trong RAM tối đa 200 bản ghi/15 phút; không gửi log lên database.
- Đo số yêu cầu HTTP, lỗi, yêu cầu bị hủy, phản hồi HTTP thành công gần nhất và p95 đến headers theo endpoint/scope khi đủ 20 mẫu. Không coi đây là thời gian xử lý SQL hay sức khỏe toàn hệ thống.
- Chỉ giữ tên endpoint trong danh sách cho phép, mã HTTP, thời lượng và request ID đúng dạng UUID. Không giữ tham số, số điện thoại, body, token, header hoặc nội dung lỗi.
- Mã lỗi SDK của RPC món phổ biến được ghi riêng; không thay chính sách cache/fallback, xác thực hoặc retry.
- Bộ kiểm tra quyền SELECT dành riêng cho staging: chặn project production và service-role; kiểm tra người dùng/chi nhánh và yêu cầu seed có kiểm tra đọc được để tránh hiểu nhầm hàng không tồn tại là bị RLS chặn. Admin không bị ép có một ca từ chối nếu chính sách cho phép đọc toàn bộ.
- Cập nhật mock tích dấu trong bộ kiểm thử checkout hiện có; không thay logic checkout/tích điểm.

## Kết quả và giới hạn

- Kiểm thử fetch/SDK: giữ nguyên input, signal, response và lỗi; không thêm yêu cầu hay đọc body; kiểm tra TTL, giới hạn bộ nhớ, phân nhóm và loại bỏ dữ liệu riêng tư.
- 14 ca checkout/giới hạn dùng điểm đạt trong môi trường giả lập. Bao gồm mất phản hồi, lỗi ghi đơn, giới hạn voucher/điểm và hàng đợi POS tiền mặt.
- Build và kiểm tra UTF-8 đạt trên workspace hiện tại. Workspace có thay đổi khác ngoài phạm vi đợt này; không đưa chúng vào bản thay đổi này.
- Chưa chạy ma trận quyền thật: cần project staging, tài khoản thử và fixture tổng hợp. Script chỉ kiểm tra SELECT, chưa chứng minh quyền ghi/RPC.
- Chưa chứng minh hoàn tiền/hoàn điểm, thanh toán thực tế hoặc auth refresh qua môi trường thật. Bộ SQL loyalty cũ đang tham chiếu migration được đổi tên trong thay đổi khác của workspace; không tự sửa migration này.
- Supabase AI đã phản biện: phân biệt thời gian headers với SQL; scope client không phải role RLS; HTTP thành công không chứng minh nghiệp vụ thành công; staging chưa chạy phải ghi chưa chạy.

## Áp dụng và hoàn tác

Đợt này không thay schema, RLS, dữ liệu đơn, công thức tích điểm hoặc cấu hình worker. Mã frontend cần bản phát hành và tải lại trang mới có hiệu lực; chưa coi build là đã triển khai production. Hoàn tác bằng revert các file của đợt này rồi build/phát hành lại.

## File

Mới: `supabaseDiagnostics.js`, `supabaseDiagnosticFetch.js`, `useSupabaseDiagnostics.js`, `AdminConnectionDiagnostics.jsx`, `supabase-diagnostics.test.mjs`, `supabase-role-matrix.mjs` và báo cáo này.

Cập nhật: `supabaseRuntimeClient.js`, `popularProductService.js`, `AdminDashboardPage.jsx`, `checkout-order-persistence.test.mjs`, đề xuất cải thiện.
