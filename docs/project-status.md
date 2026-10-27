# Trạng thái app chấm công Zalo Mini App

## Mốc mới nhất — 27/10/2026: Testing 8, tích điểm và điểm danh

- Local đã hoàn thiện màn đăng nhập với dòng Tích điểm thành viên nhỏ, canh giữa dưới thương hiệu; sau đăng nhập có hai mục riêng Tích điểm và Điểm danh. Có Trang chủ/Back quay về màn chọn. [Chi tiết UI](checklist/reports/attendance-module-entry-2026-10-27.md).
- Chủ app xác nhận QR đăng nhập CLI. Upload **Testing Version 8** thành công, ghi chú membership-and-attendance-demo; portal xác nhận Testing lúc09:13:54 27/10/2026. Không gửi xét duyệt phiên bản hoặc Publish/Live. [Ảnh xác nhận](checklist/reports/assets/attendance-testing8-2026-10-27/testing8-confirmed.jpg), [QR Testing8](checklist/reports/assets/attendance-testing8-2026-10-27/testing8-qr.jpg).
- [Giải trình số điện thoại mới](checklist/reports/attendance-phone-explanation-2026-10-27.md): chia sẻ tự nguyện sau đăng nhập để đối chiếu hồ sơ; từ chối vẫn tích điểm/điểm danh; không dùng số để tự cộng điểm hoặc cấp quyền nhân viên. Đã thống nhất nội dung trong Tài khoản, bảng chia sẻ và Quyền riêng tư.
- Trên Zalo, Version7 hiện Rejected. Quyền số điện thoại và các quyền đã xin vẫn Đợi xét duyệt; chưa được cấp. Trang Quản lý quyền không hiện thao tác sửa yêu cầu đang chờ, nên **chưa nộp lại/thay thế giải trình cũ trên portal**; chỉ lưu nội dung mới và minh bạch trạng thái, không hủy hay nộp trùng yêu cầu.
- Vẫn DEMO_ONLY; hóa đơn/quà/điểm theo phiên và số điện thoại mẫu, chưa gọi API Zalo native hay ghi điểm mua hàng thật. Build584041byte,8test về liên kết, native guard, ledger và điều hướng đạt. Chưa kiểm chứng bản8 trên điện thoại Zalo.
- Đồng bộ source/docs/assets, không gửi secret/QR đăng nhập/tài khoản, không đổi DB, không deploy webhook lại, không tự gửi lại phiên bản/Publish Live hoặc lập lịch theo dõi. Các mốc cũ bên dưới là lịch sử.

## Mốc mới nhất — 27/10/2026: thêm tích điểm mua hàng cho nhân viên (demo)

Chủ app yêu cầu thêm tính năng tích điểm thành viên vào app hiện tại, chọn tích theo mua hàng tại quán. Đã thêm tab điểm/lịch sử/đổi quà và nhãn “Tích điểm thành viên” ở màn đăng nhập, kèm ngữ cảnh nhân viên và lý do đăng nhập ngắn gọn. Đây là bản demo bộ nhớ theo phiên, hóa đơn/quà mẫu, không tích điểm vào DB hoặc hệ thống khách hàng thật. Quy đổi mẫu 1.000đ = 1 điểm, chờ chốt chính sách khi vận hành.

Ngày 26/10, chủ app gửi ảnh thông báo Zalo từ chối do màn đăng nhập thiếu ngữ cảnh đối tượng/lý do đăng nhập. Không suy ra kết quả riêng của 11 quyền. Các mốc đã gửi/đang chờ duyệt bên dưới là lịch sử, không còn là xác nhận trạng thái mới nhất. Thay đổi này chưa upload/gửi duyệt lại và chưa kiểm tra thiết bị.

[Chi tiết tính năng, kiểm tra và toàn bộ 12 file thay đổi](checklist/reports/attendance-membership-points-2026-10-27.md). 25/25 test đạt; build/lint riêng/UTF-8 đạt. Không nối DB/API mới hoặc deploy.

## Mốc mới nhất — 25/10/2026: Version 7 đã gửi xét duyệt; chờ kết quả

