# Trạng thái app chấm công Zalo Mini App

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
