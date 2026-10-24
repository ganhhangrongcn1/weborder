# App chấm công: đăng nhập Supabase và chuẩn bị bản Testing

Ngày 23/10/2026. Bổ sung sau báo cáo chuyển đổi Mini App. Người dùng đã cho phép tải bản Testing lên Zalo và chọn tạo tài khoản thử riêng; chưa cho phép xét duyệt/phát hành Live.

## Kết quả hiện tại

**Testing Version 3:** Đã đổi bộ icon đồng bộ và upload thành công. Xem [đánh giá mức độ sẵn sàng của app](attendance-icons-readiness-2026-10-23.md): bản hiện tại chỉ phù hợp trải nghiệm chấm công cá nhân cơ bản, chưa dùng nhân sự thật/tính lương. Chưa xét duyệt/Live; PDF và video vẫn chưa có trong gói Zalo.

**Testing Version 2:** Đã upload thành công bản cho phép nhập bí danh `test` thay email dài theo yêu cầu người dùng; vẫn xác thực bằng Supabase Auth và giữ nguyên phân quyền. Mật khẩu thử đã đổi ngắn và xác minh đăng nhập lại thành công, thông tin cập nhật trong file local tmp, không đưa mật khẩu vào source/báo cáo. Thêm test bí danh, 14/14 test đạt; build và lint phần thay đổi đạt. Chỉ Testing, chưa gửi duyệt/Live. File cập nhật thêm: `attendanceAuthService.js`, `Login.jsx`, `tests/auth.test.mjs`; QR Testing 2 và thông tin tài khoản ở tmp được ignore.

**Cập nhật sau xác thực Zalo:** CLI 4.0.5 báo `Deploy Done`, **Testing Version 1**, App ID `2442731166050783503`. Chỉ upload Testing; không thực hiện gửi xét duyệt hay phát hành. Trang quản lý trong phiên browser bị chuyển về trang chủ khi đối chiếu lại, nên bằng chứng upload hiện là kết quả CLI; chưa kiểm chứng bằng điện thoại. QR mở bản Testing được lấy từ chính kết quả CLI, tách biệt QR đăng nhập đã hết hạn. CLI bỏ qua file MP4 và PDF vì đuôi file không được hỗ trợ; phần đào tạo/video/tài liệu trên bản 1 chưa hoạt động, cần host tài nguyên HTTPS riêng trước khi nghiệm thu các mục đó.

Đã thêm `attendance-miniapp/scripts/deploy-testing.mjs`: đồng bộ manifest asset từ dist vào cấu hình root đúng lúc CLI upload, luôn khôi phục cấu hình source sau đó. `npm run deploy:testing` build rồi chạy script này. Lần đầu thiếu asset chưa upload thành công; lần kế tiếp thành công sau khi sửa cách đưa manifest cho CLI.

Người dùng đã cho phép lưu tạm QR và thông tin tài khoản trong `attendance-miniapp/tmp/`; các file này được Git ignore, không đưa vào bundle/source/Cloud. Thông tin tài khoản đã bàn giao bằng file local, không ghi mật khẩu vào báo cáo.

- Đã nối Supabase Auth bằng email/mật khẩu với client riêng, phiên trong bộ nhớ; không dùng phiên Admin/POS và không lưu mật khẩu trong source hoặc browser storage.
- Tạo một tài khoản thử riêng qua Supabase Dashboard, xác nhận email qua form quản trị, không gửi email ra ngoài. Thông tin xác thực chưa được bàn giao bằng file vì automatic review từ chối lưu mật khẩu dạng văn bản.
- Dữ liệu chấm công thử lưu ở `public.attendance_preview_accounts`, chỉ tài khoản được cấp thủ công mới truy cập được. Đây là kho Testing độc lập, không ghi vào `checklist_employees`, bảng payroll hoặc sửa hồ sơ nhân sự thật. 11 hồ sơ nhân sự hiện có chưa liên kết Supabase Auth; chưa tự gán hoặc thay đổi các hồ sơ đó.
- Tài khoản thử chỉ có vai trò nhân viên trong ứng dụng này. Không có quyền duyệt quản lý. Quyền lấy từ dòng server cấp, không lấy từ user metadata. Frontend không được tự thêm account/đổi vai trò/kích hoạt account.
- RLS giới hạn đọc/ghi theo `auth.uid()` và trạng thái active; grant UPDATE chỉ có `state,revision`. Ghi theo revision để chặn ghi đè giữa thiết bị. Giới hạn 1 MB metadata, không fallback sang kho demo khi lỗi remote.
- Đây chưa phải hợp đồng chấm công production: dữ liệu Testing là snapshot JSON theo tài khoản, quy tắc ca/GPS còn xử lý ở frontend, GPS/QR đang dùng mẫu để trải nghiệm; chưa xác thực giờ/vị trí phía server, chưa dùng tính lương. Native media vẫn cần kiểm chứng trên Zalo, file native có thể chỉ xem trên thiết bị đã tạo.
- Giao diện cơ bản: đăng nhập gọn, chấm công hai bước GPS rồi vào/ra ca; lịch sử là từng thẻ ca đọc được trên điện thoại, không cuộn ngang bảng.

