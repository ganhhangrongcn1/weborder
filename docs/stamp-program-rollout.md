# Chương trình tích tem — bàn giao 05/10/2026

## Trạng thái

Đã triển khai Supabase ngày 06/10/2026, migration máy chủ `20261006002739_stamp_program`; chương trình vẫn tắt. Kiểm thử transaction trên database thật đã đạt và hoàn tác toàn bộ dữ liệu thử. Chi tiết tại `docs/stamp-supabase-deployment-2026-10-06.md`. Web đã build; APK mới nhất 0.4.12 có một hàng 10 ô tem trên bill. Chưa phát hành web/APK lên kênh tải và chưa cài máy POS của quán.

## Quy tắc đã triển khai

- Số điện thoại Việt Nam chuẩn hóa 0 / +84. Mỗi số tối đa 1 tem/ngày theo giờ Việt Nam, dùng chung website, POS và đơn đối tác có số điện thoại hợp lệ.
- Chỉ đơn có số tiền cuối cùng lớn hơn 0 và đã hoàn tất; POS đã xác nhận thanh toán được tích ngay. Không đặt mức tiền tối thiểu. Không cộng đơn trước lúc bật; POS offline đồng bộ muộn xét cả thời điểm thanh toán gốc.
- Đủ 10 tem chọn 1 trong 3 món do quản trị cấu hình. Món cơ bản 0đ, số lượng 1, không topping; không thể sửa thành nhiều phần.
- Nhận tại quán. Tổng đơn 0đ chỉ xác nhận tại quầy; tổng cuối cùng >0 mới có thanh toán online theo cấu hình chi nhánh. POS 0đ không mở két hoặc tạo QR.
- Máy chủ giữ 10 tem cùng lúc tạo đơn và món; chốt tem khi hoàn tất/đã thanh toán POS. Hủy/hoàn tiền trả tem một lần. Tạo lại cùng mã đơn không giữ tem lần hai; không cho xóa cứng đơn có tem.
- Hủy đơn mua sẽ xét các đơn đủ điều kiện khác cùng ngày trước khi thu hồi tem. Số dư có thể âm khi hoàn tiền một đơn đã dùng tem; tem không được chuyển sang khách khác.
- Bill hiển thị số tem khả dụng hiện tại; in lại không tích thêm. Số trên bill in lại là số hiện tại, không phải ảnh chụp lịch sử tại ngày mua.
- Điểm theo hạng, sử dụng điểm và các ưu đãi khác giữ nguyên. Quà 3 đơn đối tác/tháng đã gỡ khỏi luồng dùng; dữ liệu lịch sử và RPC thống kê CRM giữ lại. Kiểm tra máy chủ không thấy trigger tự cấp quà tháng.

## Request tăng thêm riêng của tem

| Thao tác | Request |
| --- | --- |
| Mở Home | 1 RPC số dư/cấu hình |
| Từ Home sang Ưu đãi trong 60 giây | 1 RPC lịch sử, dùng lại số dư |
| Quay lại trong thời gian cache | 0 cho phần đã tải |
| Bấm xem thêm lịch sử | 1 RPC / 20 dòng |
| Gõ SĐT POS | Chỉ gửi khi đủ số hợp lệ và ngừng gõ 400ms; 1 RPC, có cache 60 giây |
| 20 lượt đọc đồng thời cùng tài khoản/SĐT | 1 RPC, 19 lượt dùng chung |
| Tích tem khi đơn đổi trạng thái | 0 request mới từ client; trigger xử lý trong giao dịch có sẵn |
| Tạo đơn đổi quà | 1 RPC ghi cả đơn + món + giữ tem, thay luồng ghi đơn/món rời |
| Lưu đơn POS có SĐT | 1 RPC đọc lại tem sau ghi, dùng chung kết quả cho bill; QR có lượt đọc khi tạo đơn chờ và khi xác nhận đã trả tiền |
| In bill website từ Kitchen | 1 RPC đọc số dư; lỗi đọc không ngăn in; mở cửa sổ in trước khi chờ request |
| In lại/print station POS | Tối đa 1 RPC đọc số dư, dùng cache khi còn hạn; không ghi tem |
| Mở/lưu cấu hình quản trị | 1 RPC đọc / 1 RPC lưu |

Không có polling hoặc subscription realtime mới cho tem. Không quét toàn bộ đơn trên trình duyệt. Các con số trên là phần request của tem, không phải tổng request của toàn bộ website/POS. Đọc tem có giới hạn 4 giây. Cache tách theo tài khoản và số điện thoại, xóa sau tạo đơn; số dư máy chủ luôn quyết định việc đổi quà.

## Kiểm tra đã hoàn thành

- Build React/Vite thành công, kiểm tra UTF-8 đạt; lint các file thay đổi đạt.
- 4 bộ kiểm thử hồi quy POS: 37 tests đạt (QR recovery, offline sync, loyalty cap, promotion channels).
- 5 tests tem POS đạt: cache/in-flight, tách phiên đăng nhập, bill không request thừa khi có kết quả, lỗi mạng không chặn in, món quà 0đ.
- SQL chạy trên PGlite 0.5.8: cùng ngày/cross-channel, chuẩn hóa +84, đơn trước ngày bật, offline cũ đồng bộ muộn, giữ/chốt/trả tem, retry, thiếu tem, lỗi món rollback nguyên giao dịch, chặn giao hàng/QR 0đ, quyền khách/admin, private schema, tắt chương trình, món theo chi nhánh/kênh, áp dụng SQL lặp lại. Migration được so sánh với đúng SQL đã kiểm thử.
- Trình duyệt dùng component thật và API giả trên localhost: Home → Ưu đãi ghi nhận đúng 2 RPC; lựa chọn món khác vẫn chỉ có 1 món quà 0đ. Kích thước 390px: không tràn ngang, tiếng Việt đúng.
- APK build thành công; package `vn.ghr.posmobile`, versionCode 42, versionName 0.4.11; arm64-v8a và armeabi-v7a. Chữ ký khớp bản 0.4.10.
- SHA-256 APK: `A9420864E22FF416474C22B194FE3763B98E1A357E5BB7AF074A333288FA120D`.

