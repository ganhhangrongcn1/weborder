# QR bill 0đ: thông báo không phát sinh tích lũy

- Bằng chứng chỉ đọc: GHR-7526 / GHR261027102317353 là đơn đổi quà, total_amount=0, points_base_amount=0, expected_earn_points=0, paid/done và không có SETTLE_EARN. RPC public get_receipt_loyalty vẫn trả waiting_data khi snapshot có 0 điểm; UI nhầm thành chờ đối soát.
- Sửa lớp service hiển thị: chỉ khi tổng bill, giá trị tính điểm và điểm đều có dữ liệu rõ ràng bằng 0 mới chuyển waiting_data/available/expired sang not_eligible. Không suy diễn từ giá trị thiếu; giữ ưu tiên claimed/cancelled.
- Trang hiện “Đơn 0đ không tích thêm điểm hoặc tem”, bỏ +0 điểm, giá trị tính điểm và nút kiểm tra lại bill; không hiện form nhận điểm. Vẫn có xem điểm và đăng nhập như cũ.
- Không đổi SQL/RPC, dữ liệu, giao dịch điểm/tem, hạn 24h của bill có tiền, token, banner hoặc APK. Chỉ sửa web, không yêu cầu cập nhật POS.
- Test `scripts/receipt-zero-total.test.mjs`: số 0 đã biết, dữ liệu thiếu, đơn có tiền chờ đối soát, hết hạn, đã tích, hủy và nội dung render.

## File

- Cập nhật: `src/services/receiptLoyaltyService.js`, `src/pages/ReceiptLoyaltyPage.jsx`.
- Mới: `src/services/receiptLoyaltyDisplayService.js`, `scripts/receipt-zero-total.test.mjs`, ghi chú này.

## Triển khai và xác minh

- PR #20 đã merge vào main: `7235a43597c9ae5eaf8405eb6234f206c779ed32`.
- Vercel production `dpl_2ghnJUDkXHsn7TKWi4xLGKvTiRfr` READY, đúng merge SHA. Cloud build thành công; build local chậm đã dừng sau bước transforming, không tính là local build đạt.
- Kiểm thử chuyên biệt, ESLint các file nguồn sửa và encoding 706 file đều đạt.
- Đã mở trực tiếp QR GHR-7526 tại ganhhangrong.vn bằng trình duyệt local: tổng bill 0đ, hiện thông báo không tích thêm điểm hoặc tem; không có +0 điểm, chờ đối soát, form nhận điểm hoặc nút kiểm tra lại. Không gửi yêu cầu nhận điểm.
- POS 0.4.32/code 63 giữ nguyên; không cần APK mới cho sửa hiển thị này.
