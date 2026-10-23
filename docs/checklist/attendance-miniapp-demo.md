# App chấm công Gánh Hàng Rong — demo local

Ngày kiểm tra: 23/10/2026. Mã nguồn nằm trong `attendance-miniapp/` tại repository này.

**Trạng thái: App chấm công Zalo Mini App đang làm dang dở.** Chưa nối database, chưa xác nhận chạy trong Zalo/simulator, chưa gửi xin quyền hoặc xuất bản. Đã dừng việc cài Studio/Extension theo yêu cầu ngày 23/10/2026. Đồng bộ mã nguồn sang Cloud để tiếp tục sau; không coi build local thành công là đã hoàn thiện ứng dụng.

**Cập nhật giao diện:** [Báo cáo thiết kế cho Zalo Mini App](reports/attendance-miniapp-ui-2026-10-23.md). Nhãn demo và bảng quyền đã được bỏ khỏi các màn nhân viên theo yêu cầu mới. Các mô tả giao diện phía dưới phản ánh bản trải nghiệm ban đầu; phần dữ liệu vẫn chưa chuyển sang Supabase.

**Cập nhật đóng gói:** [Chuyển sang project Zalo Mini App](reports/attendance-zalo-miniapp-conversion-2026-10-23.md). Đã thêm entry/config/bộ nhớ riêng cho runtime Zalo; không xem mô tả web ban đầu dưới đây là trạng thái hiện tại của phần đóng gói. Database vẫn để sau.

## Mở app

Bản đang chạy để xem: <http://127.0.0.1:5182/>. Dữ liệu gắn với origin: dùng cùng địa chỉ và cổng để giữ chung dữ liệu giữa các tài khoản.

Sau khi dừng máy chủ, mở `attendance-miniapp/start-demo.cmd` để chạy lại. Nếu máy chưa có dependency, chạy `npm ci` trong thư mục `attendance-miniapp` trước. File CMD giữ cửa sổ trong lúc sử dụng; Ctrl+C để dừng. Nếu cổng đã có app đang chạy, mở địa chỉ trên thay vì chạy thêm phiên khác.

| Vai trò | Tài khoản demo | Mật khẩu |
| --- | --- | --- |
| Nhân viên | `nhanvien.demo` | `GhrDemo2026!` |
| Quản lý | `quanly.demo` | `GhrDemo2026!` |

Các thông tin đăng nhập được cố ý công khai để trải nghiệm dữ liệu mẫu. Đây không phải tài khoản Supabase, không được cấp quyền truy cập hồ sơ nhân sự thật. Không sử dụng cơ chế đăng nhập demo để bảo vệ dữ liệu production.

## Chức năng đã viết

- Vào/ra ca GPS mẫu hoặc GPS + QR mẫu. Có vị trí thực của trình duyệt khi người dùng chủ động cho phép. Điểm cửa hàng đang là tọa độ demo, không lấy nhầm địa chỉ mẫu làm địa chỉ cửa hàng thật.
- Kiểm tra vị trí mới trong 2 phút, sai số tối đa 100 m, toàn bộ vùng sai số phải nằm trong bán kính 150 m. QR mẫu phải đúng nội dung và mới được đọc trong 2 phút.
- Chặn vào ca hai lần, ra ca khi chưa vào, mất kết nối và ca điều chỉnh chồng lấn. Giao dịch IndexedDB xử lý thao tác ghi dựa trên dữ liệu mới nhất, không chỉ dựa trên state giao diện.
- Lịch sử, lọc tháng, tổng giờ ca đã hoàn thành, xuất CSV UTF-8 có BOM và escape nội dung có thể bị hiểu là công thức.
- Yêu cầu điều chỉnh ca của bản thân, lý do và minh chứng; quản lý demo duyệt/từ chối kèm ý kiến. Khi duyệt lưu giờ gốc và người xử lý; không cho tự duyệt hoặc duyệt lại yêu cầu đã xử lý.
- Camera trình duyệt thật, chụp ảnh bằng thao tác chủ động, dừng camera khi đóng màn hình. Không tự cho phép camera trong quá trình kiểm thử này.
- Đính kèm JPG/PNG/WebP, PDF hoặc MP4 tối đa 5 MB; lưu cục bộ cho bản demo. Trong Zalo dùng media picker và LFS saveFile, cần thử thực trên phiên bản Zalo hỗ trợ LFS.
- Video hướng dẫn MP4 30 giây tự tạo, lưu video, giữ màn hình sáng trong lúc xem; giải phóng khi dừng, rời màn hình hoặc chuyển nền.
- PDF hướng dẫn tiếng Việt, chức năng mở tài liệu; thông báo phạm vi dữ liệu demo.
- Liên kết số điện thoại mẫu; adapter Zalo lấy token và cầu nối Node xử lý đổi token phía máy chủ. Không lưu số điện thoại đầy đủ hoặc token vào kho demo.
- Kiểm tra mạng, phản hồi rung; báo rõ nếu thiết bị không hỗ trợ thay vì giả báo thành công.

