# Bốn luồng demo quyền — chưa nối API Zalo thật

Ngày 23/10/2026. Theo chỉ đạo mới nhất: làm demo đủ bốn luồng, sửa PDF/video và upload Testing; không gọi API Zalo thật, không xin quyền/xét duyệt/phát hành Live. Không triển khai nhân sự hoặc tính lương production.

**Đã upload Testing Version 4** cho Mini App `2442731166050783503`; CLI báo Deploy Done. Gói 550.332 byte, không còn cảnh báo MP4/PDF bị bỏ qua. CLI qua script wrapper bị treo trước bước upload; đã dừng đúng child process của lượt này, khôi phục cấu hình rồi upload thành công bằng lệnh `npm exec -- zmp deploy --existing --testing --outputDir dist --desc demo-phone-pdf-video-screen` với manifest dist đưa tạm vào cấu hình root. Cấu hình source được khôi phục sau upload. Chưa gửi xin quyền, xét duyệt hoặc phát hành Live.

## Đã làm

1. **Điện thoại trước đăng nhập:** bước đồng ý liên kết số mẫu `0900 000 001`; từ chối hoặc chưa liên kết thì nút đăng nhập khóa. Service cũng kiểm tra đúng tài khoản thử, dấu mô phỏng và hạn 5 phút trước khi gọi Supabase Auth. Sau đăng nhập ghi liên kết mẫu vào kho Testing. Không lấy số điện thoại Zalo, không gọi Graph API, không phải xác minh sở hữu số thật.
2. **PDF:** tệp gốc tải qua endpoint Supabase có xác thực. Xem trong app bằng ảnh trang được kết xuất từ đúng PDF, có phóng trang 100/150/200% và liên kết tải PDF gốc. Không gọi `openDocument` Zalo. Nội dung hiện là tài liệu chấm công mẫu; chưa tự đặt nội quy lao động chính thức của quán.
3. **Video:** lấy MP4 qua endpoint có xác thực rồi phát bằng HTML video/Blob URL. Có Tải video và Lưu để xem lại. Mục Đã lưu là dấu đánh dấu trong tài khoản, không đồng nghĩa đã tải offline hoặc lưu vào thư viện điện thoại. Hiện dùng video hướng dẫn chấm công tự tạo 30 giây; chưa có video công thức món thật của quán.
4. **Giữ sáng:** bật khi đang phát video hoặc mở màn quét QR demo, tắt khi dừng/đóng/chuyển nền/rời màn. Dùng Web Wake Lock nếu hỗ trợ; nếu không, ghi rõ đang mô phỏng. Màn QR dùng mã mẫu, không mở camera, không quét Zalo thật.

`DEMO_ONLY = true` chặn mọi nhánh native trong device service. Khởi động app không còn khởi tạo SDK Native Storage. Không gửi token điện thoại/vị trí tới Zalo hoặc cầu nối Graph.

## PDF/video được phục vụ thế nào

- Edge Function mới `attendance-training-assets`, verify JWT bật; trong handler tiếp tục xác thực `getUser` và dòng active của `attendance_preview_accounts` bằng client theo token người dùng/RLS.
- Chỉ có hai tệp mẫu cố định. Không đọc bảng nhân sự/đơn hàng, không dùng service-role, không nhận đường dẫn tùy ý, không truyền tệp người dùng lên server.
- POST `guide` trả `application/pdf`, POST `video` trả `video/mp4`; các phương thức khác bị từ chối, request không có phiên hợp lệ bị chặn.
- Bản build Mini App chỉ chứa JS/CSS/PNG. Không còn dựa vào việc upload MP4/PDF trong gói Zalo (định dạng này đã bị CLI bỏ qua ở bản 1–3).
- Khi rời màn đào tạo, hủy request đang chạy và thu hồi Blob URL. Khi mở lại, tải lại bằng phiên hiện tại; chưa cam kết xem offline.

## Kiểm tra đã thực hiện

