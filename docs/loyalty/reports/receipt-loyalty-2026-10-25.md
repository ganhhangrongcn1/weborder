# QR bill và tích điểm khi đã thanh toán — 25/10/2026

## Phạm vi được duyệt

- Đơn đã thanh toán có SĐT hợp lệ tự nhận điểm; chưa có số nhận qua QR riêng, không OTP.
- Chung khóa sự kiện loyalty V2 cho tự động, QR, quầy và lần gọi lại.
- Trang `/nhan-diem/:token` độc lập, không thanh điều hướng/footer; đăng nhập về `/profile`.
- Banner thưởng đánh giá dẫn tới chương trình hiện có. Không thay quy tắc thưởng ảnh.
- Không cộng hàng loạt đơn cũ, không sửa tổng tiền, không trộn tích tem với điểm.

## Khảo sát

- Nhánh gốc `codex/cloud-source-20261023`, commit `d28901b`; đã fetch GitHub. Nhánh này có công việc riêng ngoài main; không merge/push main để tránh đưa các phần đó lên production.
- Checkpoint đầu `codex/receipt-loyalty-20261025` / `b048f05` đã push.
- Nhánh phát hành `codex/receipt-loyalty-release-20261025` được tạo từ `origin/main` (`8a53a05`), chỉ cherry-pick tính năng. Giữ route tuyển dụng và các bản sửa POS trên main. Không đưa công việc chấm công của nhánh gốc lên main.
- QR cũ là `/orders?phone=...`; khách nhận điểm đối tác qua tài khoản đúng số.
- Supabase hiện khóa sự kiện theo nguồn + id đơn + action + version và idempotency key.
- Đơn đối tác chỉ tính điểm trên tiền thực nhận; thiếu đối soát phải giữ chờ, không dùng tổng bill thay thế.
- Anh xác nhận bổ sung: đơn đối tác đã thanh toán khi vào hệ thống. Tự xét ngay khi ingest, không chờ in hay hoàn thành. Thiếu đối soát vẫn giữ chờ đúng căn cứ tiền hiện hành.

## Tiến độ

1. Đã khảo sát mã nguồn và schema/hàm production bằng truy vấn đọc. Chưa thay đổi production ở thời điểm tạo ghi chép này.
2. Đã xây cơ chế token, điều kiện thanh toán, trang riêng và đường in tương thích.
3. Build/encoding web đã đạt trên main mới nhất. SQL cuối trong một transaction rồi ROLLBACK đạt 12 tình huống: chưa trả; trả trước hoàn tất; không tăng điểm khi anon sửa số điểm trên đơn; chống nhận lại/in lại/hoàn tất; hủy thu hồi; đối tác tự cộng khi chuẩn bị; thiếu số/chờ đối soát rồi nhận QR; giữ trạng thái đã nhận sau hết hạn; chặn bill hết hạn; token không tồn tại; chặn tự động phát điểm khi anon chèn đơn đối tác; bill cũ đã nhận chỉ hiện số che, không cộng lại dù thiếu ledger V2.
4. Khách `anon` nhận được qua token trong transaction thử, không có quyền issue token/đọc bảng private. Đã xác nhận không còn đơn thử sau rollback.
5. POS Jest 3 bộ/15 kiểm tra đạt; kiểm tra gói QR + in lại + tem đạt. Bộ `scripts/receipt-loyalty.test.mjs` kiểm tra QR bill trả tiền, định danh canonical, phiếu làm món không tạo QR, giữ link server, trạng thái đã nhận/hủy/chờ đối soát, banner và link tài khoản đạt.
6. Đã xem UI local bằng trình duyệt (bản build), trang độc lập không footer, banner theo ảnh. QR nhạy cảm được tạo bằng thư viện tại chỗ, không gửi token tới dịch vụ tạo ảnh ngoài; bỏ token khỏi thống kê lượt truy cập.
   - Lint toàn kho đã chạy nhưng hủy do cấu hình hiện tại quét cả các bản sao/cache và dự án lồng nhau. Không coi là full-lint pass. Lint riêng các file web/JS POS thay đổi đã đạt; không sửa cấu hình lint ngoài phạm vi.
7. Cơ chế mới có công tắc `receipt_private.activation.enabled`, mặc định tắt khi cài migration. Chỉ bật sau khi web production và đường in sẵn sàng. Không yêu cầu OTP và không cấp quyền đăng nhập từ QR.
   - Kiểm tra RLS hiện hữu phát hiện bảng đơn có quyền ghi runtime rộng. Không thay toàn bộ RLS; trigger mới kiểm tra nguồn staff/service tin cậy và chốt số điểm, căn cứ tiền, rule, số nhận vào bảng private. Endpoint claim không tin số điểm/recipient được sửa trực tiếp trên bảng đơn.
8. APK cuối đã build thành công: `ghr-pos-mobile-native/releases/GHR-POS-0.4.30.apk`, package `vn.ghr.posmobile`, versionCode 61; ABI arm64-v8a/armeabi-v7a. Chữ ký SHA-256 `728d5843ae0c8883171fdae3fd65b6375810d27ed946297c5cee3a51b62224ea`. APK SHA-256 `B23B2EC72F7F3331909FBF62D96D14F7ECA3CF2CAB80981ACB164780261E6FC0`. Bản đóng gói thử đầu giữ riêng ở `GHR-POS-0.4.30-candidate-first.apk`; không dùng bản candidate để cài.