## Đối chiếu quyền

Đếm lại từ danh sách thực tế: **11 quyền chưa cấp**: 25, 38, 48, 58, 83, 87, 94, 100, 105, 106, 157. Con số 12 trong trao đổi trước là đếm nhầm. Màn Tài khoản có bảng giải trình đầy đủ theo từng quyền và đường dẫn dùng thử.

| ID | Chức năng | API Zalo đã nối trong mã nguồn | Trạng thái kiểm tra |
| --- | --- | --- | --- |
| 25 | QR chấm công | `scanQRCode` | Đã thử luồng mẫu local; native chưa thử thiết bị |
| 38 | GPS chấm công | `getLocation`, `getAccessToken`, Node bridge đổi token | Đã thử dữ liệu mẫu và kiểm tra biên; chưa có secret hoặc thiết bị thật |
| 48 | Kiểm tra mạng | `getNetworkType` | Trình duyệt hoạt động; native chưa thử |
| 58 | Giữ màn hình khi xem video | `keepScreen` | Có cleanup; cần thiết bị hỗ trợ để xác minh |
| 83 | Rung phản hồi | `vibrate` | Có xử lý lỗi không hỗ trợ; rung vật lý chưa xác minh |
| 87 | Camera | `requestCameraPermission` | Camera trình duyệt và native đã viết; chưa chụp ảnh người thật khi kiểm thử |
| 94 | Minh chứng ảnh/file/video | `openMediaPicker`, `saveFile` | Đã viết kiểm tra loại/kích thước; LFS cần thử trên Zalo |
| 100 | Liên kết số điện thoại | `getPhoneNumber`, `getAccessToken`, Node bridge | Dùng mẫu trên local; chưa cấu hình secret và chưa gọi dữ liệu thật |
| 105 | Lưu video đào tạo | `saveVideoToGallery` | Có MP4 thật, chưa xác minh lưu vào thư viện Zalo trên máy |
| 106 | Xuất bảng công | `downloadFile` | CSV có kiểm thử dữ liệu; native chưa thử |
| 157 | Mở hướng dẫn PDF | `openDocument` | PDF đã render và kiểm tra tiếng Việt; native chưa thử |

## Dữ liệu và kiến trúc

UI (`components`) → hook (`useAttendance`) → service nghiệp vụ/thiết bị → repository demo (IndexedDB). Phiên demo lưu bằng sessionStorage riêng. Không đọc/ghi Supabase, không sửa schema, RLS, nhân viên, đơn hàng hoặc dữ liệu POS. Không đổi route của web chính.

Kho demo: IndexedDB `ghr-attendance-demo-v1`, store `state`. Mỗi trình duyệt/origin có một kho; nhân viên và quản lý demo dùng chung kho trên cùng origin. Không đồng bộ dữ liệu giữa điện thoại hay máy tính khác nhau. Tệp native LFS tồn tại trên chính thiết bị đã chọn, không phải URL chia sẻ cho quản lý trên máy khác. Cần kho private và kiểm tra quyền phía server khi chuyển sang sản phẩm thật.

## Bridge token phía máy chủ

`attendance-miniapp/server/zaloBridge.mjs` chạy riêng bằng `npm run bridge`, chỉ lắng nghe `127.0.0.1:5181`. Đặt biến môi trường `ZALO_APP_SECRET` riêng cho tiến trình Node bằng luồng quản trị an toàn. Không đưa secret vào chat, file source, biến `VITE_*` hoặc bundle. Bridge không tự tải `.env`.

Vite dev proxy `/api/zalo` sang bridge. Nếu thiếu secret, token không hợp lệ hoặc Zalo trả lỗi, API báo lỗi thay vì lấy dữ liệu giả. Token và access token chỉ chuyển qua request body/headers tới backend và Zalo, không ghi log hay lưu IndexedDB. Chưa cấu hình secret và chưa thực hiện cuộc gọi đổi token thật trong đợt này.

Bridge hiện chỉ là công cụ local. Để thử token trên thiết bị Zalo, cần backend HTTPS do doanh nghiệp kiểm soát, xác thực và phân quyền độc lập, rate limit, cấu hình API domain và `VITE_ATTENDANCE_API_URL`. **Không đưa nguyên bridge local lên internet.** Chưa tạo endpoint public hoặc triển khai backend trong đợt này.

