# Kiểm tra preview và tiến độ

Vercel deployment `dpl_AT4ZtDvtqNbBLMJTys6uDsWmj5jK` của `ganhhangrongcn1/weborder`, nhánh `codex/supabase-safe-optimization-20261006`, trạng thái READY, target preview. SHA khớp HEAD `218d02edb9530434885d22a1bff9a6a9d5e319b5`. Đã mở `/admin` và xác nhận trang đăng nhập tiếng Việt hiển thị. Không coi READY là đã kiểm thử báo cáo hoặc đã phát hành production.

Đã chạy chung 5 bộ kiểm thử diagnostics, ma trận staging, CRM, session boundary và admin reports: 32/32 đạt trong giả lập. Staging role matrix chưa chạy với dữ liệu/tài khoản thật. Build frontend đã đạt ở đợt 12; lượt này chỉ cập nhật tài liệu và kiểm tra preview.

## Danh mục kiểm tra và giới hạn

1. Dashboard hiển thị dữ liệu, đổi ngày/chi nhánh và thao tác làm mới hoạt động.
2. Báo cáo kinh doanh và khách hàng hiển thị, không có lỗi mới so với production.
3. Đăng xuất rồi dùng tài khoản khác: không giữ cache phiên trước; không để báo cáo cũ tự cập nhật sau logout.
4. Bảng chẩn đoán chỉ hiển thị endpoint/mã lỗi được phép, không thông tin khách.

Các thao tác này đọc dữ liệu production qua preview nếu preview được cấu hình cùng database. Không tạo đơn, thu tiền, nhận điểm hoặc hoàn điểm để kiểm thử. CRM force refresh có thể ghi bảng cache báo cáo riêng; chưa bấm làm mới cưỡng bức trong lượt kiểm tra này.

Chủ dự án đã đăng nhập admin trên preview. Dashboard hiển thị các KPI, món bán chạy, khung giờ và hiệu suất chi nhánh. Panel chẩn đoán mở được; snapshot ghi 40 lượt gọi HTTP, 0 lỗi, 0 lượt dừng. Đây chỉ là mẫu quan sát tại tab, không chứng nhận không có lỗi toàn hệ thống. Bộ lọc chi nhánh mở được; chưa thay lựa chọn để kiểm tra kết quả lọc.

Trang tổng quan khách hàng tải xong và hiển thị chỉ số/phân tích trên phiên admin thật; không xuất tên/số điện thoại khách vào báo cáo này. Chưa đối chiếu tính đúng toàn bộ số liệu hoặc benchmark thời gian. Chưa thực hiện logout/đổi tài khoản thật và chưa phát hành production. Chạy thêm 14 kiểm thử checkout/giới hạn dùng điểm: đạt; cùng 32 ca phía trên, tổng 46 ca giả lập đạt. Tiến độ toàn lộ trình ước lượng 56/100 (55–60%), theo bảng trong roadmap; không phải số đo giảm tải.

Rà source `logoutAdmin` thấy dùng `auth.signOut()` không truyền scope. Chưa bấm logout để tránh ảnh hưởng phiên đăng nhập ở thiết bị khác cùng tài khoản. Tài liệu Supabase xác nhận scope mặc định global: https://supabase.com/docs/reference/javascript/auth-signout . Cần kiểm tra đổi user bằng tài khoản thử riêng hoặc chốt chính sách đăng xuất trước; không tự đổi auth behavior trong đợt kiểm tra preview.

File mới: báo cáo này. File cập nhật: `supabase-optimization-roadmap-2026-10-06.md`.