Đồng bộ riêng delta 11 file `d28901b8c08e4eec68fbb99f2292d8b134cc5fa4`, parent `0a8686b`, trên nền Cloud `d3ef29483cea1a1b07538ac69af64ee7448ae039`. Giữ lịch sử Cloud, không merge nhánh/parent snapshot. Các blocker email/webhook/Điều khoản và trạng thái chưa gửi phát hành của mốc trước bên dưới đã được thay thế bởi cập nhật này.

- Theo bàn giao local, email và Điều khoản đã hoàn tất; bước 3/4 hoàn tất, **GỬI XÉT DUYỆT PHÁT HÀNH VERSION 7 THÀNH CÔNG**. Zalo hiển thị phiên bản 7 đang được xét duyệt, thời gian submit trên UI `08:40:03 25/10/2026`. Giữ nguyên giờ theo UI nguồn, không suy đoán múi giờ. **Chưa được duyệt, chưa Publish/Live.**
- 11 quyền đã nộp riêng; lần đọc gần nhất Đợi xét duyệt, không suy ra đã được cấp. Mô tả phát hành cuối bằng văn tự nhiên, nêu chức năng và trạng thái demo.
- API key lấy bằng lưu URL webhook thực trên parent Zalo, IP Access để trống, không thuê VPS. Theo bàn giao, key chỉ trong Supabase Secrets server; không trong Git/chat/frontend, file tạm đã xóa. Cloud không đọc/gửi credentials.
- Theo bàn giao local, Edge Function attendance-zalo-consent v1 và inbox RLS đã triển khai ở project qjaklysckgzdfjthzkzu. Kiểm thử endpoint với ID tổng hợp: đúng chữ ký 200, sai 401, sai app 403, retry chỉ 1 bản ghi; bản ghi thử đã dọn. Cloud không gọi lại endpoint/migration/deploy/secrets.
- **Webhook CHỈ ghi nhận pending_identity_review**: chưa mapping Zalo–Auth, chưa tự xóa dữ liệu, chưa worker/thông báo xử lý inbox; chưa nhận sự kiện thật từ Zalo. Chưa đủ xử lý vòng đời dữ liệu nhân sự thật.
- Frontend vẫn DEMO_ONLY; GPS/QR/SĐT/đăng ký mô phỏng. Không bật API Zalo thật trên frontend hoặc tạo tài khoản.
- [Báo cáo gửi duyệt](checklist/reports/attendance-review-attempt-2026-10-25.md), [ảnh đã gửi](checklist/reports/assets/attendance-review-2026-10-25/version7-submitted.jpg), [webhook và giới hạn](checklist/reports/attendance-webhook-2026-10-25.md), [Điều khoản nguồn](checklist/attendance-miniapp-terms-2026-10-25.md).
- Chỉ đồng bộ và xác minh bàn giao, sau đó **TẠM DỪNG chờ yêu cầu tiếp**. Không phát triển, thay đổi DB, triển khai, gửi lại quyền/version, Publish, tạo lịch theo dõi hay push main.

### Kiểm tra bàn giao Cloud d28901b

- Ref/SHA và parent đúng; checkout đầu vào sạch. 10 file nhận nguyên blob khớp nguồn; docs/project-status.md giữ lịch sử và bổ sung mốc mới.
- Node test riêng webhook dùng synthetic key/in-memory persist: 4/4 đạt; không đọc credentials, gọi endpoint thật hoặc DB.
- UTF-8 các file văn bản đạt; 2 JPEG verify/load đạt; 19 liên kết Markdown tương đối tồn tại; SQL docs/migration giống từng byte; git diff --check đạt.
- Không chạy lại migration/deploy/secrets, không tạo tài khoản/dữ liệu hoặc thay đổi DB/API. Không gửi lại quyền/version, Publish/Live, lập lịch, push main. Không build frontend vì scope webhook/tài liệu và bàn giao.
- Tình trạng triển khai/submit bên trên theo báo cáo local và ảnh nguồn, không xác minh lại Zalo/endpoint từ Cloud. Hoàn tất đồng bộ rồi tạm dừng chờ yêu cầu tiếp; không coi nhận inbox là đã xóa dữ liệu.

### 11 file đồng bộ mốc đã gửi Version 7

