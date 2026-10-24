# Liên kết điện thoại: ba tình huống demo

Ngày 24/10/2026. Chỉ thay đổi local, chưa upload Testing, chưa đồng bộ lại Cloud, chưa gọi API Zalo hoặc gửi xét duyệt.

- Đăng nhập không phụ thuộc số điện thoại. Liên kết ở Thông tin tài khoản, không tự mở.
- Giải thích mục đích trước khi đồng ý; không hiển thị số mẫu đầy đủ trước khi cấp sự đồng ý.
- Bộ chọn tình huống trải nghiệm: khớp hồ sơ, không khớp, từ chối.
- Khớp: kết quả đối chiếu mẫu được lưu theo tài khoản, hiển thị số che bớt sau khi lưu. Nếu đã liên kết, không ghi đè hoặc giả vờ lưu lại.
- Không khớp: hướng dẫn liên hệ quản lý, không ghi dữ liệu.
- Từ chối/Để sau: không ghi dữ liệu, vẫn chấm công được. Đóng chỉ đóng hộp thoại.
- Khi đang xử lý khóa thao tác lặp; lỗi lưu cho phép thử lại. Giữ hộp thoại để đọc kết quả.
- Không kiểm tra số Zalo thật hoặc xác minh sở hữu. Trường verified=false và simulated=true phân biệt mẫu với xác minh thật. Đối chiếu/trùng số server và quy trình đổi số còn phải làm trước production.

Kiểm tra: 16 unit test đạt, gồm bất biến không ghi khi từ chối/không khớp và không ghi đè liên kết đã có; build subapp đạt. Không tạo ca công để thử.

File mới: attendance-miniapp/src/components/PhoneLinkDialog.jsx; báo cáo này.
File cập nhật: attendance-miniapp/src/components/Account.jsx; attendance-miniapp/src/hooks/useAttendance.js; attendance-miniapp/src/services/demoPhoneService.js; attendance-miniapp/tests/demo-flows.test.mjs.

Kiểm tra browser: đăng nhập không qua gate điện thoại; đã thử khớp trên tài khoản có liên kết (không ghi đè), không khớp và từ chối hiện đúng kết quả. Nhánh lưu lần đầu kiểm tra qua unit test, không xóa liên kết hiện có để tạo lại. ESLint phạm vi sửa đạt.

## Cập nhật bảng chia sẻ theo ảnh Zalo

Thay hộp chọn tình huống bằng bottom sheet logo GHR, công tắc chia sẻ SĐT mặc định tắt, nút Từ chối/Cho phép. Không xin tên/ảnh đại diện. Ghi rõ mô phỏng, không phải dialog native Zalo. Tìm hiểu thêm mở giải thích mục đích. Không hiển thị số trước đồng ý.

Khớp/không khớp chuyển sang details Thử luồng chia sẻ số điện thoại riêng ở Tài khoản. Từ chối thử bằng nút trong sheet. Kết quả chỉ xuất hiện sau thao tác. Đã kiểm tra browser: mặc định Cho phép bị khóa; bật công tắc thì mở; từ chối không ghi; cho phép trên tài khoản có liên kết không ghi đè. 18 test/build/lint đạt. Chưa upload thay đổi này; Testing 5 vẫn dialog cũ.

File cập nhật thêm: attendance-miniapp/src/components/PhoneLinkDialog.jsx; attendance-miniapp/src/components/Account.jsx; attendance-miniapp/src/styles.css; báo cáo này.
