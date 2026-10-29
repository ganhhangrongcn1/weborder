# Tuyển dụng: tạm ngưng riêng chi nhánh đã đủ người

## Vấn đề và thay đổi

- Trước thay đổi đã fetch GitHub; nguồn `origin/main` tại `4941f0d0e64ebbab61ff937f3e5b844b4e7234d3`. Cloud `recruitment-api` v10 và nguồn local trùng nhau; chỉ validator cấu hình cần thay đổi.
- Admin khóa toàn bộ danh sách chi nhánh và backend yêu cầu đủ cả bốn lựa chọn, nên không thể ẩn riêng một chi nhánh.
- Thêm checkbox **Đang tuyển / Tạm ngưng** cho từng chi nhánh. Tên chi nhánh vẫn cố định; chỉ thay danh sách được phép nhận hồ sơ mới. Hồ sơ, thống kê và bộ lọc lịch sử vẫn giữ tên/định danh cũ.
- Ứng viên chỉ thấy các chi nhánh đang tuyển. Cả validator client/server từ chối chi nhánh đã ngưng; form đang mở có revision cũ được yêu cầu tải lại trước khi gửi.
- Cần giữ ít nhất một chi nhánh. Muốn ngưng toàn bộ, dùng công tắc Nhận hồ sơ ứng tuyển ở Nội dung & tiếp nhận.

## Đã áp dụng theo yêu cầu

- Deploy riêng `recruitment-api` v11 ACTIVE, giữ nguyên `verify_jwt=false` và các kiểm tra quyền Admin trong handler. Không đổi luồng thông báo, secret hoặc workflow n8n.
- Tạm ngưng **306A Lê Hồng Phong, Phường Phú Lợi, TP.HCM (Bình Dương Cũ)**.
- Settings `default` revision **4 → 5**. Chỉ đổi options câu hỏi branch; các câu hỏi đang ẩn, nội dung, ca làm và cài đặt còn lại giữ nguyên.
- SQL có khóa dòng và kiểm tra revision trước khi cập nhật; dừng nếu có phiên Admin khác thay đổi, không ghi đè.
- Đã gọi thật action **get_form** chỉ đọc: revision 5, còn Thích Quảng Đức, Đường 30/4 và VietSing. Không còn Lê Hồng Phong trong lựa chọn công khai.
- Kiểm tra checksum xác nhận cả **26 hồ sơ cũ nguyên vẹn**; không gửi hồ sơ thử, không tạo/sửa thông báo hoặc gửi Zalo.

## Kiểm tra

- 36 kiểm tra API/Admin đạt: quyền truy cập, bật lại chi nhánh, từ chối tên giả/rỗng, ngưng chi nhánh, form cũ, revision CAS, gửi trùng và hợp đồng thông báo mock.
- 5 kiểm tra React thật đạt: tắt Lê Hồng Phong, xem trước biến mất ngay, lưu cấu hình, bật lại hiện lại, giữ ít nhất một nơi đang tuyển, các luồng Admin/form cũ.
- React test renderer 18.2.0 cài trong `.tmp/recruitment-visibility-qa`; không đổi dependency hoặc lockfile dự án.
- ESLint runtime, UTF-8 và kiểm tra diff; build production qua `npm run build` trong pipeline Vercel của main.

## Cách dùng

Tải lại Admin → Tuyển dụng → **Câu hỏi & cài đặt** → chọn **Cửa hàng bạn muốn ứng tuyển** → bật/tắt tại **Chi nhánh đang tuyển** → **Lưu thay đổi**. Có thể bật lại Lê Hồng Phong khi cần tuyển tiếp.

## File

- Cập nhật `supabase/functions/_shared/recruitmentForm.js`: cho phép tập con chi nhánh có mã/tên ổn định.
- Cập nhật `src/pages/admin/recruitment/RecruitmentQuestionEditor.jsx`: công tắc từng chi nhánh.
- Cập nhật `src/pages/admin/recruitment/recruitmentEditor.css`: bố cục công tắc.
- Cập nhật `scripts/recruitment-admin.test.mjs`, `scripts/recruitment-ui.test.jsx`: hồi quy backend và UI.
- Mới `docs/supabase-sql/2026-10-29-pause-le-hong-phong-recruitment.sql`: ghi lại thao tác cấu hình đã áp dụng; không phải migration schema.
- Mới báo cáo này.

## Hoàn tác khi cần tuyển lại

Bật lại chi nhánh trong Admin và lưu bằng revision mới nhất. Không khôi phục cả JSON revision 4 vì có thể ghi đè các chỉnh sửa khác. Không cần sửa bảng ứng viên hoặc n8n.
