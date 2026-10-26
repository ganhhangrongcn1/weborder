# Sửa mở tab Mẫu in bill — 26/10/2026

- Nguyên nhân: đã đăng ký menu và component nhưng thiếu map menu → URL, URL → state và Route của React Router. Bấm menu dẫn về `/admin`, route state ghi đè thành dashboard.
- Tái hiện bằng bộ kiểm tra có sẵn `scripts/admin-settings-navigation.test.mjs`: thất bại vì nhận `dashboard-main` thay vì `store-receipt-template`.
- Sửa đủ ba điểm bằng URL `/admin/settings/receipt-template`, giữ `AppAdminRoutes` và lớp bảo vệ Admin hiện hữu. Thêm kiểm tra link trực tiếp, dấu `/` cuối và khai báo route bảo vệ.
- Chỉ sửa web: `src/app/routeState.js`, `src/app/routes.jsx`, `scripts/admin-settings-navigation.test.mjs`, báo cáo này. Không sửa quyền, cấu hình Supabase hoặc APK; POS 0.4.31/code 62 đã phát hành không cần build lại cho lỗi điều hướng này.
- APK đã tải lên Supabase tại `app-downloads/pos-printer/releases/62-0-4-31/GHR-POS-0.4.31.apk`; trang `/download` công bố bản 0.4.31/code62.
- Đã phát hành: PR #15 merge thành `20ea74e8a0375bee67813fb396515220e61f9eb6`. Vercel production `dpl_G7ZAQmFZxZPfvnjoM256CdYGoqWZ` READY và alias ganhhangrong.vn đúng commit này.
- Kiểm chứng: 3 ca điều hướng/phân quyền đạt; lint đạt; npm run build/encoding đạt. Đọc bundle từ domain chính xác nhận đủ 3 vị trí route/map và HTTP 200. Trình duyệt mở link mới vào đúng lớp đăng nhập Admin, không rơi về trang khách; phiên kiểm tra chưa đăng nhập Admin nên chưa bấm menu trong phiên tài khoản thật.
- Link sau sửa: https://ganhhangrong.vn/admin/settings/receipt-template . Người đang mở Admin từ trước triển khai cần tải lại trang để nhận JavaScript mới.
