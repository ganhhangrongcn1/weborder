# Pay2S: nội dung POS có khoảng trắng — 02/11/2026

Giao dịch thật 51.000đ `34201713` đến server 20:13:50, content chứa `POS 20261102 201308`. Parser trước đó chỉ đọc POS liền hoặc dấu gạch nên `references=[]`; receipt có `result=no_pay2s_session`, không có session_id, chưa completed. Phiên `POS-20261102-201308` còn pending. Trường hợp này không phải webhook chưa đến.

Sửa `supabase/functions/_shared/pay2sPayload.js` để chấp nhận dấu cách/gạch giữa POS, ngày 8 số, giờ 6 số; vẫn kiểm tra ranh giới để không nhận nhầm mã dài hơn. Bổ sung dữ liệu thực đã bỏ thông tin riêng và ca mã sai vào `scripts/pay2s-payments.test.mjs`. 11 kiểm tra parser/webhook đạt. Đã deploy `pay2s-payment-webhook` v5 ACTIVE, giữ xác thực Bearer token của hàm, verify_jwt=false như trước.

Phục hồi riêng receipt `34201713`: chỉ cập nhật references từ [] sang [POS20261102201308] trong transaction, điều kiện khớp transaction id, amount=51000, raw content, no_pay2s_session, completed_at/session_id null; kiểm tra đúng một dòng. Giữ nguyên raw provider payload, tài khoản, tiền và thời gian. Chưa tự đánh dấu paid hay bỏ kiểm tra hết hạn/huỷ/đã trả tiền. Mục đích để webhook gửi lại không bị transaction_conflict vì parser mới sửa metadata dẫn xuất.

Đã nhờ anh gửi lại webhook từ Pay2S vì trình duyệt Pay2S không kết nối trong phiên này. Cần theo dõi receipt processed, session converted, đơn/Kitchen/print_jobs sau gửi lại. Nếu phiên đã hết hạn/hủy, dùng đối soát vận hành riêng; không vượt guard để tự hồi sinh đơn. Không đề nghị anh chuyển tiền lại.

Đơn có dùng 9.000 điểm nên phải giữ luồng settlement và loyalty chuẩn, không tự cập nhật trạng thái bằng tay rồi bỏ qua các bước sau thanh toán.

Thay đổi này chỉ ở webhook server; APK 0.4.36 đã build không cần đóng lại vì parser không nằm trong app.
