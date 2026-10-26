# Bàn giao mẫu bill, đồng bộ và dọn file tạm — 26/10/2026

## Trạng thái đã đối chiếu

- PR #14 đã merge: mẫu Admin chung, câu mời quét và hiển thị tem theo nội dung anh chốt. POS 0.4.31 bắt buộc dùng mẫu chung, giữ nghiệp vụ thanh toán/loyalty.
- PR #15 đã merge: sửa menu → URL → state và đăng ký route bảo vệ cho `/admin/settings/receipt-template`.
- Main đã triển khai: `20ea74e8a0375bee67813fb396515220e61f9eb6`. Vercel production `dpl_G7ZAQmFZxZPfvnjoM256CdYGoqWZ` READY, alias ganhhangrong.vn và www.ganhhangrong.vn đã xác nhận lại trong lần bàn giao này.
- Supabase `ghr_receipt_template` có cấu hình đã chốt, showStamps/showLoyalty bật, thu ngân ẩn mặc định, slogan và lời nhắc bếp để trống.
- Supabase `ghr_app_downloads` công bố POS 0.4.31/versionCode62. Hash APK lưu riêng và metadata máy chủ trùng `0c94d3630f488d0680abbe828d99f049080c6edec20497eddfec4618358f5e44`.
- Đường dẫn: https://ganhhangrong.vn/admin/settings/receipt-template và https://ganhhangrong.vn/download .

## Cách chỉnh và nhận cấu hình

- Chỉnh chữ/hiển thị trong Admin rồi bấm Lưu và áp dụng. POS 0.4.31 đọc app_configs khi in, cache 60 giây và dùng chung một yêu cầu đang chạy; không phải server đẩy ngay tức thì.
- Có mạng: lượt in tiếp theo sau thời gian cache sẽ lấy cấu hình mới. Không cần build APK cho những trường Admin đã hỗ trợ.
- Mất mạng: giữ cấu hình đã đọc thành công gần nhất trong phiên; khởi động lại offline thì dùng mẫu mặc định đã duyệt. Chưa có cache cấu hình bền qua khởi động lại.
- Thêm bố cục hoặc tính năng mà bộ in hiện tại chưa hỗ trợ thì mới cần thay mã/build APK.
- Điểm/tem do nghiệp vụ máy chủ xử lý; in/in lại chỉ trình bày, không cộng lại.

## Đã dọn trong lần này

- Đối chiếu hash APK trong output Gradle với bản phát hành lưu riêng trước khi xóa.
- Xóa đúng thư mục sinh tự động `ghr-pos-mobile-native/android/app/build`: 690 file, 759.716.856 byte. Đường dẫn tuyệt đối đã kiểm tra nằm trong workspace, không chứa file Git quản lý.
- Xóa 7 thư mục `ghr-bill-preview-*` cũ trong Temp, chỉ chứa preview.js/preview.css: 12.644.609 byte.
- Tổng: 772.361.465 byte (khoảng 772 MB thập phân / 736,6 MiB).
- Giữ preview đang chạy `ghr-bill-preview-LZZNKj`: đã so hash với JavaScript trả từ localhost:4180 để không dọn nhầm.
- Giữ toàn bộ source, cấu hình, dữ liệu, SQL, APK 0.4.30/0.4.31, manifest kiểm chứng, ảnh bằng chứng, thư mục attendance-miniapp và các bản sao/lưu trữ cũ. Giữ cache Gradle/CMake, node_modules và dist đang phục vụ preview; không đụng khóa ký bên ngoài project.

## Hồ sơ và giới hạn kiểm chứng

- Hồ sơ đã gom vào cùng nhánh cloud: `receipt-template-release-2026-10-26.md`, `admin-receipt-navigation-fix-2026-10-26.md`, báo cáo bàn giao này.
- Không chỉnh mã chạy, schema hoặc dữ liệu nghiệp vụ trong lần đồng bộ/dọn file này. Không build lại chỉ để tái tạo những output vừa dọn.
- Các kiểm tra build, điều hướng, mẫu in trực tiếp/cloud và APK đã có trong hồ sơ phát hành. Giấy in thực tế ở quán vẫn cần nghiệm thu sau khi cài bản mới; không coi build/deploy là đã kiểm chứng thiết bị.