## Kiểm chứng

- 13/13 unit test đạt; build gói Mini App đạt, khoảng 858 KB, file lớn nhất khoảng 386 KB.
- ESLint trong app và kiểm tra UTF-8 đạt.
- Browser: đăng nhập tài khoản thử thành công, vào ca được lưu remote, tải lại/đăng nhập lại vẫn thấy ca; ra ca và lịch sử hoàn thành được kiểm tra cả UI và SQL. Giữ ca thử này trong tài khoản thử, không xóa âm thầm.
- SQL impersonation kiểm tra owner đọc được 1 account, UUID khác đọc được 0; anon không có SELECT; authenticated không có UPDATE role. Advisors security không có mục nhắc tới bảng mới. Các advisory cũ ngoài phạm vi không được thay đổi.
- Màn Zalo Quản lý phiên bản hiện chưa có bản upload. CLI deploy Testing báo `Permission denied. Please login again.` Cần xác thực Zalo bằng tài khoản Admin/Developer và quét QR trước khi upload được.
- Automatic review đã từ chối lưu QR đăng nhập ra ảnh cục bộ vì chứa thông tin xác thực. Chưa vượt qua chặn bằng cách khác, chưa upload, chưa xét duyệt, chưa phát hành. Cần người dùng cho phép lưu tạm QR hoặc tự xác thực CLI.

## Tiếp tục

1. Xử lý bàn giao thông tin đăng nhập thử và xác thực Zalo qua QR.
2. `npm run deploy:testing` trong `attendance-miniapp`, kiểm tra đúng App ID `2442731166050783503` và trạng thái Testing. Không bấm gửi xét duyệt/phát hành.
3. Đọc kết quả upload, đối chiếu version/QR trên trang quản lý và kiểm tra bằng điện thoại Zalo của Admin/Developer. Chưa coi browser local hoặc build là bằng chứng native.
4. Khi dùng thật: thiết kế dữ liệu ca chuẩn, kiểm tra server, chống chỉnh sửa, quyền quản lý/chi nhánh, hồ sơ nhân viên, Storage và các quyền Zalo cần thiết. Không tự nâng cấp kho Testing thành bảng tính lương.

## File mới

- `attendance-miniapp/src/services/attendanceAuthService.js`
- `attendance-miniapp/src/services/attendanceRepository.js`
- `attendance-miniapp/tests/auth.test.mjs`
- `supabase/migrations/20261023065857_attendance_preview_accounts.sql`
- `docs/supabase-sql/20261023065857_attendance_preview_accounts.sql` (bản tham chiếu cùng SQL)
- Báo cáo này.

## File cập nhật

- `attendance-miniapp/.env.example`; `.env.local` chỉ local, không đưa Git.
- `attendance-miniapp/package.json`, `attendance-miniapp/package-lock.json`
- `attendance-miniapp/src/hooks/useAttendance.js`
- `attendance-miniapp/src/main.jsx`
- `attendance-miniapp/src/components/Login.jsx`, `Checkin.jsx`, `History.jsx`, `Account.jsx`
- `attendance-miniapp/src/styles.css`
- `docs/project-status.md`
- `docs/checklist/attendance-miniapp-demo.md`

Tham khảo: [Zalo Testing/Development](https://docs.zaloplatforms.com/docs/MA/devtools/ide/deploy), [Supabase Auth sessions](https://supabase.com/docs/guides/auth/sessions).