- `attendance-miniapp/tests/zalo-consent.test.mjs`
- `docs/checklist/attendance-miniapp-terms-2026-10-25.md`
- `docs/checklist/reports/assets/attendance-review-2026-10-25/version7-submitted.jpg`
- `docs/checklist/reports/assets/attendance-review-2026-10-25/webhook-configured.jpg`
- `docs/checklist/reports/attendance-review-attempt-2026-10-25.md`
- `docs/checklist/reports/attendance-webhook-2026-10-25.md`
- `docs/project-status.md`
- `docs/supabase-sql/20261025_attendance_zalo_consent_requests.sql`
- `supabase/functions/attendance-zalo-consent/handler.mjs`
- `supabase/functions/attendance-zalo-consent/index.ts`
- `supabase/migrations/20261025070000_attendance_zalo_consent_requests.sql`

## Mốc mới nhất — 25/10/2026: Testing 7, 11 quyền đợi duyệt; TẠM DỪNG

Nhận riêng delta 4 file từ `0a8686b5f65b5287f45783cca998bc106c8293c0` (parent `52f482f`) trên Cloud `e780cfd89bacb94101ec404bc071c94acd7c69da`. Giữ nội dung Cloud, không merge nhánh/parent snapshot. Các mốc 24/10 và phát biểu chưa nộp quyền bên dưới là lịch sử đã được cập nhật bởi mốc này.

- Theo bàn giao local, Testing 7 đã upload, CLI Deploy Done. app-config.json có headerTitle rỗng, title Gánh Hàng Rong; chưa kiểm tra header trên điện thoại.
- Đã nộp đủ 11 yêu cầu quyền kèm lý do/ảnh, mô tả đúng demo chưa gọi API Zalo thật. UI đủ 11 dòng Đợi xét duyệt; **chưa được cấp quyền**.
- **Bản 7 CHƯA hoàn tất gửi xét duyệt PHÁT HÀNH**, chưa vào hàng đợi duyệt phát hành: thiếu email xác thực, Webhook rút đồng ý/xóa dữ liệu và Điều khoản sử dụng. Không Publish/Live.
- Theo yêu cầu chủ app: **TẠM DỪNG chờ kết quả quyền**, chỉ làm tiếp khi anh yêu cầu. Không tự phát triển, nối API/DB, deploy webhook, tạo tài khoản, gửi thêm quyền/duyệt/Live hoặc lập lịch theo dõi. Không push main.
- [Báo cáo và điểm tiếp tục](checklist/reports/attendance-review-attempt-2026-10-25.md), [ảnh 11 quyền đợi duyệt](checklist/reports/assets/attendance-review-2026-10-25/permissions-11-pending.jpg).

### Kiểm tra Cloud cho mốc tạm dừng

- SHA/parent xác minh đúng; checkout đầu vào sạch. Ba file nhận nguyên bản giống từng byte source; chỉ bổ sung docs/project-status.md, giữ nguyên lịch sử Cloud.
- JSON hợp lệ; headerTitle rỗng/title Gánh Hàng Rong đúng bàn giao. UTF-8 file văn bản đạt; JPEG verify/load đạt; 13 liên kết Markdown tương đối tồn tại; git diff --check đạt.
- Chỉ đồng bộ config/tài liệu/ảnh, không build/test code lại, không kiểm tra trạng thái Zalo trực tiếp hoặc header điện thoại. Không thực hiện hành động bên ngoài, không thay đổi DB/API/tài khoản, không deploy, gửi thêm quyền/duyệt/Live hoặc lập lịch. Hoàn tất bàn giao và tạm dừng.

### 4 file đồng bộ tiến độ 25/10

- `attendance-miniapp/app-config.json`
- `docs/checklist/reports/assets/attendance-review-2026-10-25/permissions-11-pending.jpg`
- `docs/checklist/reports/attendance-review-attempt-2026-10-25.md`
- `docs/project-status.md`

## Bổ sung hồ sơ Testing 6 — 24/10/2026, vẫn WIP/demo

Đồng bộ riêng delta `52f482fc2f35ac6c573a1243bda514e74a3c01a3` (parent `4d2e008`) trên Cloud `73dc3b067d64249929f30df2ac4c6d19eca9bf57`: chỉ 17 đường dẫn docs/assets, không merge toàn nhánh hoặc snapshot parent. Giữ nguyên lịch sử Cloud; bộ 23/10 là tư liệu lịch sử, bảng/ảnh hiện tại dùng bộ dưới đây.

