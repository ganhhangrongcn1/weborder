# Gộp cập nhật POS vào main — 21/10/2026

## Phạm vi đã duyệt

Người dùng yêu cầu merge các cập nhật POS đã bàn giao vào main. Đã fetch GitHub trước khi sửa. Main tại thời điểm kiểm tra là `0f398ad462e38b73d5efc9ecc3590b546a6d55bc`, là tổ tiên của nhánh POS `1247f6f8db599e1bee85ec858800d531bb5f3f3c`; không có commit main bị bỏ lại.

Các PR đang xếp tầng: #8 (0.4.27) → #10 (0.4.28) → #11 (0.4.29). PR #11 được chuyển đích sang main để merge trọn chuỗi một lần bằng merge commit, giữ lịch sử các commit đã kiểm thử/build. PR #10 cũng được chuyển đích sang main để theo dõi phần phụ thuộc đã được bao gồm.

Nội dung gồm chế độ thu ngân, phân trang và đồng bộ đơn website độc lập, timeout/abort 10 giây, tải bù foreground, giảm tải ở nền, bill khách sau thanh toán và snapshot tem. Không đưa các thay đổi local chưa commit ở workspace chính vào nhánh này.

Migration `20261020122126_paid_website_receipt_stamps.sql` trong chuỗi đã được triển khai trước đó; chỉ đưa lịch sử file vào main, không chạy lại SQL hoặc gửi đơn/lệnh in. Không đổi khóa ký, guard release hay biến duyệt SHA trong lượt merge.

## Lỗi phát hiện khi rà soát trước merge

`PosPhoneMore` đã bỏ props đổi chế độ nhưng vẫn tham chiếu `modeDisabled`, `deviceMode`, `onChangeMode`, `modeError`. Renderer tái hiện `ReferenceError: modeDisabled is not defined` khi mở menu Khác; ESLint xác nhận 8 lỗi no-undef.

Đã bỏ phần chọn chế độ còn sót và các nút trùng. Menu hiển thị đúng một nút Tổng quan ca, một nút Máy in & thiết lập và nút Đổi ca / Đăng xuất; điều hướng bằng `onSelect('shift'/'settings')`, đăng xuất bằng callback hiện có. Không đổi route, thanh toán, tem hoặc in.

## Kiểm tra

- Test renderer mới thất bại trên source cũ, qua sau sửa; kiểm tra cả render, không trùng nút, điều hướng và đăng xuất.
- Toàn bộ native: **152/152 test, 35/35 suite qua**, timeout mặc định, không skip. Lượt đầu có test ghi chú món cũ quá 5 giây trên Windows; lượt chạy lại toàn suite qua trong 5,108 giây, không sửa test đó hoặc nâng timeout.
- ESLint component và test mới: qua.
- Kiểm tra encoding: qua (689 file web); UTF-8 của ba file sửa thêm được kiểm tra riêng. Website/Kitchen queue: **8/8 qua**.
- `src/`, `public/`, package và cấu hình Vite không khác main. Build web đã qua trên source `1247f6f`; không thay đổi web trong lượt sửa menu native này.

## Ranh giới APK

APK 0.4.29/code 60 đã giao được build từ **1247f6f**, workflow [39525762483](https://github.com/ganhhangrongcn1/weborder/actions/runs/39525762483). Nó có các sửa nhận đơn/timeout/lifecycle, nhưng **chưa có sửa menu Khác phát hiện trong lượt merge này**.

Không build hoặc ghi đè APK đã giao trong lượt merge. Sửa menu cần đi cùng lần phát hành APK tiếp theo, có version/code và SHA được duyệt tương ứng. Kiểm tra nhận đơn và in trên máy quán vẫn cần thực hiện; kết quả test/build không chứng minh vận hành thiết bị.

## Tệp sửa thêm trong lượt merge

- Cập nhật `ghr-pos-mobile-native/src/features/pos/components/PosPhoneNavigation.js`.
- Tạo `ghr-pos-mobile-native/__tests__/posPhoneMore.test.js`.
- Tạo `docs/pos-main-merge-20261021.md`.