SDK đối chiếu theo tài liệu chính thức:

- [Lấy vị trí và đổi token phía server](https://docs.zaloplatforms.com/docs/MA/api/location/getLocation)
- [Chọn media và LFS](https://docs.zaloplatforms.com/docs/MA/api/media/file/openMediaPicker)
- [Giữ màn hình](https://docs.zaloplatforms.com/docs/MA/api/device/screen/keepScreen)
- [Lưu video](https://docs.zaloplatforms.com/docs/MA/api/media/file/saveVideoToGallery)
- [Mở PDF](https://docs.zaloplatforms.com/docs/MA/api/media/file/openDocument)
- [Tải file](https://docs.zaloplatforms.com/docs/MA/api/media/file/downloadFile)

## Kiểm tra đã chạy

- `npm test` trong app: 9/9 đạt, gồm vào/ra ca, GPS, QR, mất mạng, quyền duyệt, chồng lấn, xuất CSV và bridge mock. Kiểm thử bridge dùng dữ liệu giả, không phải bằng chứng đổi token thật.
- `npm run build` trong app: đạt, Vite 6.4.5; PDF/MP4 đã được đóng gói.
- `npm run build` ở web chính: đạt; cảnh báo chunk lớn có sẵn, không sửa ngoài phạm vi.
- ESLint phạm vi app: đạt; UTF-8 app và web chính: đạt.
- Lượt `npm run lint` toàn repository chạy kéo dài và được dừng; không coi toàn repository đã đạt lint. Lint riêng toàn bộ source/server/test/config của app đã chạy đạt, không có lỗi hoặc cảnh báo.
- `npm audit --omit=dev` riêng app: không có cảnh báo ở dependency runtime.
- Trình duyệt local: đăng nhập nhân viên → chặn vào ca thiếu GPS → GPS+QR mẫu → vào/ra ca → thấy lịch sử; tạo yêu cầu → đăng nhập quản lý → duyệt → tải lại vẫn còn yêu cầu đã duyệt.
- Đã kiểm tra thêm chỉnh giờ ra từ 16:00 thành 16:15 trên giao diện: sau duyệt, ca tương ứng hiển thị 8,25 giờ. CSV tải thực về trình duyệt có giá trị `8.25` đúng theo bản ghi và dấu tiếng Việt. Đã kiểm tra bố cục 390×844, nội dung không tràn ngang trang.
- PDF đã render thành PNG và kiểm tra bố cục, dấu tiếng Việt. Video được tạo từ 5 slide hướng dẫn tự soạn, MP4 H.264 960×540, 30 giây.

Không tự xác nhận các API native đã hoạt động trên thiết bị. Chưa thử tọa độ cửa hàng thật, số điện thoại thật, camera người thật, rung vật lý, thư viện video hay tài khoản Zalo thông thường. Đây là bản demo local có adapter SDK, **chưa phải gói Mini App đã nghiệm thu sẵn để gửi xét duyệt**. Không có thao tác xin quyền, gửi xét duyệt hoặc xuất bản Zalo; không commit/push/deploy.

## File mới và cập nhật

Tất cả file app mới nằm trong `attendance-miniapp/`:

- `.gitignore`, `.env.example`, `package.json`, `package-lock.json`, `index.html`, `vite.config.js`, `start-demo.cmd`.
- `src/main.jsx`, `src/App.jsx`, `src/styles.css`.
- `src/data/demo.js`.
- `src/hooks/useAttendance.js`.
- `src/services/attendanceService.js`, `src/services/demoRepository.js`, `src/services/deviceService.js`.
- `src/components/Login.jsx`, `src/components/Checkin.jsx`, `src/components/History.jsx`, `src/components/Corrections.jsx`, `src/components/Training.jsx`, `src/components/Account.jsx`, `src/components/CameraCapture.jsx`.
- `src/assets/huong-dan-cham-cong.pdf`, `src/assets/huong-dan-cham-cong.mp4`.
- `server/zaloBridge.mjs`.
- `tests/attendance.test.mjs`.
- `scripts/create-training-assets.py`.

Tài liệu mới: `docs/checklist/attendance-miniapp-demo.md` (file này).

Cập nhật: `eslint.config.js` (bỏ qua output/công cụ demo, nhận diện global của app/server/test); `docs/checklist/README.md` (liên kết hướng dẫn).

`node_modules/`, `.tools/`, `tmp/`, `dist/` của app là dependency/output tạm, không đưa vào Git. Có ảnh minh chứng trong `attendance-miniapp/tmp/review/`.
