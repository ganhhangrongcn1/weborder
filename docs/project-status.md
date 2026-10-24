# Trạng thái app chấm công Zalo Mini App

## Cập nhật Cloud ngày 24/10/2026 — đang làm dang dở (WIP)

Nhận riêng thay đổi commit `6c3088fefa4c7b2a0588030c160f67bd7fe90d8e` (parent `592155f`) trên nền Cloud `abaebbcd`; không merge nhánh hoặc snapshot parent. Các mốc 23/10 bên dưới là lịch sử, không phải trạng thái hiện tại.

- UI mới theo mẫu người dùng, logo/màu GHR; Quyền riêng tư mở đọc được. Đăng nhập trước, liên kết SĐT sau trong Tài khoản; không ghi phone khi login.
- `DEMO_ONLY = true`: chưa gọi API Zalo thật. Dữ liệu thử/sample, không tích hợp nhân sự production.
- Theo bàn giao local, Supabase Auth/kho Testing và endpoint PDF/video đã có. Cloud chỉ nhận mã nguồn, SQL migration `attendance_preview_accounts` và Edge Function `attendance-training-assets`; không áp migration, triển khai function hoặc đổi DB.
- Theo báo cáo local, Zalo Testing 4 vẫn là UI cũ; UI mới chỉ local. Đợt Cloud này không upload Testing, xin quyền, gửi xét duyệt hay Live.
- Đã lưu bảng 11 quyền/12 ảnh minh họa. Ảnh phone trước login là lịch sử; native, rung/gallery/camera còn thiếu bằng chứng. Simulator/thiết bị thật chưa xác nhận.
- Không chuyển credentials/.env/tmp hoặc tài khoản tạm; chỉ có `.env.example`. Cloud chưa cấu hình môi trường Auth/DB và không tự tạo hay đổi tài khoản.
- [UI mới](checklist/reports/attendance-login-redesign-2026-10-23.md), [11 quyền và ảnh](checklist/reports/attendance-permission-explanations-2026-10-23.md), [Testing 4](checklist/reports/attendance-four-demo-flows-2026-10-23.md).

### Kết quả kiểm tra Cloud 24/10/2026

- Checkout ban đầu sạch tại `abaebbcd1ab8931e42466e41cb13a6a465c39046`; ref nguồn và parent đã xác minh. Giữ toàn bộ ghi chú/cấu hình Cloud; chỉ thêm global AbortController cho source app.
- 49 file sao chép giống từng byte commit nguồn; hai file status/lint được bổ sung có chủ đích. Đủ 12 ảnh quyền, UTF-8 các file văn bản thuộc scope hợp lệ. Không chuyển .env/credentials/tmp; app chỉ có .env.example.
- `npm ci --prefix attendance-miniapp --ignore-scripts --no-audit --no-fund`: đạt theo lock; có cảnh báo dependency deprecated, không audit/nâng cấp ngoài scope.
- `npm test --prefix attendance-miniapp`: đạt 4 file test. Kiểm tra chi tiết bằng `node --test --test-isolation=none --test-reporter=tap attendance-miniapp/tests/*.test.mjs`: 16/16 đạt, không gọi DB/Zalo thật.
- `npm run build --prefix attendance-miniapp`: đạt, Vite 5.4.21, bundle hợp lệ 555683 byte. Build không có cấu hình kết nối Supabase; không chứng minh đăng nhập/endpoint trên Cloud hoạt động.
- ESLint riêng source/server/tests/vite.config.js: đạt. Encoding checker web chính: đạt 664 file; git diff --check: đạt. Không chạy build/lint toàn repo.
- Không chạy script deploy-testing, không áp migration, không triển khai function, không tạo/đổi tài khoản, không upload/xin quyền/xét duyệt/Live hoặc push main. Không tiếp tục phát triển. Simulator/thiết bị và giao diện Cloud chưa kiểm tra.

### 51 đường dẫn của đợt đồng bộ mới

