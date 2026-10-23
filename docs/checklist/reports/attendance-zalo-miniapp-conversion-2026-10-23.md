# Chuyển app chấm công sang project Zalo Mini App

Ngày: 23/10/2026. Phạm vi: chuyển mã nguồn và gói build, giữ dữ liệu mẫu, chưa nối database. Không xin quyền, gửi xét duyệt, upload hay deploy.

## Đã chuyển

- `zmp-cli.json`: khai báo Mini App ID `2442731166050783503` lấy từ trang quản lý người dùng đã mở. CLI nhận diện project với ID này.
- `app-config.json`: cấu hình thanh native Zalo, màu trắng và chữ đen theo giao diện dự án; giữ title và nút back do Zalo quản lý.
- Entry DOM đổi từ `root` sang `app`, theo hợp đồng index của nền tảng Zalo.
- Vite dùng đường dẫn tương đối, xuất entry/chunk `.module.js`, bỏ module-preload polyfill, asset riêng và manifest.
- Build tự tạo `dist/app-config.json` từ manifest, kiểm tra mọi tham chiếu asset và root `app`. Giới hạn mỗi file 3 MB và tổng gói 10 MB được kiểm tra trước khi bàn giao.
- Khởi tạo môi trường Mini App trước khi render app.
- Dữ liệu mẫu trên Zalo dùng SDK Native Storage, tuần tự hóa thao tác ghi, kiểm tra lại giá trị sau lưu, giới hạn metadata 1 MB. Không dựa vào IndexedDB hoặc sessionStorage trong runtime Zalo.
- Phiên đăng nhập mẫu trong Zalo giữ trong bộ nhớ, không ghi mật khẩu/token xuống bộ nhớ trình duyệt. Đóng/mở lại có thể cần đăng nhập lại. Web local vẫn đọc kho cũ để giữ dữ liệu thử đã có.
- Nhận diện host Zalo, Device mode có App ID được inject và simulator local. Web local thông thường không tự bị nhận là Zalo.
- Các chức năng thiết bị tiếp tục đi qua `zmp-sdk`; chưa nối database theo yêu cầu mới.

## Kiểm tra

- 11/11 kiểm thử: 9 nghiệp vụ và 2 kiểm tra nhận diện/runtime Native Storage, gồm trường hợp ghi đồng thời, hết dung lượng và không dùng sessionStorage trên Zalo.
- Build cuối với Vite 5.4.21 thành công: 653.726 byte; file lớn nhất 243.510 byte. Entry/module, PDF, MP4 và logo đều nằm trong gói và được liệt kê/kiểm tra.
- ESLint trong phạm vi app và kiểm tra encoding đều đạt.
- CLI Zalo 4.0.5 nhận đúng App ID và khởi động server local tại `http://localhost:5183/`. Dùng Vite 5 để tương thích CLI. Tab simulator bị timeout khi điều khiển trình duyệt, vì vậy chưa xác nhận được hiển thị hay luồng đăng nhập trong simulator. Các kiểm thử runtime hiện là unit test, chưa phải bằng chứng thiết bị.
- Cấu hình được đối chiếu với [hướng dẫn chuyển web thành Mini App chính thức](https://docs.zaloplatforms.com/docs/MA/intro/getting-started/convert-web-app-to-mini-app) và [hướng dẫn CLI](https://docs.zaloplatforms.com/docs/MA/intro/getting-started/dev-use-command-line).

## Cách mở

`attendance-miniapp` là thư mục project để mở bằng Zalo Mini App Studio hoặc Zalo Mini App Extension. Dùng Mini App ID `2442731166050783503` khi công cụ yêu cầu. Bản build nằm ở `attendance-miniapp/dist`.

`npm start` hoặc `start-miniapp.cmd` mở công cụ CLI local; `npm run dev` vẫn phục vụ xem nhanh giao diện web. Hai chế độ này không phải bằng chứng đã chạy trên điện thoại Zalo.

Để xác nhận chạy thật bên trong Zalo cần mở qua công cụ Studio/Device và quét bằng điện thoại thuộc nhóm phát triển. Chưa có bằng chứng thiết bị trong lượt này. Không tự dùng `zmp init`, login, deploy hoặc thay trạng thái Mini App trên trang quản lý. Việc đóng gói project không đồng nghĩa app đã được cấp quyền hoặc có bản Live.

## File

Mới:

- `attendance-miniapp/app-config.json`
- `attendance-miniapp/zmp-cli.json`
- `attendance-miniapp/start-miniapp.cmd`
- `attendance-miniapp/scripts/build-miniapp.mjs`
- `attendance-miniapp/src/services/miniAppRuntime.js`
- `attendance-miniapp/tests/miniapp.test.mjs`
- `docs/checklist/reports/attendance-zalo-miniapp-conversion-2026-10-23.md`

Cập nhật:

- `attendance-miniapp/package.json`, `attendance-miniapp/package-lock.json`
- `attendance-miniapp/index.html`, `attendance-miniapp/vite.config.js`, `attendance-miniapp/.gitignore`
- `attendance-miniapp/src/main.jsx`
- `attendance-miniapp/src/services/demoRepository.js`, `attendance-miniapp/src/services/deviceService.js`
- `docs/checklist/attendance-miniapp-demo.md`

Không thay schema, dữ liệu, RLS hoặc cấu hình Supabase của dự án chính.
