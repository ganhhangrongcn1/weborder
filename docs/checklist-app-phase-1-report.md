# Báo cáo Phase 1 — Nền tảng ứng dụng Checklist

Ngày hoàn thành mã nguồn: 2026-07-29

## Kết quả

- Tạo ứng dụng React/Vite độc lập tại `apps/checklist`.
- App dùng cấu hình Supabase hiện tại nhưng có session key riêng.
- Tài khoản được phép đăng nhập Phase 1 phải có `profiles.role = 'admin'` và `profiles.status = 'active'`.
- Danh sách chi nhánh đọc trực tiếp từ `public.branches` bằng `branch_uuid`.
- Tạo migration bằng Supabase CLI cho 14 bảng `checklist_*`.
- Tạo RLS, index, helper quyền, bucket ảnh private và seed 37 tiêu chí takeaway.
- Tạo audit SQL chỉ đọc để kiểm tra sau khi áp dụng migration.
- Tạo service tính điểm độc lập và kiểm thử tự động.
- Giao diện đăng nhập đã kiểm tra ở desktop và màn hình điện thoại 390 px.

## Kiểm tra đã chạy

- `npm test` trong app checklist: 3/3 bài test đạt.
- `npm run check:phase1`: xác nhận 14 bảng và 37 mã tiêu chí.
- `npm run build` trong app checklist: thành công.
- `npm run build` của web hiện tại: thành công.
- `npm audit --omit=dev`: không có lỗ hổng dependency production.
- Kiểm tra trình duyệt: không có lỗi console, không tràn ngang ở màn hình 390 px.
- UTF-8: nội dung tiếng Việt hợp lệ.

## Trạng thái Supabase

Migration `20260729024021_checklist_phase_1` đã được áp dụng lên database remote bằng truy vấn trực tiếp trong một transaction, sau đó được ghi nhận đúng riêng phiên bản này trong migration history.

Kết quả audit remote:

- 14 bảng `checklist_*`, cả 14 bảng đều bật RLS;
- 40 policy dữ liệu và Storage;
- 7 nhóm, 37 tiêu chí, tổng trọng số 100;
- bucket `checklist-evidence` ở chế độ private;
- helper quyền không cấp execute cho `public`, có cấp cho `authenticated`;
- 4 chi nhánh đều có `branch_uuid`;
- migration local và remote cùng ghi nhận phiên bản `20260729024021`.

Audit schema thật cũng xác nhận `branches` không có cột `open`; repository của app checklist đã được sửa để chỉ đọc các cột đang tồn tại.

## Ranh giới ảnh hưởng

- Không sửa `src/App.jsx`, `src/main.jsx`, route hoặc package của web hiện tại.
- Không thay đổi bảng đơn hàng, khách hàng, POS, bếp, loyalty hoặc kho.
- App checklist có package-lock, dependency, build output và cấu hình riêng.
- Supabase production mới có schema và seed checklist mặc định; chưa có phiếu kiểm tra hoặc hồ sơ nhân viên nghiệp vụ.

## Đề xuất bước kế tiếp

Sau khi migration được review và áp dụng an toàn, triển khai Phase 2:

- quản lý nhân viên;
- gán nhân viên theo chi nhánh;
- quản lý nhóm/tiêu chí/trọng số;
- tạo và công bố phiên bản checklist mới.
