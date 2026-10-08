# Việt Sing — toàn menu 19.000đ tại POS, 09–11/10/2026

## Trạng thái
- Chương trình đã lưu trên Supabase, hiện **tắt**, chờ Việt Sing cập nhật POS 0.4.23 trở lên.
- Giới hạn đúng CN04 Việt Sing: `b108f000-02dc-4f04-8a97-996bbfc27fb8`.
- Toàn bộ món đang bán trên menu POS, gồm nước/combo và món thêm vào menu sau này. Giá món cơ bản đúng 19.000đ, kể cả món có giá gốc thấp hơn.
- Topping và lựa chọn có phụ thu tính riêng. Khách được đổi điểm theo hạn mức loyalty hiện có; giữ các quy tắc voucher đang có.
- Chạy cả ngày 09, 10, 11/10/2026 theo giờ trên thiết bị; ngoài khoảng ngày tự trở về giá thường khi chọn món mới.
- Không áp dụng web hay các ứng dụng giao đồ ăn. Không thay giá gốc trong bảng sản phẩm.
- Dữ liệu khuyến mãi riêng chi nhánh được lọc tại máy chủ: POS tài khoản chi nhánh khác không nhận được. Quản trị viên trung tâm vẫn quản lý được.
- Mục Toàn menu/chọn chi nhánh được phát hành trong bản cập nhật Admin này. Chỉ sử dụng sau khi website triển khai thành công.

## Anh cần làm
1. Cài APK GHR-POS-0.4.23 trên **tất cả máy/điện thoại POS dùng ở Việt Sing**, giữ ứng dụng và tài khoản hiện có.
2. Mở lại POS, đăng nhập đúng Việt Sing, xác nhận phiên bản 0.4.23.
3. Vào Admin → Ưu đãi bán hàng → Flash Sale → Việt Sing đồng giá 19.000đ, bật “Bật Flash sale” rồi nhấn “Lưu thay đổi”. Sau khi bật, làm mới menu hoặc mở lại POS để nhận cấu hình. Các chi nhánh khác không cần cài chỉ để ngăn chương trình này.
4. Khi chương trình đã bật và tới ngày chạy, kiểm tra một món 19.000đ, một món kèm topping, và một bill dùng điểm trước khi nhận đơn thật.

Không tự cài vào thiết bị, không tạo đơn thử/thu tiền/trừ điểm thật trong lượt xử lý này.

## Kiểm tra đã thực hiện
- 35 kiểm tra POS đạt: phân biệt chi nhánh/ngày/kênh, giữ thông tin chi nhánh khi tải catalog, đồng giá chính xác, topping/phần thêm, đổi điểm và giới hạn loyalty cũ.
- 5 kiểm tra cấu hình web đạt: Toàn menu và chi nhánh sống qua chuẩn hóa, chương trình chi nhánh chỉ POS, chương trình cũ giữ kênh.
- Kiểm tra mã nguồn thay đổi bằng lint đạt; React/Vite build và kiểm tra encoding đạt.
- Audit quyền đọc trên database với vai trò anon, tài khoản vận hành Việt Sing, chi nhánh 30/4 và admin đạt. Đây là mô phỏng quyền database, chưa phải kiểm tra trên máy POS tại quầy.
- So sánh trước/sau: 7 khuyến mãi cũ và các giá trị cấu hình cũ không đổi. Chỉ thêm một chương trình tắt.
- Script bật đã chạy thử trong giao dịch hoàn tác; kiểm tra sau thử xác nhận chương trình vẫn tắt và không phát hành thay đổi thử.
- Không thêm bảng hay hàm có quyền cao; thêm hai chính sách SELECT hạn chế cho khuyến mãi theo chi nhánh.
- APK release build thành công. Đã xác minh package `vn.ghr.posmobile`, phiên bản `0.4.23`, versionCode `54`, chữ ký khớp APK 0.4.22 và có mã lọc chi nhánh/đồng giá mới trong APK.
- File cài: `ghr-pos-mobile-native/releases/GHR-POS-0.4.23.apk`, 31.183.235 byte.
- SHA-256: `5DADDCC04FC1D3B1EE8235D87CE77134CD44427A90DA85B46E0FC1F2663AB276`.
- Chưa cài lên máy POS Việt Sing, chưa chứng minh giao dịch/topping/trừ điểm trên thiết bị thật.

## File cập nhật
- `src/pages/admin/promotions/FlashSaleTab.jsx`
- `src/pages/admin/promotions/PromotionTabsManager.jsx`
- `src/pages/admin/promotions/promotionTabUtils.js`
- `src/utils/pureHelpers.js`
- `ghr-pos-mobile-native/src/shared/pos/posPromotions.js`
- `ghr-pos-mobile-native/src/services/pos/posCatalogConfigService.js`
- `ghr-pos-mobile-native/src/features/pos/hooks/usePosComposer.js`
- `ghr-pos-mobile-native/android/app/build.gradle`

## File mới
- `src/pages/admin/promotions/PromotionBranchField.jsx`
- `ghr-pos-mobile-native/src/shared/pos/posPromotionScope.js`
- `ghr-pos-mobile-native/__tests__/posBranchPromotion.test.js`
- `scripts/flash-sale-scope.test.mjs`
- `supabase/migrations/20261008130557_pos_promotion_branch_read_scope.sql`
- `docs/supabase-sql/vietsing-19k-menu-2026-10.sql`
- `docs/supabase-sql/vietsing-19k-branch-read-audit.sql`
- `docs/supabase-sql/vietsing-19k-activate-after-pos-update.sql`
- `docs/supabase-sql/vietsing-19k-rollback.sql`
- `ghr-pos-mobile-native/releases/GHR-POS-0.4.23.apk`
- `docs/vietsing-19k-pos-2026-10.md` (tài liệu này)

## Backup và quay lại
Bản gốc tám file chỉnh sửa và snapshot cấu hình/khuyến mãi/quyền đọc nằm ở `tmp/vietsing-19k-before-20261008/`. Không chỉnh, stage hoặc push các thay đổi khác có sẵn trong workspace. APK tiếp nối mã POS hiện tại, giữ các thay đổi đang có từ các lượt trước.

Muốn hủy chương trình: dùng `docs/supabase-sql/vietsing-19k-rollback.sql` để xóa đúng chương trình này ở cả hai lớp; không khôi phục toàn bộ snapshot đè khuyến mãi mới của người khác. Giữ chính sách lọc chi nhánh để các chương trình riêng chi nhánh tiếp tục an toàn. Việc bật sau cập nhật có script riêng với kiểm tra đúng chi nhánh, giá và ngày; chưa chạy thực tế.
