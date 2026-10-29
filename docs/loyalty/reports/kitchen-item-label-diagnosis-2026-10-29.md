# Kitchen: sửa In tem món, giữ đúng món được chọn

## Phạm vi và nguồn

- Người dùng xác nhận thao tác tại Kitchen, nút **In tem món**.
- Đã fetch GitHub. `HEAD` trùng `origin/main`: `8ffa8dd49c0db4878da1fa5bd682ca7d5dd7fe21`.
- Kiểm thử formatter và consumer với dữ liệu mẫu, Supabase và cầu máy in được mock. Không tạo print_jobs thật, không gửi in vật lý, không chỉnh cấu hình hoặc dữ liệu thật.
- Đã đọc trực tiếp `ghr_app_downloads` trên Cloud ngày 29/10/2026: bản công khai **0.4.32 / versionCode 63**, phát hành 27/10/2026. SHA-256 `ece0685b89c91812b0af7c725d9a8b9eca458fc93da211a7deffc419a280c46d` khớp APK lưu tại máy và manifest của nguồn `848574fe5c20df1ff19ae1324ef6661491900229`.
- Không dùng ghi chú cũ “0.4.32 nội bộ, chưa phát hành” làm tình trạng hiện tại. Đối chiếu trực tiếp GitHub main cũng xác nhận versionName 0.4.32/code 63. Kiểm thử chính có consumer chính xác tại commit phát hành này; 0.4.31 chỉ là kiểm tra tương thích bổ sung.

## Kết quả tái hiện trước khi sửa

Đơn mẫu có 2 phần bánh tráng cuốn bơ ghi chú “Ít cay” và 1 trà tắc; chỉ chọn tem phần bánh thứ nhất.

| Nguồn | Tem Kitchen tạo | Sau consumer POS | Kết quả |
|---|---|---|---|
| Website | Đúng một món được chọn | Giữ nguyên tem, không chân tích điểm | Đạt |
| GrabFood | Đúng một món được chọn | Đổi thành hóa đơn đối tác, có chân tích điểm và thông tin hóa đơn | Tái hiện lỗi |
| ShopeeFood | Đúng một món được chọn | Đổi thành hóa đơn đối tác, có chân tích điểm và thông tin hóa đơn | Tái hiện lỗi |
| POS mobile | Đúng một món được chọn | Hàm chống in trùng nhận nhầm là bill POS cần bỏ qua | Phát hiện lỗi bổ sung |

Trong mẫu đã kiểm thử, trà tắc không bị đưa vào tem. Vì vậy bằng chứng xác nhận **tem biến thành mẫu hóa đơn đầy đủ**, chưa xác nhận việc in tất cả món của đơn thật tại quán.

## Nguyên nhân trong mã hiện tại

- `src/services/printJobService.js:createItemLabelPrintJobs` tạo mỗi phần được chọn thành một job `item_label`.
- `src/services/printerService.js:buildItemLabelPrintPayload` có text/html gọn và `order.items` chỉ một món, quantity 1.
- `ghr-pos-mobile-native/src/services/pos/posPrintStationService.js:buildPrintPayload` đã nhận biết `isItemLabel` nhưng vẫn gọi `isPartnerOrderPrintJob` dựa trên nguồn đơn gốc. Sau đó `buildPartnerReceiptText` dựng lại hóa đơn từ món có trong payload và đổi sourceType sang `partner`.
- Vì sourceType đã đổi, `printLocalReceipt` tiếp tục áp dụng mẫu hóa đơn và chân tích điểm thay vì cơ chế tem riêng.
- `processPrintJobOnce` gọi `isPosOrderPrintJob` trước khi xử lý tem; thông tin nguồn POS trong payload khiến tem POS bị đánh dấu đã in và bỏ qua, dù chưa gọi máy in.
- Lịch sử commit `8d89f40` bổ sung việc dựng lại hóa đơn đối tác từ structured order trong `buildPartnerReceiptText`; đây là đường gây chuyển mẫu đã tái hiện. Phiên bản APK đang cài tại quán chưa được xác nhận trong lượt này.

