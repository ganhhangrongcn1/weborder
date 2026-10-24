# Rà soát UI/UX: chữ và nút bấm

Ngày 24/10/2026. Phạm vi source UI demo attendance-miniapp; không đổi nghiệp vụ, dữ liệu, API, không upload Testing/Cloud.

## Đã chỉnh

- Chữ phụ 9–11px quá nhỏ: nâng lên 12–13px, nội dung thường 14–15px, label 14px, input 16px. Tiêu đề trang 27–28px, thẻ 19px. Giữ đồng hồ lớn vì là dữ liệu chính.
- Nút thường 48px, nút chính chữ 16px, nút phụ chữ 14px; nút chữ/icon tối thiểu 44px. Ô nhập 50px, ô đăng nhập/đăng ký 54px.
- Nút tải action-link và file-link (Maps/liên hệ) cùng vùng chạm, padding, border/focus/hover với nút phụ. Checkbox có label chạm chung; công tắc trong sheet giữ hình dạng riêng.
- Đồng bộ màu chữ hỗ trợ đăng nhập/đăng ký, tăng tương phản link và nút Cho phép. Giữ sheet chia sẻ xanh mô phỏng theo mẫu; CTA nghiệp vụ vàng GHR. Đăng xuất giữ đỏ phân biệt hành động.
- Khoảng cách label 8px, giữa trường 18px; thẻ mobile bo22px; xử lý chữ dài, hàng bằng chứng và nút tự xuống dòng ở <=360px; thống kê chuyển một cột ở màn nhỏ.
- Bổ sung focus link/summary, touch-action và chặn cuộn lan trong modal. Không thêm thư viện.

## Xác minh

- Browser 390px: đăng nhập không overflow, nút chữ/icon44px và CTA54px.
- Browser320px: đăng ký không overflow, 4 ô input16px/54px. Năm màn Chấm công/Lịch sử/Điều chỉnh/Đào tạo/Tài khoản không overflow, không có button hiển thị dưới43px trong phép đo DOM. Thanh tab cao55px, chữ11px là ngoại lệ nhãn điều hướng.
- Sheet số điện thoại320px hiển thị vừa màn, công tắc/nút không tràn. Tài khoản768px không overflow.
- Đã nhìn ảnh chấm công390px và sheet320px. Camera/PDF/QR dùng style dialog chung nhưng không kiểm tra lại đầy đủ từng popup ở mọi kích thước; native media controls do trình duyệt quản lý.
- 18 test đạt; build cuối đạt; diff check đạt. Chưa kiểm chứng Zalo trên điện thoại, bàn phím ảo, fontscale hệ điều hành, screen reader hoặc mọi trạng thái dữ liệu dài. Không coi là chứng nhận accessibility đầy đủ.

File cập nhật: attendance-miniapp/src/styles.css. File mới: báo cáo này. Ảnh local trong attendance-miniapp/tmp/review/ui-audit-checkin-390.png.

Tham chiếu rà soát: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
