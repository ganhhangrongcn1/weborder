# Link trang, chi nhánh và liên hệ

Ngày 24/10/2026. Chỉ local, không upload Zalo/Cloud, không gọi API Zalo thật, chưa gửi duyệt.

## Đã có

- Hash routing cho checkin, history, corrections, training, account, branch. Mở link khi chưa đăng nhập vẫn đăng nhập trước, sau đó giữ trang đích.
- Ví dụ local: http://127.0.0.1:5184/#page=training và http://127.0.0.1:5184/#page=branch&branch=demo-store.
- Chi nhánh không tồn tại có thông báo; link chỉ mở thông tin, không đổi chi nhánh chấm công hoặc cấp quyền.
- Back trong app dùng lịch sử trang nội bộ; tại màn đầu không thoát. Có history guard cho browser Back. Không chặn nút đóng Zalo.
- Số quản lý/link Zalo cấu hình riêng theo branch ID tại attendance-miniapp/src/constants/contactConfig.js. Chủ cửa hàng sẽ cung cấp sau; chưa có màn quản trị hoặc lưu cấu hình DB.
- Số thật hợp lệ dùng tel: mở trình gọi để người dùng xác nhận; link Zalo HTTPS mở trang liên hệ, người dùng tự chọn gọi. Chưa làm gọi Zalo trực tiếp/native. Chưa cấu hình thì báo rõ, không gọi số mẫu.

## Kiểm tra và giới hạn

17 test + build subapp + ESLint phạm vi sửa đạt. Browser đã kiểm tra Tài khoản → Chi nhánh → Back trở lại Tài khoản, và nút gọi chưa cấu hình báo rõ. Chưa gọi số thật. Chưa kiểm chứng deep link launch parameters, nút Back hệ thống hoặc mở liên hệ bên trong Zalo điện thoại. Cần adapter runtime và kiểm chứng native khi người dùng cho phép tích hợp API thật; không coi hash URL local là link chia sẻ Zalo đã hoàn thiện.

## File

Mới: attendance-miniapp/src/hooks/useAppNavigation.js; attendance-miniapp/src/services/navigationService.js; attendance-miniapp/src/constants/contactConfig.js; attendance-miniapp/src/components/BranchDetails.jsx; attendance-miniapp/src/components/ContactActions.jsx; attendance-miniapp/tests/navigation.test.mjs; báo cáo này.
Cập nhật: attendance-miniapp/src/App.jsx; attendance-miniapp/src/components/Account.jsx.

## Bổ sung link ngoài theo ý chủ cửa hàng

Thêm nút Mở Google Maps và danh sách nút HTTPS tùy cấu hình từng chi nhánh. Mở bằng target=_blank, giữ trang chấm công; chưa dùng API Zalo mở website. mapUrl và externalLinks để trống chờ chủ cửa hàng thiết lập, không lấy tọa độ mẫu làm địa chỉ quán thật. Chưa có UI quản trị cấu hình. Runtime Zalo có thể xử lý link khác trình duyệt, cần kiểm tra native sau.

File mới: attendance-miniapp/src/components/BranchLinks.jsx. Cập nhật BranchDetails.jsx, contactConfig.js, navigationService.js, navigation.test.mjs. Build đạt; kiểm thử URL HTTPS và chặn javascript/credentials được bổ sung.