## Đã sửa

- Tem không còn sao chép toàn bộ dữ liệu đơn vào payload: chỉ giữ mã đơn và một món được chọn với quantity 1, tên, topping/options và ghi chú. Thông tin theo dõi batch, đơn gốc, thứ tự phần và chi nhánh vẫn nằm trong metadata của tem.
- Không gửi nguồn Grab/Shopee/POS, khách hàng, tiền và trạng thái thanh toán như dữ liệu hóa đơn. Vì vậy consumer 0.4.32 hiện tại không chuyển tem thành hóa đơn đối tác.
- Mã lệnh tem dùng tiền tố `TEM-`, tránh bị consumer nhận nhầm là bill `POS-*` cần bỏ qua. Mã đơn hiển thị trên giấy và định danh đơn thật không đổi.
- Giữ topping từ `selectedOptions`, `options`, `toppings` hoặc `optionGroups`; giữ ghi chú món và ghi chú chung của đơn nếu có. Mỗi phần được chọn là một tem riêng; không in món không được chọn.
- Chỉ sửa bên producer Kitchen/web; không đổi consumer native, mẫu hóa đơn thường, tiền đơn, điểm/tem thưởng hoặc cấu hình máy in. Không cần APK mới cho các lệnh tem được tạo bằng bản Kitchen đã cập nhật.

## Kiểm thử hồi quy

Chạy: `node --experimental-vm-modules scripts/diagnose-kitchen-item-label.mjs`.

Script được chuyển từ tái hiện lỗi sang kiểm tra hồi quy. Dùng mã formatter web, formatter native, mẫu hóa đơn và consumer thật với các dependency I/O được mock.

- **72 đường in đạt**: 6 nguồn Website/GrabFood/ShopeeFood/Xanh Ngon/POS mobile/POS; hai khổ giấy 58/80mm; hai phần được chọn; ba consumer gồm hiện tại, bản phát hành 0.4.32 và 0.4.31.
- Kiểm tra payload và text thực tế truyền cho cầu in mock: giữ nguyên tem; không món ngoài lựa chọn, không tiêu đề hóa đơn, thông tin khách, số tiền, QR/phần tích điểm hoặc lệnh phụ. Tem POS không còn bị bỏ qua.
- Kiểm tra chọn trùng, một tem mỗi phần, thứ tự phần, topping, có/không ghi chú, ghi chú chung, lựa chọn rỗng/sai phạm vi, chặn sai chi nhánh; các lựa chọn không hợp lệ không tạo job.
- `scripts/receipt-template.test.mjs` đạt: bốn mẫu preview, giữ tiền web/native, một QR/khối tem thưởng, loại trừ phiếu bếp/QR thanh toán và HTML escaping.
- `scripts/stamp-print-station.test.mjs` đạt: in lại và bundle QR không tự cộng tem; không thêm tem thưởng vào phiếu làm món.
- ESLint các file sửa, UTF-8 và `git diff --check` đạt. Build phát hành sử dụng `npm run build` trong pipeline Vercel của main.

## File

- Cập nhật `src/services/printerService.js`: payload tem tối thiểu, topping và ghi chú cần in.
- Cập nhật `src/services/printJobService.js`: namespace mã lệnh tem riêng.
- Mới `scripts/diagnose-kitchen-item-label.mjs`: bộ kiểm tra hồi quy; giữ tên script chẩn đoán ban đầu.
- Mới báo cáo Markdown này.

## Triển khai và giới hạn xác nhận

Đồng bộ đúng bốn file trên lên GitHub main để Vercel build website production; kiểm tra deployment READY và mã phát hành sau khi đẩy. Không thay file APK hoặc metadata tải app.

Sau khi website cập nhật, tải lại Kitchen rồi tạo **lệnh tem mới**. Các job cũ không được tự viết lại hoặc in lại. Chưa thử giấy thật tại quán; cần nhân viên xác nhận một đơn Grab/Shopee và một đơn POS, chỉ chọn một món có topping/ghi chú, giấy chỉ có tem của phần đã chọn.
