# POS 0.4.32 đã phát hành — 27/10/2026

Người dùng đã chốt phát hành sau thời gian tạm giữ để gom lỗi. Phần này thay thế trạng thái ON HOLD trong các ghi chú trước.

## Cloud và website

- PR #19 đã merge vào main: `c2a2a9dc0653def3c7d36d6a065b9324e744d647`.
- Vercel production `dpl_7F7LuNsqt16nc6ytm4qT8GX5yWtV` READY, đúng main commit; alias ganhhangrong.vn và www.ganhhangrong.vn.
- Runtime Android và hai function trên main khớp source đã build `848574fe5c20df1ff19ae1324ef6661491900229`; khác biệt sau source này chỉ là ghi chú/merge.
- MoMo webhook version 30 -> 31, SePay webhook 52 -> 53, đều ACTIVE. Giữ verify_jwt=false như bản đang chạy và giữ nguyên shared dependencies. Đối chiếu nguồn triển khai lại đầy đủ, chỉ thêm trường dữ liệu in đã duyệt; không thay đổi xác thực, xử lý tiền hoặc SQL/RLS.

## APK chính thức

- `ghr-pos-mobile-native/releases/GHR-POS-0.4.32.apk` và manifest cùng tên.
- Package `vn.ghr.posmobile`, versionName 0.4.32, versionCode 63, ABI arm64-v8a / armeabi-v7a.
- 31,199,463 bytes; SHA-256 `ece0685b89c91812b0af7c725d9a8b9eca458fc93da211a7deffc419a280c46d`.
- Chữ ký hợp lệ và cùng chứng thư APK 0.4.31: `728d5843ae0c8883171fdae3fd65b6375810d27ed946297c5cee3a51b62224ea`.
- Upload mới, không ghi đè bản cũ: `app-downloads/pos-printer/releases/63-0-4-32/GHR-POS-0.4.32.apk`.
- Tải lại toàn bộ APK từ URL công khai, xác nhận đúng size và SHA-256 rồi mới đổi `ghr_app_downloads`.
- Thông tin tải đã cập nhật version/code/file/hash/size/release notes, giữ update tùy chọn (`mandatory=false`), notes và các app khác. publishedAt `2026-10-27T07:50:41.253Z` (14:50:41 giờ Việt Nam).
- Browser xác nhận trang https://ganhhangrong.vn/download hiện 0.4.32 và link đúng thư mục 63-0-4-32.

## Chức năng và kiểm tra

- Badge đủ tem tại thẻ SĐT + highlight quyền lợi, nút 0đ riêng, chung mẫu bill MoMo/QR/tiền mặt website và âm báo theo trạng thái; toàn bộ nội dung và danh sách file nằm trong hai báo cáo phát triển liên quan.
- 15 Jest suites / 45 tests, lint runtime, build web/encoding, shared receipt tests và Postgres stamp simulator đã đạt trước phát hành. APK full build thành công, không bỏ task.
- Không tạo đơn thật, nhận/đổi điểm tem thật, retry lệnh in hoặc phát âm trên máy quán. Giấy/âm thật vẫn cần nghiệm thu sau khi cài APK.

## Sau khi cài

1. Cài cập nhật đè POS hiện tại, kiểm tra About hiện 0.4.32/code 63.
2. Tra SĐT đủ tem: badge hiện và chọn quà vào đúng bill; đổi sang SĐT khác không giữ quyền lợi cũ.
3. Đơn 0đ chỉ có Xác nhận đơn 0đ, không mở QR/két/ô nhập tiền.
4. Bill website MoMo, QR ngân hàng và tiền mặt cùng mẫu Admin; bill món không có QR tích lũy. Giữ tổng tiền, topping, ghi chú và tiền thối.
5. Đơn web chưa trả phát âm đặt trước; đã trả phát âm thanh toán, không báo hai lần. In lại không cộng điểm/tem thêm.

## File ghi chú liên quan

- `pos-0.4.32-stamp-zero-order-2026-10-27.md`
- `pos-website-receipt-payment-audio-2026-10-27.md`
