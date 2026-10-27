# Liên kết số điện thoại — giải trình lại ngày 27/10/2026

## Nội dung đề xuất gửi Zalo

Người dùng đăng nhập tài khoản đã được cấp rồi tự vào Thông tin tài khoản để chia sẻ số Zalo. Gánh Hàng Rong dùng số này đối chiếu hồ sơ nhân viên của tài khoản đang đăng nhập, tránh liên kết nhầm người. Không xin số ngay khi mở app và không dùng số được chia sẻ để đăng nhập hay tự cấp quyền nhân viên.

Chỉ nhận số sau khi người dùng bật lựa chọn và bấm Cho phép. Nếu từ chối, người dùng vẫn dùng tích điểm và điểm danh. Nếu số không khớp, giữ nguyên thông tin đang có và nhờ quản lý kiểm tra trước khi liên kết. Số điện thoại không được dùng để tự cộng điểm hoặc gửi quảng cáo. Bản Testing dùng số mẫu để trình bày luồng, chưa gọi API Zalo thật. Chúng tôi đề nghị cấp quyền để tích hợp và kiểm thử đúng luồng này.

## Nội dung hiển thị khi xin người dùng đồng ý

Chia sẻ số Zalo để kiểm tra tài khoản có khớp hồ sơ nhân viên của bạn hay không. Bạn có thể từ chối và vẫn dùng tích điểm, điểm danh.

## Ranh giới logic

- Đăng nhập trước, chia sẻ số sau, tại mục Tài khoản. Không đặt số Zalo làm điều kiện bắt buộc để qua màn chọn hai chức năng.
- Chỉ xin số điện thoại; không bổ sung tên, ảnh đại diện hoặc danh bạ vào yêu cầu này.
- Trường hợp khớp chỉ lưu liên kết mẫu của đúng tài khoản đang đăng nhập; không ghi đè liên kết cũ. Trường hợp chưa khớp không tự tạo hồ sơ, gộp người dùng hay đổi quyền.
- Điểm demo tính từ hóa đơn mẫu theo actor ID, không từ số điện thoại. Không giải trình rằng đã có tích điểm mua hàng thật hoặc tự xác minh nhân viên bằng số Zalo.
- Quyền100 trên portal vẫn Đợi xét duyệt khi kiểm tra27/10. Quản lý quyền không hiển thị nút sửa yêu cầu đang chờ; chưa khẳng định nội dung cũ đã được thay trên Zalo.
- Không gọi API Zalo native trong frontend; DEMO_ONLY vẫn true. Từ chối không làm đổi hồ sơ hay liên kết trước đó.

## Kiểm tra và phát hành Testing

Build đạt584041byte;8kiểm thử về số điện thoại, native guard, điểm và điều hướng đạt. Lần upload đầu CLI báo Permission denied; chủ app quét QR xác nhận đăng nhập lại, CLI Login Success. Upload tiếp thành công: **Deploy Done, Version8, Testing**, ghi chú membership-and-attendance-demo. Không gửi xét duyệt phiên bản/Publish Live trong tác vụ này. Manifest nguồn được khôi phục sau upload, frontend vẫn DEMO_ONLY.

Version7 trên portal hiện Rejected, không còn ở trạng thái chờ duyệt như mốc25/10. Quyền số điện thoại và10quyền xin trước vẫn Đợi xét duyệt khi kiểm tra27/10; chưa được xác nhận cấp. Không rút/hủy hoặc nộp trùng để thay giải trình. Nội dung ở trên và trong giao diện là bản giải trình mới; chưa sửa yêu cầu đang chờ trên portal vì không có thao tác chỉnh sửa được hiển thị.

Portal xác nhận Version8 Testing, ghi chú membership-and-attendance-demo, thời gian09:13:54 27/10/2026. [Ảnh xác nhận](assets/attendance-testing8-2026-10-27/testing8-confirmed.jpg), [QR mở Testing8](assets/attendance-testing8-2026-10-27/testing8-qr.jpg). SHA256 entry bundle local:35FE11840D2A7EB88D511F327E0B7B7632D573F637A4BAB4ADF8ABF267A5969D. Đây là bằng chứng upload/status, chưa phải kiểm thử trên thiết bị Zalo.

File cập nhật: Account.jsx, PhoneLinkDialog.jsx, PrivacyNotice.jsx, useAttendance.js, demoPhoneService.js trong attendance-miniapp/src. Báo cáo này là file mới. Bản giao diện đã đồng bộ trước tại b484751 trên nhánh codex/zalo-membership-preview-20261027.

Tài liệu nền tảng: https://docs.zaloplatforms.com/docs/MA/intro/request-permission
