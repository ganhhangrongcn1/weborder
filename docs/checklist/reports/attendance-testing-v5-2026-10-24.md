# Testing Version 5 — 24/10/2026

CLI chính thức báo Deploy Done, Version 5 cho Mini App 2442731166050783503. Chỉ Testing; không gửi quyền, xét duyệt, Publish/Live.

Gói cuối: 566268 byte, file lớn nhất 404501 byte. Cấu hình manifest source đã khôi phục sau upload. DEMO_ONLY=true.

Nội dung: UI mới logo GHR; bỏ ghi chú chấm công ở màn đăng nhập; Đăng ký tài khoản mở form mô phỏng (chưa tạo Auth/database, chưa đăng nhập bằng tài khoản mới); Quyền riêng tư mở đọc; điện thoại liên kết sau đăng nhập với ba tình huống khớp/không khớp/từ chối; không bắt buộc chấm công; link trang/chi nhánh, Back nội bộ; cấu hình gọi/Maps/link ngoài riêng theo chi nhánh còn để trống theo yêu cầu.

Kiểm tra: 18 unit test đạt trước thay đổi UI đăng ký; build cuối và ESLint phần UI đăng ký đạt. Browser: đăng nhập, PDF tải và mở, tài liệu/video sẵn sàng; các luồng điện thoại/Back đã kiểm tra ở lượt trước; đăng ký mẫu nhập hợp lệ hiện kết quả rõ không tạo tài khoản thật. Không tạo ca công mới hoặc gọi số thật. Chưa xác nhận trên Zalo điện thoại.

CLI ban đầu khởi động chậm ở chuỗi require module; đã dừng đúng các lượt treo, không upload thành công ở các lượt đó. --skipUpdate không hỗ trợ cho deploy; đã bỏ và chạy lại deploy chính thức thành công. Không đổi thư viện hay thiết lập bảo mật máy. Cảnh báo TLS là từ CLI hiện có.

Link: https://zalo.me/s/2442731166050783503/?env=TESTING&version=5

File UI bổ sung: attendance-miniapp/src/components/Register.jsx (mới), Login.jsx và Brand.jsx (cập nhật). QR/ảnh trong tmp ignored, không ghi thông tin đăng nhập vào báo cáo. Chưa đồng bộ lượt thay đổi này lên Cloud.
