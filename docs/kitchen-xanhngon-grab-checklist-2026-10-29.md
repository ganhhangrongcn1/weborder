# Xanh Ngon: checklist món kèm tham chiếu Grab

## Phạm vi

- Theo yêu cầu chủ quán: tham chiếu Grab vì menu Xanh Ngon tương tự, áp dụng checklist nhất quán cho các món/tùy chọn tương ứng.
- Đã fetch nguồn Cloud, nền `origin/main` tại `3098fab2289e3a6fcd7f2ee2948b8f4aec1da39d`. Thay đổi vận hành chỉ ở `public.app_configs`, khóa `ghr_kitchen_option_group_settings`.
- Không sửa mã sản phẩm, schema, API, APK, đơn, giá tiền, trạng thái món hoặc tiến độ nhân viên đã tick. Không tạo lệnh in và không gửi thông báo.

## Bằng chứng

- Đơn `XN-6974` tại Đường 30/4 có Combo Cuốn Trộn Chấm với đủ ba lựa chọn: Bánh Tráng Cuốn Bơ, Bánh Tráng Trộn Đặc Biệt, Bánh Tráng Chấm Gánh. Trước sửa chỉ Cuốn Bơ được bật checklist.
- Đơn `XN-4677` có Trà Xoài Chanh Dây - Size L trong lựa chọn của Bánh Tráng Cuốn Bơ, nhưng quy tắc Xanh Ngon đang tắt checklist nên chỉ hiện nhãn.
- Payload gốc NexPOS và `partner_order_items.options` đều có dữ liệu. Xanh Ngon gom vào nhóm “Tùy chọn”, khác cách chia nhóm của Grab.
- Đối chiếu 20 quy tắc Xanh Ngon đã lưu: tất cả tên đều có tham chiếu Grab, trạng thái bật/tắt chỉ lệch ba mục bên dưới.
- Rà lựa chọn thực tế của đơn Xanh Ngon từ 22–29/10/2026: phát hiện thêm Trà Sữa Gạo Rang và Sốt Muối Béo chưa có quy tắc riêng. Cả hai có tham chiếu Grab rõ ràng.

## Đã áp dụng trên Cloud

| Tùy chọn | Thay đổi | Nhóm Kitchen |
|---|---|---|
| Trà Xoài Chanh Dây - Size L | Bật ô tick | Chọn Nước |
| Bánh Tráng Trộn Đặc Biệt | Bật ô tick | Chọn Món Bánh Tráng Trộn |
| Bánh Tráng Chấm Gánh | Bật ô tick | Chọn Món Combo |
| Trà Sữa Gạo Rang - Size L | Thêm quy tắc, bật ô tick | Chọn Nước |
| Sốt Muối Béo | Thêm quy tắc, chỉ hiển thị hướng dẫn | Chọn Loại Sốt |

- Giữ nguyên nhóm nguồn “Tùy chọn” để khớp dữ liệu Xanh Ngon. Không bật `groupEnabled` cho cả nhóm vì sẽ bắt tick cả sốt/độ cay/cách trộn.
- Những tùy chọn đang đúng được giữ nguyên. Khi Grab có cùng tên ở nhiều nhóm, chỉ sử dụng trạng thái bật/tắt nếu các tham chiếu đồng nhất; dùng tên nhóm phù hợp nội dung món để hiển thị trên Kitchen.
- Kết quả sau áp dụng: 22 quy tắc Xanh Ngon. Đọc lại toàn bộ config khớp chính xác bản đã duyệt; các nguồn khác và metadata config không đổi.
- SQL khóa dòng, kiểm tra `updated_at`, kiểm tra đúng ba mục cần sửa và không trùng hai mục mới; dừng nếu phát hiện phiên khác chỉnh cấu hình. SQL này ghi lại thao tác vận hành, không phải migration schema.

## Kiểm tra trước và sau áp dụng

- Dùng chính `buildKitchenChecklistOptions` và các helper hiển thị Kitchen; database/printer được mock, không ghi đơn hoặc tiến độ thật.
- 22 lựa chọn sau áp dụng đều khớp trạng thái tương ứng của Grab.
- 4 dòng món từ hai đơn thật được đối chiếu: combo XN-6974 chuyển từ 1 lên 3 ô tick; trà xoài XN-4677 chuyển từ không có lên một ô tick; dòng món không có tùy chọn không tự thêm ô.
- 8 hướng dẫn độ cay/cách trộn/sốt vẫn hiển thị, không tạo ô tick. Lựa chọn trùng qua dữ liệu raw và nhãn phẳng chỉ tạo một ô; nhãn đã có checklist được nhận diện để không hiển thị trùng.
- Bộ kiểm tra chạy đạt trước khi áp dụng và lần nữa với config đọc trực tiếp từ Cloud sau áp dụng.
- Chạy lại độc lập: `node --experimental-vm-modules scripts/xanhngon-grab-checklist.test.mjs`. Có thể dùng `--stdin` với JSON cùng cấu trúc để kiểm tra snapshot Cloud mới.

## Sử dụng và giới hạn

Tải lại Kitchen để nạp cấu hình mới. Không cần nâng APK hoặc triển khai mã runtime mới. Chưa bấm tick trên màn hình thật tại quán; tiến độ tick thật không được thay đổi trong quá trình kiểm tra.

Các lựa chọn Xanh Ngon mới phát sinh về sau cần được rà trong mục **Checklist chế biến → nguồn Xanh Ngon → Quét lại tùy chọn**. Không tự suy diễn rằng mọi lựa chọn trong nhóm “Tùy chọn” đều phải tick.

Muốn hoàn tác, đối chiếu config mới nhất và chỉ khôi phục năm quy tắc liên quan theo snapshot trước trong fixture; không ghi đè toàn bộ config nếu có chỉnh sửa mới của Admin.

## File ghi nhận

- `docs/supabase-sql/2026-10-29-align-xanhngon-checklist-with-grab.sql`: thao tác cấu hình đã áp dụng.
- `scripts/xanhngon-grab-checklist.test.mjs`: kiểm tra logic thật, I/O mock.
- `scripts/fixtures/xanhngon-grab-checklist.json`: snapshot tham chiếu trước/sau và món của hai đơn, không có thông tin khách.
- Báo cáo Markdown này.
