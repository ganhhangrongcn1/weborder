# POS 0.4.37 — giảm thời gian tạo phiên QR

## Đối chiếu trước Pay2S

Đã đọc source SePay trước khi tích hợp Pay2S: `a41693c0eaa6f4c26dae4790532a296822a6558b` (parent của 2add423). Bản đó cũng gọi `validateLiveLoyaltySelection` khi dùng điểm/voucher, dùng hàm tra khách đầy đủ. Sau đó tạo phiên, lưu đơn/món và gắn đơn vào phiên bằng các bước riêng, chỉ hiện QR sau khi đủ bill. Vì vậy tra lại khách và chờ lưu bill không phải do Pay2S mới thêm vào.

0.4.34 đã có nhánh combined checkout. 0.4.35/0.4.36 dùng một RPC giao dịch tạo phiên + đơn + món và giữ mã yêu cầu trên máy để phục hồi. Bản 0.4.36 trở lại ảnh VietQR. 0.4.37 giữ cấu trúc an toàn hiện tại, không trả về chuỗi lưu rời rạc trước Pay2S và không hiện QR trước khi lưu bill.

## Thay đổi

- QR ngân hàng dùng điểm/voucher: thay tra khách đầy đủ (4 đọc ban đầu, có thể thêm lịch sử) bằng 3 đọc song song: tài khoản loyalty, quy tắc và hồ sơ tối thiểu. Không tải thống kê đơn, đơn web/partner hay lịch sử điểm. Vẫn đọc mới trạng thái thành viên, điểm và voucher; lỗi đọc thì dừng, không dùng số dư cũ để tiếp tục. Tra khách bình thường, tiền mặt và MoMo giữ hàm cũ.
- Kiểm tra/làm mới đăng nhập chạy song song với kiểm tra quyền lợi và chuẩn bị bill. Token sắp hết hạn được kiểm tra lại trước khi gửi. Auth thất bại không tạo phiên.
- Chỉ riêng combined bank checkout: hai vị trí snapshot khách trong phiên/metadata đơn giữ bản gọn: tên/điện thoại/trạng thái thành viên, số dư, quy tắc và voucher đang chọn. Bỏ profile metadata, thống kê, lịch sử và danh sách voucher không dùng. Giữ nguyên totals, điểm đã chọn, món/tùy chọn, thẻ rung, shift, mã bill và thông tin tài khoản do server chốt. Giữ tên trường cũ để tương thích phục hồi.
- Thêm log số đo `[pos-qr-flow]`: quyền lợi, bản nháp, chuẩn bị, gọi phiên, lưu mã phục hồi và tổng. `[pos-qr-api]`: chờ auth, độ dài JSON theo ký tự, thời gian request và kết quả. Không log điện thoại, tài khoản, giỏ, token. Thời gian này là trước khi tải ảnh QR, không phải số đo ảnh đã hiện.

Không đổi ảnh VietQR, webhook, MB/SePay, luồng Kitchen/in bill, database/schema/RLS hay quy tắc tính điểm. Không thêm RPC mới, không bỏ xác thực hoặc kiểm tra số tiền/chống trùng. Quyền lợi vẫn được đọc trước request tạo phiên; chưa gộp việc đọc quyền lợi vào RPC server vì thay đổi đó cần một hợp đồng giao dịch riêng, không nên bỏ các kiểm tra hiện có để giảm số request.

## Kiểm tra và giới hạn

- 6 suite Jest, tổng 37 bài đạt qua lần chạy đầy đủ và các lần chạy lại suite có bổ sung test. Bao gồm quyền lợi mới, lỗi mạng, voucher cũ dùng metadata, giới hạn giảm giá kết hợp, phục hồi QR, auth chuẩn bị song song/auth hết hạn và đổi tem.
- Với fixture khách có lịch sử giả 40.000 ký tự, gói snapshot sau thu gọn nhỏ hơn 1/10 ban đầu; kết quả tính giảm điểm/voucher, totals và mã phục hồi giữ nguyên. Đây không phải phép đo tốc độ trên quầy.
- Lint source thay đổi, encoding và npm run build đạt. Android release phải được ký và đối chiếu bytecode trước khi bàn giao.
- Chưa cài lên thiết bị, chưa có phép đo trước/sau trên chính POS và chưa thử giao dịch tiền thật cho 0.4.37. Không cam kết số giây khi chưa đo.

## File

Cập nhật:

- `ghr-pos-mobile-native/src/features/pos/hooks/usePosComposer.js`
- `ghr-pos-mobile-native/src/services/pos/posCustomerService.js`
- `ghr-pos-mobile-native/src/services/pos/posPaymentSessionService.js`
- `ghr-pos-mobile-native/__tests__/posCombinedQrCheckout.test.js`
- `ghr-pos-mobile-native/android/app/build.gradle`

Tạo:

- `ghr-pos-mobile-native/src/services/pos/posPaymentSnapshotService.js`
- `ghr-pos-mobile-native/src/services/pos/posQrTimingService.js`
- `ghr-pos-mobile-native/__tests__/posPaymentOptimization.test.js`
- Báo cáo này; APK nằm ngoài Git.

## APK đã xác minh

`ghr-pos-mobile-native/releases/GHR-POS-0.4.37.apk`: versionName 0.4.37, versionCode **68**, package vn.ghr.posmobile, arm64-v8a/armeabi-v7a, 31.770.487 byte.

SHA-256: `09a8949ad40fb83bcdd3770db96620fcaf0dc5307ab4208ca9c09bcc8497cf46`.

Chữ ký SHA-256 `728d5843ae0c8883171fdae3fd65b6375810d27ed946297c5cee3a51b62224ea` khớp bản cũ. Bytecode trong APK khớp bundle hiện tại: `ab1f1c7b2b528ce8a52b761cfd67db98eec6ee07c1168acc784985e962e1a561`. Gradle release build thành công.

Chưa đổi metadata cập nhật tự động toàn hệ thống. Anh cài đè thử tại 30/4 trước; nếu upload qua Admin thì nhập mã Android **68**, không dùng 67 của bản 0.4.36. Thử bill không ưu đãi và bill có điểm/voucher, thử retry/đóng mở app, kiểm tra QR/Kitchen/bill. Anh tự thực hiện chuyển tiền thử. Không thử lại bằng QR của đơn đã hủy.
