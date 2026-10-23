# Sửa smoke voucher và cấu hình lint ngày 22 tháng 10 năm 2026

Thực hiện trên workspace cloud `/workspace/weborder`. Đợt này xử lý các lỗi được ghi trong [báo cáo dọn mã nguồn](code-cleanup-2026-10-22.md).

## Nguyên nhân và thay đổi

Smoke voucher dùng dữ liệu tháng 7 và tháng 8 năm 2026 nhưng so hạn dùng theo đồng hồ thật. Khi chạy tháng 10, voucher tháng 8 bị loại đúng quy tắc nên kỳ vọng còn một voucher thất bại. Test nay cố định đồng hồ tại trưa ngày 20/08/2026 bằng mock Date của Node test runner; context tự khôi phục đồng hồ. Bổ sung kiểm tra voucher đã hết hạn, còn hiệu lực trong ngày cuối và hết hiệu lực ngày kế tiếp. Không đổi logic voucher trong ứng dụng.

117 lỗi lint ban đầu gồm thiếu globals của Web APIs, CommonJS, Metro, Jest và khai báo timer bị lặp. Cấu hình nay nhận diện các môi trường theo phạm vi file. Khai báo Jest rời rạc trong 27 test được gom vào cấu hình root và cấu hình native; bỏ chú thích timer lặp trong hook POS. Giữ nguyên no-undef và no-redeclare. Kiểm tra thử xác nhận biến nghiệp vụ không khai báo vẫn báo lỗi và jest không được coi là global trong source web.

## Kết quả

- npm run smoke: đạt toàn bộ loyalty, main flows, Supabase config, voucher và success payment.
- Smoke voucher: đạt thêm khi chạy với TZ=Asia/Ho_Chi_Minh và TZ=Pacific/Kiritimati.
- npm run lint: exit 0, không còn lỗi; còn 279 cảnh báo no-unused-vars. Nhiều cảnh báo ở import component JSX của ứng dụng phụ; cần phân biệt với biến thừa thật trước khi xóa.
- npm run check:encoding: đạt, quét 646 file source.
- git diff --check: đạt.
- Chưa chạy Jest native vì workspace chưa có node_modules của ứng dụng native; thay đổi ở test native chỉ bỏ chú thích khai báo globals, không đổi nội dung kiểm thử.
- Chưa commit/push hoặc triển khai production.

## Danh sách file thay đổi

- `eslint.config.js`: globals và môi trường lint theo phạm vi.
- `ghr-pos-mobile-native/.eslintrc.js`: khai báo môi trường Jest cho thư mục test khi lint độc lập.
- `ghr-pos-mobile-native/src/features/pos/hooks/usePosPagerSettings.js`: bỏ chú thích globals timer lặp.
- `scripts/smoke-checkout-voucher.mjs`: đồng hồ cố định và các ca kiểm tra hạn dùng.
- `docs/README.md`: liên kết báo cáo.
- `docs/maintenance/voucher-lint-fix-2026-10-22.md`: báo cáo này.

Các file sau chỉ bỏ chú thích globals Jest đã chuyển vào cấu hình:

- `ghr-pos-mobile-native/__tests__/posCategoryLayout.test.js`
- `ghr-pos-mobile-native/__tests__/posCustomerLookupPerformance.test.js`
- `ghr-pos-mobile-native/__tests__/posCustomerPhone.test.js`
- `ghr-pos-mobile-native/__tests__/posDeviceMode.test.js`
- `ghr-pos-mobile-native/__tests__/posHistoryDisplay.test.js`
- `ghr-pos-mobile-native/__tests__/posItemNoteEditor.test.js`
- `ghr-pos-mobile-native/__tests__/posLoyaltyCombinedCap.test.js`
- `ghr-pos-mobile-native/__tests__/posLoyaltyService.test.js`
- `ghr-pos-mobile-native/__tests__/posMenuVirtualization.test.js`
- `ghr-pos-mobile-native/__tests__/posOfflineAutoSync.test.js`
- `ghr-pos-mobile-native/__tests__/posOfflineSync.test.js`
- `ghr-pos-mobile-native/__tests__/posOperationalPerformance.test.js`
- `ghr-pos-mobile-native/__tests__/posOptionSelection.test.js`
- `ghr-pos-mobile-native/__tests__/posOrderWithoutPager.test.js`
- `ghr-pos-mobile-native/__tests__/posPagerSettings.test.js`
- `ghr-pos-mobile-native/__tests__/posPagerSettingsHook.test.js`
- `ghr-pos-mobile-native/__tests__/posPaymentRecovery.test.js`
- `ghr-pos-mobile-native/__tests__/posPendingQrStampRead.test.js`
- `ghr-pos-mobile-native/__tests__/posPhoneCheckout.test.js`
- `ghr-pos-mobile-native/__tests__/posPhoneHistory.test.js`
- `ghr-pos-mobile-native/__tests__/posPhoneOrderDetail.test.js`
- `ghr-pos-mobile-native/__tests__/posPhonePrintBundle.test.js`
- `ghr-pos-mobile-native/__tests__/posPhoneWorkspace.test.js`
- `ghr-pos-mobile-native/__tests__/posPointInputLimit.test.js`
- `ghr-pos-mobile-native/__tests__/posPrinterService.test.js`
- `ghr-pos-mobile-native/__tests__/posStampReceipt.test.js`
- `ghr-pos-mobile-native/__tests__/posStamps.test.js`
