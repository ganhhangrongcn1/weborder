# Màn chọn Tích điểm và Điểm danh — 27/10/2026

Theo yêu cầu chủ app, chuyển tiêu đề Tích điểm thành viên ra ngoài khung nhập tài khoản, đặt dưới logo và canh giữa. Không thêm lại ghi chú dưới tiêu đề.

Sau khi đăng nhập, mở màn Chọn chức năng với hai ô Tích điểm và Điểm danh. Chọn Tích điểm mới vào điểm mua hàng/đổi quà; chọn Điểm danh mới vào phần giờ công. Mỗi mục có Trang chủ để quay về màn chọn. Thanh điều hướng của Tích điểm gồm Trang chủ, Tích điểm, Tài khoản; phần Điểm danh giữ lịch sử, điều chỉnh, đào tạo và tài khoản. Nút Back nội bộ vẫn được chặn tại gốc, không chủ động thoát Mini App.

Hook tích điểm vẫn được giữ ở workspace của phiên đăng nhập để chuyển mục không làm mất ledger mẫu. Không sửa dịch vụ chấm công/điểm hoặc ghi database. Bản demo vẫn dùng dữ liệu mẫu và chưa bật native API Zalo.

## Kiểm tra

- Build local đạt, bundle 583415 byte. Sáu kiểm thử liên quan điều hướng và ledger điểm đạt.
- ESLint không có lỗi; cấu hình lint hiện tại báo các import/component JSX là chưa dùng (11 cảnh báo), không sửa ngoài phạm vi.
- Browser local: Tích điểm mở đúng trang và Back về màn chọn; Điểm danh mở đúng trang riêng; Trang chủ quay về màn chọn. Không tạo ca hoặc giao dịch điểm.
- Tại390x844: tiêu đề nằm ngoài card, tâm ngang khớp viewport, không tràn ngang. Đã chụp màn đăng nhập và màn chọn; viewport kiểm tra được reset về mặc định.
- Chỉ chạy local và đồng bộ source nhánh preview, không upload Testing, gửi duyệt hoặc xuất bản Zalo. Không đổi nhánh POS hiện tại.

## File thay đổi

1. attendance-miniapp/src/App.jsx
2. attendance-miniapp/src/components/Login.jsx
3. attendance-miniapp/src/components/NavigationIcon.jsx
4. attendance-miniapp/src/components/ModuleHome.jsx (mới)
5. attendance-miniapp/src/hooks/useAppNavigation.js
6. attendance-miniapp/src/services/navigationService.js
7. attendance-miniapp/src/styles.css
8. attendance-miniapp/src/styles/module-entry.css (mới)
9. attendance-miniapp/tests/navigation.test.mjs
10. docs/checklist/reports/attendance-module-entry-2026-10-27.md (báo cáo mới)