- `attendance-miniapp/.env.example`
- `attendance-miniapp/package-lock.json`
- `attendance-miniapp/package.json`
- `attendance-miniapp/scripts/deploy-testing.mjs`
- `attendance-miniapp/scripts/prepare-training-assets.py`
- `attendance-miniapp/src/assets/huong-dan-cham-cong-trang-1.png`
- `attendance-miniapp/src/components/Account.jsx`
- `attendance-miniapp/src/components/Checkin.jsx`
- `attendance-miniapp/src/components/DemoQrScanner.jsx`
- `attendance-miniapp/src/components/History.jsx`
- `attendance-miniapp/src/components/Login.jsx`
- `attendance-miniapp/src/components/NavigationIcon.jsx`
- `attendance-miniapp/src/components/PrivacyNotice.jsx`
- `attendance-miniapp/src/components/Training.jsx`
- `attendance-miniapp/src/constants/runtimeMode.js`
- `attendance-miniapp/src/hooks/useAttendance.js`
- `attendance-miniapp/src/hooks/useScreenAwake.js`
- `attendance-miniapp/src/hooks/useTrainingFiles.js`
- `attendance-miniapp/src/main.jsx`
- `attendance-miniapp/src/services/attendanceAuthService.js`
- `attendance-miniapp/src/services/attendanceRepository.js`
- `attendance-miniapp/src/services/demoPhoneService.js`
- `attendance-miniapp/src/services/deviceService.js`
- `attendance-miniapp/src/services/trainingMaterialService.js`
- `attendance-miniapp/src/styles.css`
- `attendance-miniapp/tests/auth.test.mjs`
- `attendance-miniapp/tests/demo-flows.test.mjs`
- `docs/checklist/attendance-miniapp-demo.md`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/01-qr.png`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/02-vi-tri.png`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/03-mang.png`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/04-giu-sang.png`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/05-rung.png`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/06-camera.png`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/07-chon-tep.png`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/08-dien-thoai-da-lien-ket.png`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/08-dien-thoai.png`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/09-luu-video.png`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/10-tai-tep.png`
- `docs/checklist/reports/assets/attendance-permissions-2026-10-23/11-mo-tai-lieu.png`
- `docs/checklist/reports/attendance-four-demo-flows-2026-10-23.md`
- `docs/checklist/reports/attendance-icons-readiness-2026-10-23.md`
- `docs/checklist/reports/attendance-login-redesign-2026-10-23.md`
- `docs/checklist/reports/attendance-permission-explanations-2026-10-23.md`
- `docs/checklist/reports/attendance-supabase-testing-2026-10-23.md`
- `docs/project-status.md`
- `docs/supabase-sql/20261023065857_attendance_preview_accounts.sql`
- `eslint.config.js`
- `supabase/functions/attendance-training-assets/assets.ts`
- `supabase/functions/attendance-training-assets/index.ts`
- `supabase/migrations/20261023065857_attendance_preview_accounts.sql`

Ngày 23/10/2026: **đang làm dang dở (WIP)**. Nhận riêng phần app từ commit `592155fcfb75e9eb8b67be70eabde6d1db4e308d` của `origin/codex/zalo-attendance-wip-20261023`; không nhận snapshot parent `ad6b36d`.

Mã nguồn: `attendance-miniapp/`, gồm 37 file. Hiện dùng sample data/tài khoản demo; chưa nối database. Chưa xác nhận chạy trong simulator hoặc Zalo trên thiết bị thật. Chưa xin quyền, gửi xét duyệt, upload/deploy hoặc xuất bản Zalo. Build thành công không đồng nghĩa runtime Zalo đã được xác nhận.

Xem [hướng dẫn](checklist/attendance-miniapp-demo.md) và [bàn giao](checklist/reports/attendance-zalo-miniapp-conversion-2026-10-23.md). Các báo cáo local giữ nguyên để tham khảo; kết quả kiểm tra Cloud ghi dưới đây.

## Phạm vi đồng bộ Cloud

Giữ cấu hình lint Cloud, chỉ bổ sung phạm vi app; tạo mục lục/trạng thái riêng vì Cloud chưa có hai file tương ứng. Không nhận thay đổi ngoài 43 đường dẫn của commit nguồn.

- `attendance-miniapp/.env.example`
- `attendance-miniapp/.gitignore`
- `attendance-miniapp/app-config.json`
- `attendance-miniapp/index.html`
- `attendance-miniapp/package-lock.json`
- `attendance-miniapp/package.json`
- `attendance-miniapp/scripts/build-miniapp.mjs`
- `attendance-miniapp/scripts/create-training-assets.py`
- `attendance-miniapp/server/zaloBridge.mjs`
- `attendance-miniapp/src/App.jsx`
- `attendance-miniapp/src/assets/ghr-logo.png`
- `attendance-miniapp/src/assets/huong-dan-cham-cong.mp4`
- `attendance-miniapp/src/assets/huong-dan-cham-cong.pdf`
- `attendance-miniapp/src/components/Account.jsx`
- `attendance-miniapp/src/components/Brand.jsx`
- `attendance-miniapp/src/components/CameraCapture.jsx`
- `attendance-miniapp/src/components/Checkin.jsx`
- `attendance-miniapp/src/components/Corrections.jsx`
- `attendance-miniapp/src/components/History.jsx`
- `attendance-miniapp/src/components/Login.jsx`
- `attendance-miniapp/src/components/NavigationIcon.jsx`
- `attendance-miniapp/src/components/Training.jsx`
- `attendance-miniapp/src/data/demo.js`
- `attendance-miniapp/src/hooks/useAttendance.js`
- `attendance-miniapp/src/main.jsx`
- `attendance-miniapp/src/services/attendancePresentation.js`
- `attendance-miniapp/src/services/attendanceService.js`
- `attendance-miniapp/src/services/demoRepository.js`
- `attendance-miniapp/src/services/deviceService.js`
- `attendance-miniapp/src/services/miniAppRuntime.js`
- `attendance-miniapp/src/styles.css`
- `attendance-miniapp/start-demo.cmd`
- `attendance-miniapp/start-miniapp.cmd`
- `attendance-miniapp/tests/attendance.test.mjs`
- `attendance-miniapp/tests/miniapp.test.mjs`
- `attendance-miniapp/vite.config.js`
- `attendance-miniapp/zmp-cli.json`
- `docs/checklist/README.md`
- `docs/checklist/attendance-miniapp-demo.md`
- `docs/checklist/reports/attendance-miniapp-ui-2026-10-23.md`
- `docs/checklist/reports/attendance-zalo-miniapp-conversion-2026-10-23.md`
- `docs/project-status.md`
- `eslint.config.js`

## Kiểm tra Cloud ngày 23/10/2026

- Ref nguồn đã fetch và xác minh SHA đầy đủ `592155fcfb75e9eb8b67be70eabde6d1db4e308d`.
- 37/37 file app (kể cả lock/config/assets) và 3/3 hướng dẫn/báo cáo giống từng byte với commit nguồn.
- `npm ci --prefix attendance-miniapp --ignore-scripts --no-audit --no-fund`: đạt theo lockfile; có cảnh báo dependency deprecated, chưa đánh giá audit bảo mật.
- `npm test --prefix attendance-miniapp`: đạt 2 file test. Chạy thêm `node --test --test-isolation=none --test-reporter=tap attendance-miniapp/tests/*.test.mjs`: 11/11 test đạt. Bridge dùng mock, không gọi dữ liệu Zalo thật.
- `npm run build --prefix attendance-miniapp`: đạt, Vite 5.4.21; bundle 653726 byte, file lớn nhất 243510 byte. Chỉ đóng gói, không upload.
- ESLint riêng source/server/tests/vite.config.js của app: đạt. `git diff --check`: đạt.
- `node scripts/check-encoding.mjs`: đạt 664 file source web chính; kiểm tra giải mã UTF-8 riêng các file văn bản thuộc 43 đường dẫn đồng bộ: đạt.
- Chưa kiểm tra giao diện trên Cloud, simulator hoặc thiết bị thật. Không thay đổi dữ liệu/DB, không xin quyền, không merge main, không deploy/publish; chưa chạy build/lint toàn repository.