- [Bảng 11 quyền và 14 ảnh Testing 6](checklist/reports/attendance-permission-explanations-testing6-2026-10-24.md): quyền SĐT theo luồng chia sẻ sau login, công tắc/Cho phép/Từ chối; thêm 3 ảnh kết quả từ chối/khớp/không khớp.
- Ảnh chụp LOCAL cùng source Testing 6, không chụp bên trong Zalo điện thoại và không chứng minh native. Camera chưa có preview, rung chỉ là ảnh ngữ cảnh, gallery/download/native PDF còn thiếu bằng chứng.
- Không tạo ca công hoặc gửi chỉnh công mới. Không sửa app, DB/API/tài khoản, không deploy, upload Testing, gửi quyền/xét duyệt/Live hoặc push main. Không cần chạy lại build/test code cho đợt chỉ docs/assets.

### Kiểm tra Cloud bộ hồ sơ 52f482f

- Fetch xác minh đúng SHA và parent; checkout đầu vào sạch. 16 file sao chép giống source từng byte, chỉ bổ sung tiến độ trong docs/project-status.md.
- Đủ 14 file mang đuôi .png, Pillow verify/load đạt 14/14. **Sai khác định dạng nguồn: cả 14 file thực chất là JPEG/JFIF, không phải PNG.** Giữ nguyên blob theo yêu cầu đồng bộ, chưa đổi tên/chuyển định dạng. Cần thống nhất MIME/đuôi trước khi dùng hồ sơ thật.
- Kích thước ảnh thực tế rộng 375 hoặc 390 pixel, cao 812–1656 pixel; không phải toàn bộ cùng viewport 390×844 như mô tả chung của báo cáo nguồn.
- Ba file Markdown thuộc scope giải mã UTF-8 đạt; 71 tham chiếu Markdown tương đối (gồm ảnh) tồn tại. git diff --check đạt.
- Không xem đây là xác nhận bằng chứng native: ảnh local; camera chưa preview, rung chỉ ngữ cảnh, gallery/download/native PDF còn thiếu bằng chứng.
- Chỉ tài liệu/assets: không sửa app, không chạy lại test/build code, không tạo ca/yêu cầu điều chỉnh, không đổi DB/API/tài khoản, deploy/update Testing, gửi quyền/xét duyệt/Live hay push main. Vẫn WIP/demo.

### 17 file đồng bộ hồ sơ

- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/01-qr.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/02-vi-tri.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/03-mang.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/04-giu-sang.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/05-rung-ngu-canh.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/06-camera.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/07-chon-tep.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/08-chia-se-sdt.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/08b-tu-choi.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/08c-khop-ho-so.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/08d-khong-khop.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/09-luu-video.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/10-tai-tep.png`
- `docs/checklist/reports/assets/attendance-permissions-testing6-2026-10-24/11-mo-tai-lieu.png`
- `docs/checklist/reports/attendance-permission-explanations-2026-10-23.md`
- `docs/checklist/reports/attendance-permission-explanations-testing6-2026-10-24.md`
- `docs/project-status.md`

## Mốc mới nhất Cloud 24/10/2026 — Testing 6, vẫn WIP

Nhận đúng delta 23 file của `4d2e008f3f025fb9af863dd8c8540d229b8b8936`, parent `6c3088f`, trên nền Cloud `b0b8750b801f59ddaabe277e8ae95ecd5755c522`. Không merge toàn nhánh/snapshot parent; giữ nội dung Cloud. Các mốc cũ bên dưới chỉ là lịch sử.

- Theo bàn giao local và báo cáo CLI, app đã trên Zalo Testing 6 (Deploy Done); Cloud không upload/update Testing thêm. UI chữ/nút đã đồng bộ, logo GHR.
- Đăng ký có icon và bắt buộc SĐT, chỉ mô phỏng trong bộ nhớ: chưa tạo Auth/DB hoặc tài khoản dùng đăng nhập. Đăng nhập tài khoản test đã cấp trước vẫn qua Supabase Auth.
- Chia sẻ SĐT sau login là bottom sheet mô phỏng, công tắc mặc định tắt, Cho phép/Từ chối; khớp/không khớp thuộc phần thử riêng. Không bắt buộc chấm công, không ghi đè liên kết cũ.
- Có link trang/branch và Back nội bộ. Contact config mỗi branch để trống, anh sẽ thiết lập sau. Maps/link ngoài HTTPS, gọi tel, mở liên hệ Zalo để người dùng chọn gọi; chưa native call/back/deeplink.
- `DEMO_ONLY = true`; chưa nối API Zalo thật, chưa có bằng chứng native/permission/device. Không nhân sự/tính lương production; vẫn đang làm dang dở.
- Bộ 11 quyền/12 ảnh cũ giữ làm lịch sử, chưa phải bằng chứng cho luồng mới. Không chuyển secrets/.env/tmp/dist/node_modules; chỉ có .env.example.
- Cloud chỉ nhận source/docs, không nối DB/API, không tạo tài khoản, không deploy, xin quyền/xét duyệt/Live hoặc push main.
- [Testing 6](checklist/reports/attendance-testing-v6-2026-10-24.md), [UI thống nhất](checklist/reports/attendance-ui-consistency-2026-10-24.md), [chia sẻ SĐT](checklist/reports/attendance-phone-link-demo-2026-10-24.md), [điều hướng](checklist/reports/attendance-navigation-2026-10-24.md).

### Kiểm tra Cloud cho delta 4d2e008

- Ref và parent đã xác minh; checkout đầu vào sạch. 22 file nhận nguyên bản khớp từng byte, chỉ docs/project-status.md bổ sung trên nền nội dung Cloud.
- `npm test --prefix attendance-miniapp`: đạt 5 file test; `node --test --test-isolation=none --test-reporter=tap attendance-miniapp/tests/*.test.mjs`: 18/18 đạt, không gọi DB/API thật.
- `npm run build --prefix attendance-miniapp`: đạt Vite 5.4.21; bundle hợp lệ 573155 byte. Cloud không có .env, nên không chứng minh luồng Auth/endpoint hoạt động; khác bundle Testing 6 local có cấu hình môi trường.
- ESLint source/server/tests/vite.config.js app: đạt. Encoding checker source web chính: 664 file đạt; UTF-8 toàn bộ 23 file đồng bộ hợp lệ. `git diff --check`: đạt.
- DEMO_ONLY vẫn true; chỉ .env.example tồn tại trong app. Không chuyển secrets/tmp/dist; không sửa lock/dependency hoặc cài thêm công cụ.
- Chưa kiểm tra UI browser/simulator/thiết bị trên Cloud, native Back/deeplink/quyền chưa xác nhận. Không phát triển thêm, không nối DB/API/tạo tài khoản, không deploy/update Testing/xin quyền/xét duyệt/Live/push main.

### 23 file đồng bộ đợt Testing 6

- `attendance-miniapp/src/App.jsx`
- `attendance-miniapp/src/components/Account.jsx`
- `attendance-miniapp/src/components/BranchDetails.jsx`
- `attendance-miniapp/src/components/BranchLinks.jsx`
- `attendance-miniapp/src/components/Brand.jsx`
- `attendance-miniapp/src/components/ContactActions.jsx`
- `attendance-miniapp/src/components/Login.jsx`
- `attendance-miniapp/src/components/PhoneLinkDialog.jsx`
- `attendance-miniapp/src/components/Register.jsx`
- `attendance-miniapp/src/constants/contactConfig.js`
- `attendance-miniapp/src/hooks/useAppNavigation.js`
- `attendance-miniapp/src/hooks/useAttendance.js`
- `attendance-miniapp/src/services/demoPhoneService.js`
- `attendance-miniapp/src/services/navigationService.js`
- `attendance-miniapp/src/styles.css`
- `attendance-miniapp/tests/demo-flows.test.mjs`
- `attendance-miniapp/tests/navigation.test.mjs`
- `docs/checklist/reports/attendance-navigation-2026-10-24.md`
- `docs/checklist/reports/attendance-phone-link-demo-2026-10-24.md`
- `docs/checklist/reports/attendance-testing-v5-2026-10-24.md`
- `docs/checklist/reports/attendance-testing-v6-2026-10-24.md`
- `docs/checklist/reports/attendance-ui-consistency-2026-10-24.md`
- `docs/project-status.md`

## Lịch sử đồng bộ Cloud 24/10/2026 — mốc 6c3088f (đã được thay thế)

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