## Vận hành và tương thích

- Máy POS cũ vẫn in QR theo số; cần cài APK mới để in QR riêng bill. Không được coi build APK là đã cài tại quán.
- Luồng bán hàng/in vẫn chạy nếu dịch vụ link lỗi; giới hạn chờ link 5 giây, UI nhận điểm 10 giây. Bảng private `failures` giữ lỗi tự động để đối soát; không hiển thị token/SĐT ra log công khai.
- Gói in `qr_order_bundle`: phiếu làm món không có QR thưởng; bill khách thứ hai giữ `footerQrUrl` từ máy chủ.
- Bỏ nút khách bấm nhận điểm đối tác tại `/orders`; giữ RPC cũ cho client cũ và công cụ điều chỉnh của nhân viên. Khóa sự kiện vẫn chung.
- Nhập nhầm số sau khi nhận cần nhân viên đối soát, điều chỉnh qua công cụ hiện có có ghi lịch sử; khách không tự chuyển điểm bằng QR. Không thay thông tin giao hàng hoặc gắn tài khoản đăng nhập khi nhận điểm.
- Bill cũ không có token vẫn mở tra cứu theo SĐT; in lại bill chính thức có thể tạo token, không cộng trùng. Không tự quét/cộng hàng loạt đơn lịch sử.
- Trường hợp thu hồi gặp lỗi nghiệp vụ FIFO/điểm đã dùng phải đối soát từ `receipt_private.failures`; không xóa lịch sử ledger hay tự sửa số dư.

## Các file trong tính năng

- Mới: `src/pages/ReceiptLoyaltyPage.jsx`, `src/hooks/useReceiptLoyalty.js`, `src/services/receiptLoyaltyService.js`, `src/services/repositories/receiptLoyaltyRepository.js`, `src/styles/receipt-loyalty.css`.
- Mới: `docs/supabase-sql/receipt-loyalty-paid-claim.sql`, `supabase/migrations/20261025022036_receipt_loyalty_paid_claim.sql`, `scripts/receipt-loyalty.test.mjs`, `scripts/receipt-loyalty-rollback-test.sql`, báo cáo này.
- Cập nhật: `src/app/routes.jsx`, `src/features/orders/TrackingView.jsx`, `src/hooks/useSiteVisitTracking.js`, `src/services/printerService.js`, `scripts/stamp-print-station.test.mjs`.
- Cập nhật: `ghr-pos-mobile-native/src/services/pos/posPrinterService.js`, `ghr-pos-mobile-native/src/services/pos/posPrintStationService.js`, `ghr-pos-mobile-native/android/app/build.gradle`.

## Kiểm tra bắt buộc trước kích hoạt

- Sai token; bill chưa trả; bill hủy/hoàn tiền; hết hạn; thiếu đối soát.
- Nhận lần hai bằng số khác, tự động rồi QR, quầy rồi QR, hoàn tất sau thanh toán, in lại.
- Không lộ SĐT đầy đủ, địa chỉ, lịch sử hoặc token qua thống kê truy cập.
- Có ghi nhận lỗi để vận hành xử lý; lỗi loyalty không được làm hỏng luồng bán hàng.
- Build/encoding/lint và kiểm tra UI local. Tách rõ kiểm tra phần mềm, deploy và giấy in thực tế.

## Triển khai

### Điều chỉnh theo phản hồi giao diện và kiểm tra tem

- Bỏ khối giới thiệu dài bên trái, giữ tên thương hiệu nhỏ; căn giữa khung voucher, thêm mép răng cưa và hai khuyết ở đường xé. Bỏ dòng hỗ trợ nhỏ dưới cùng theo ảnh anh đánh dấu.
- Đọc lại hàm tem production: nguồn tem gắn số điện thoại và ngày mua, tối đa 1 tem/SĐT/ngày. Hàm đối tác có nhánh giữ nguyên tem khi khách đã có nguồn tem xác nhận nhận điểm cùng số.
- Khoảng trống cần xử lý trước kích hoạt: claim QR không OTP với số mới chưa được bảo đảm tạo nguồn tem, vì trigger tem chỉ ghi khi actor là operator. Không coi kiểm tra điểm đã đạt là bằng chứng đã nối đủ tem. Cần bổ sung đường nhận tem tin cậy trong cùng giao dịch nhận QR, giữ nguyên hạn mức/ngày mua và chặn trùng; chưa tự sửa quy tắc tem trong lượt chỉnh UI này.
- Production chưa thay đổi; các sửa UI này không sửa hàm tem hoặc APK. Cần kiểm tra riêng cả điểm + tem trước kích hoạt.

- PR: https://github.com/ganhhangrongcn1/weborder/pull/12. Nhánh phát hành chỉ gồm 18 file của tính năng.
- Chưa merge main, chưa cài migration hay kích hoạt production. Truy vấn cuối xác nhận schema production chưa có `receipt_private` và không còn đơn thử.
- API Vercel từ chối `target=preview`. Lượt tạo preview không có target bị auto-review chặn vì có nguy cơ triển khai production chưa được duyệt. Không thử bypass, không tự chuyển thành production. Cần anh duyệt rõ triển khai web production + Supabase trước bước này.
- APK cần cài lên máy quán sau khi web/backend đã sẵn sàng. Giấy in thật và hành vi tại quán chưa được xác nhận.
