# Để sau: thống nhất logic checklist Kitchen giữa các app

Ngày ghi nhận: 29/10/2026.

## Quyết định của chủ quán

Tạm dừng phần thiết kế/triển khai logic checklist chung. Ghi lại để sau này tìm ra logic phù hợp rồi đồng bộ cho các app. Giữ nguyên cấu hình hiện tại; không tự triển khai tiếp từ ghi chú này.

## Vấn đề cần giải quyết

- Việc rà đơn cũ và bật tick cho từng tùy chọn chỉ bao phủ những lựa chọn đã nhận diện.
- Đơn tương lai có đúng lựa chọn đã cấu hình vẫn được tạo ô tick. Tùy chọn mới, đổi tên hoặc đổi nhóm có thể không khớp và chỉ hiện nhãn, khiến nhân viên dễ bỏ sót.
- Xanh Ngon hiện gửi nhiều lựa chọn chung nhóm “Tùy chọn”; Grab/Shopee có nhóm rõ hơn. Không thể mặc định mọi tùy chọn chung đều phải tick.
- Cùng tên nhưng khác ngữ cảnh có thể cần cách xử lý khác, ví dụ sốt chế biến mặc định và phần sốt mua thêm.

## Hướng thảo luận, chưa phải đặc tả được duyệt

- Phân loại chuẩn của Gánh: món con combo, nước/món mua kèm, topping cần chuẩn bị, hướng dẫn chế biến và lựa chọn chưa nhận diện.
- Ưu tiên quy tắc riêng đã duyệt; tiếp đến quy tắc nhóm của app; sau đó bảng đối chiếu sang món/tùy chọn chuẩn của Gánh.
- Grab là nguồn tham chiếu ban đầu, không tự động quyết định mọi trường hợp của app khác.
- Cân nhắc đánh dấu tùy chọn chưa nhận diện là “Cần kiểm tra” thay vì âm thầm xem là hướng dẫn. Chưa chốt có chặn hoàn tất món/đơn hay không.
- Checklist theo từng phần món và số lượng; tránh tạo trùng khi cùng tùy chọn xuất hiện ở nhiều trường dữ liệu.
- Cần chốt cách giữ tiến độ đã tick khi cấu hình thay đổi, phạm vi áp dụng cho đơn đang làm và đơn cũ, cùng cách xử lý offline/tải lại.
- Trước khi làm: đối chiếu Cloud, hợp đồng dữ liệu từng nguồn và cấu hình Admin hiện tại; kiểm thử nhiều app bằng dữ liệu mẫu, không sửa đơn thật để thử.

## Hiện trạng cần phân biệt

Ngày 29/10/2026 đã áp dụng cấu hình Xanh Ngon tham chiếu Grab cho các lựa chọn đã biết. Chưa có cơ chế tự phân loại/cảnh báo lựa chọn mới cho toàn bộ app.

Chi tiết phần đã làm: [Xanh Ngon tham chiếu Grab](kitchen-xanhngon-grab-checklist-2026-10-29.md).

Ghi chú này chỉ lưu backlog, không yêu cầu sửa code, cấu hình hoặc dữ liệu vận hành.