- 16/16 unit test đạt: gate điện thoại trước Auth, hết hạn/sai tài khoản, không vào nhánh API Zalo ngay cả khi hostname là Zalo, cùng các kiểm thử nghiệp vụ trước đó.
- Build subapp, ESLint scope app và kiểm tra UTF-8 đạt.
- Endpoint live: PDF 82.306 byte, MP4 120.347 byte, HTTP 200, MIME/signature đúng; không đăng nhập HTTP 401.
- Browser: từ chối liên kết vẫn khóa đăng nhập; đồng ý rồi đăng nhập được. Video readyState 4, duration 30 giây, phát tăng currentTime, pause thành công, giữ sáng đổi on → off. Mở PDF, phóng trang, lưu tài liệu/video và mở lại màn được kiểm tra.
- SQL kiểm tra tài khoản thử có liên kết mẫu và hai mục đã lưu.
- Màn QR demo hiển thị giữ sáng, nhận mã mẫu rồi đóng; không tạo thêm ca chấm công chỉ để thử.
- **Giới hạn bằng chứng tải về:** click liên kết Tải PDF trong browser tích hợp chưa phát sự kiện download cho công cụ. Đã xác minh được byte tệp tải qua endpoint và Blob sẵn sàng, nhưng chưa xác nhận lưu tệp vào thư mục của hệ điều hành hoặc điện thoại. Không ghi là đã tải thành công trên Zalo native.
- **Giới hạn thiết bị:** chưa kiểm tra trực tiếp Zalo trên điện thoại. Luồng native mở PDF, lưu video vào gallery và xin số điện thoại vẫn chưa gọi, đúng yêu cầu demo.

## Quyền nào còn thiếu bằng chứng thật

| Quyền | Bản demo thể hiện | Bằng chứng native còn thiếu |
| --- | --- | --- |
| Số điện thoại | Đồng ý và liên kết số mẫu trước Auth | Gọi quyền Zalo, người dùng đồng ý, đối chiếu số thật vào hồ sơ |
| Mở PDF | Xem trang PDF trong app | Mở tài liệu qua API Zalo trên thiết bị |
| Tải tệp | Có PDF/CSV và liên kết tải | Xác nhận file thực sự được tải trên thiết bị/API tải tệp Zalo |
| Lưu video | Phát và đánh dấu xem lại; liên kết tải MP4 | Lưu vào thư viện/điện thoại qua API Zalo và kiểm tra kết quả |
| Giữ sáng | Web Wake Lock hoặc chỉ báo mô phỏng | `keepScreen` Zalo, xác minh trên điện thoại khi phát/dừng/quét/đóng |
| GPS/QR/camera/media/mạng/rung | Nghiệp vụ và adapter/demo hoặc Web API | Chưa có bằng chứng các API Zalo tương ứng được thực thi trên điện thoại |

Demo đủ để duyệt luồng sản phẩm và chuẩn bị lý do giải trình; không dùng làm bằng chứng đã chạy quyền Zalo thật hoặc bảo đảm được duyệt.

## File mới

- `attendance-miniapp/scripts/prepare-training-assets.py`
- `attendance-miniapp/src/assets/huong-dan-cham-cong-trang-1.png`
- `attendance-miniapp/src/constants/runtimeMode.js`
- `attendance-miniapp/src/components/DemoQrScanner.jsx`
- `attendance-miniapp/src/hooks/useScreenAwake.js`
- `attendance-miniapp/src/hooks/useTrainingFiles.js`
- `attendance-miniapp/src/services/demoPhoneService.js`
- `attendance-miniapp/src/services/trainingMaterialService.js`
- `attendance-miniapp/tests/demo-flows.test.mjs`
- `supabase/functions/attendance-training-assets/index.ts`
- `supabase/functions/attendance-training-assets/assets.ts` (dữ liệu mẫu tự tạo, sinh bằng script)
- Báo cáo này.

## File cập nhật

- `attendance-miniapp/src/components/Login.jsx`, `Training.jsx`, `Checkin.jsx`, `Account.jsx`
- `attendance-miniapp/src/hooks/useAttendance.js`
- `attendance-miniapp/src/services/attendanceAuthService.js`, `deviceService.js`
- `attendance-miniapp/src/main.jsx`, `styles.css`
- `eslint.config.js` (khai báo Web API AbortController)
- `docs/checklist/attendance-miniapp-demo.md`, `docs/project-status.md`