SQL kiểm thử dùng cấu trúc mô phỏng các bảng liên quan, chưa chứng minh tương tác với toàn bộ trigger đang chạy thật. Chưa xác nhận giấy in, thanh toán và thao tác trên thiết bị thật.

## Cách đưa vào sử dụng

1. Supabase đã triển khai riêng SQL tích tem vào dự án weboder ngày 06/10/2026; chương trình vẫn tắt. Không đẩy lại toàn bộ các migration khác trong workspace đang có thay đổi.
2. Phát hành website mới và cài APK 0.4.12 cho POS. Không cần đổi quy tắc điểm hạng.
3. Vào **Quản trị → Khuyến mãi → Tích tem**, chọn 3 món đang bán tại các chi nhánh cần áp dụng, lưu và bật. Mốc bắt đầu do máy chủ ghi ở lần bật đầu tiên.
4. Thử tại quầy bằng tài khoản kiểm thử: 0đ chỉ quầy; thêm món có tiền được QR; hủy QR trả tem; bấm đổi hai lần không cấp hai quà; xác nhận giấy in. Đơn đối tác phải có SĐT đầy đủ, không phải SĐT bị che.
5. Muốn ngừng chương trình, tắt tại cùng màn hình. Giữ lịch sử; các đơn đổi quà đã nhận trước lúc tắt vẫn được xử lý hoàn tất/hủy.

## Chạy lại kiểm thử SQL

Không thêm PGlite vào gói ứng dụng. Công cụ test riêng có thể cài bằng `npm.cmd install --prefix tmp/stamp-validation --no-save @electric-sql/pglite@0.5.8`, sau đó chạy `node scripts/stamp-program.test.mjs`.

## Giao diện kiểm thử với dữ liệu mẫu

![Thẻ tem trên màn hình 390px](../tmp/stamp-preview/stamp-rewards-mobile.jpg)

## File mới

- `docs/supabase-sql/stamp-program-schema.sql`
- `docs/supabase-sql/stamp-program-functions.sql`
- `docs/supabase-sql/stamp-program-orders.sql`
- `supabase/migrations/20261005085626_stamp_program.sql`
- `src/services/stampRequestCache.js`
- `src/services/stampProgramService.js`
- `src/services/repositories/stampRepository.js`
- `src/hooks/useStampProgram.js`
- `src/features/loyalty/components/StampCard.jsx`
- `src/styles/stamp-card.css`
- `src/pages/admin/promotions/StampProgramSettings.jsx`
- `ghr-pos-mobile-native/src/services/pos/posStampService.js`
- `ghr-pos-mobile-native/src/features/pos/components/PosStampPanel.js`
- `scripts/stamp-program.test.mjs`
- `ghr-pos-mobile-native/__tests__/posStamps.test.js`
- `docs/stamp-program-rollout.md`
- `ghr-pos-mobile-native/releases/GHR-POS-0.4.11.apk`

## File cập nhật

- `src/features/home/HomeView.jsx`
- `src/features/home/components/HomeFulfillmentCard.jsx`
- `src/features/loyalty/LoyaltyView.jsx`
- `src/features/loyalty/components/MemberLoyaltyView.jsx`
- `src/features/customer/product/CustomerShell.jsx`
- `src/hooks/useCart.js`
- `src/features/checkout/useCheckoutActions.js`
- `src/features/checkout/CheckoutView.jsx`
- `src/components/app/Cart.jsx`
- `src/pages/admin/promotions/PromotionTabsManager.jsx`
- `src/pages/admin/promotions/promotionConfig.js`
- `src/services/orderService.js`
- `src/services/repositories/coreSupabaseRepository.js`
- `src/services/repositories/orderRepository.js`
- `src/services/printerService.js`
- `ghr-pos-mobile-native/src/features/pos/components/PosCustomerModal.js`
- `ghr-pos-mobile-native/src/features/pos/components/PaymentBar.js`
- `ghr-pos-mobile-native/src/features/pos/hooks/usePosComposer.js`
- `ghr-pos-mobile-native/src/screens/PosHomeScreen.js`
- `ghr-pos-mobile-native/src/services/pos/posOrderService.js`
- `ghr-pos-mobile-native/src/services/pos/posPrinterService.js`
- `ghr-pos-mobile-native/src/services/pos/posPrintStationService.js`
- `ghr-pos-mobile-native/android/app/build.gradle`
- `src/features/kitchen/KitchenOrderCard.jsx`
- `src/features/kitchen/KitchenPage.jsx`
- `docs/gift-order-counting-source-of-truth-audit.md`

Các file tạm dưới tmp/stamp-preview chỉ dùng kiểm tra giao diện; không nằm trong bundle phát hành. Workspace có nhiều thay đổi khác từ trước, không gom chúng vào phạm vi báo cáo này. APK được build từ trạng thái workspace hiện tại.
