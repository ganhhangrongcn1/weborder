# Dọn cảnh báo unused vars ngày 22 tháng 10 năm 2026

Đã thực hiện trên workspace cloud `/workspace/weborder`. Lint toàn repository hiện đạt 0 lỗi, 0 cảnh báo, bao gồm JSX của web chính trước đây bị tắt kiểm tra.

## Cảnh báo sai và cấu hình phòng ngừa

ESLint core không tự coi tên component/icon trong JSX là biến đã dùng. Thêm eslint-plugin-react phiên bản cố định 7.37.5 và bật jsx-uses-vars, jsx-uses-react để nhận diện component, namespace component và icon qua props. Bỏ override tắt no-unused-vars cho src/**/*.jsx. Giữ nguyên các rule kiểm tra biến thừa, biến chưa khai báo và khai báo lặp.

Lệnh npm run lint nay có --max-warnings=0. Bộ npm run test:lint kiểm tra bốn nhóm file: web chính, checklist, inventory-app và React Native; xác nhận JSX hợp lệ không bị báo oan, import/biến thật sự không dùng vẫn bị cảnh báo, biến chưa khai báo vẫn bị lỗi.

## Mã thừa đã dọn

- Props và kết quả destructuring không được sử dụng ở POS, Home, Checkout, Tracking, CRM, dashboard, bếp và cài đặt.
- Bỏ binding lỗi catch không được đọc, giữ nguyên khối xử lý fallback.
- Giữ nguyên useState và giá trị khởi tạo; chỉ bỏ setter không được sử dụng để không đổi thứ tự hook hoặc cách lưu state.
- Bỏ các hàm nội bộ không được gọi và helper chỉ phục vụ chúng: giao diện CRM/biểu đồ cũ, đường map raw dishes cũ, helper runtime client và nhánh thu thập Marketing bằng browser cũ của worker.
- Giữ đường đọc order_items/partner_order_items và repair dữ liệu bếp đang dùng. Không gọi worker hoặc API đối tác trong lúc dọn.
- Helper tên khách POS bỏ tham số stats không dùng và cập nhật đúng caller; không đổi vị trí tham số còn lại ở các API công khai.

## Kiểm chứng

- npm run lint: đạt với --max-warnings=0.
- npm run build: đạt; vẫn có cảnh báo kích thước bundle của Vite, khác với cảnh báo unused-vars.
- npm run smoke: đạt toàn bộ.
- 8 file kiểm thử chạy đạt: eslint-jsx, checkout-combined-cap, checkout-order-persistence, kitchen-refresh-queue, admin-report-session-cache, partner-review-login-policy, partner-review-schedule-policy, promotion-channel-retirement. Dùng --experimental-vm-modules cho test cần SourceTextModule.
- Kiểm tra cú pháp JSX bằng esbuild cho 6 file native có thay đổi: đạt.
- So sánh hàm loyalty/payment native trước và sau với 14 bộ dữ liệu: kết quả giống nhau.
- Kiểm tra encoding trong build, liên kết tài liệu và git diff --check: đạt.
- Chưa chạy toàn bộ Jest/thiết bị native vì workspace chưa cài dependency riêng của ứng dụng native; kiểm tra cú pháp và so sánh hàm không thay thế kiểm thử thiết bị.
- Chưa commit/push hoặc triển khai production.

## Danh sách file thay đổi trong đợt này

- `eslint.config.js`
- `package.json`
- `package-lock.json`
- `scripts/eslint-jsx.test.mjs`
- `docs/README.md`
- `docs/maintenance/unused-vars-cleanup-2026-10-22.md`
- `ghr-pos-mobile-native/src/features/pos/components/PosMenuPanel.js`
- `ghr-pos-mobile-native/src/features/pos/hooks/usePosComposer.js`
- `ghr-pos-mobile-native/src/screens/PosHomeScreen.js`
- `ghr-pos-mobile-native/src/services/pos/posCustomerService.js`
- `ghr-pos-mobile-native/src/services/pos/posPaymentService.js`
- `ghr-pos-mobile-native/src/shared/pos/posLoyalty.js`
- `scripts/partner-review-worker.mjs`
- `src/components/customer/OptionModal.jsx`
- `src/features/checkout/components/CheckoutPricingSection.jsx`
- `src/features/home/HomeView.jsx`
- `src/features/home/components/HomeBranchPlannerModal.jsx`
- `src/features/kitchen/KitchenDishSummaryPanel.jsx`
- `src/features/kitchen/KitchenItemLabelPrintDialog.jsx`
- `src/features/kitchen/KitchenOrderCard.jsx`
- `src/features/kitchen/kitchenOrderGrouping.js`
- `src/features/loyalty/components/CheckinCard.jsx`
- `src/features/orders/TrackingView.jsx`
- `src/pages/BanhKemBanhTrangPage.jsx`
- `src/pages/admin/AdminOrdersCrmSection.jsx`
- `src/pages/admin/customers/CustomerCRM.jsx`
- `src/pages/admin/dashboard/AdminDashboardSection.jsx`
- `src/pages/admin/menu/AdminProductModal.jsx`
- `src/pages/admin/orders/OrderManager.jsx`
- `src/pages/admin/pages/AdminCakesPage.jsx`
- `src/pages/admin/promotions/StrikePriceTab.jsx`
- `src/pages/admin/state/useAdminOrderCrmState.js`
- `src/pages/admin/store/AppearanceBlockEditor.jsx`
- `src/pages/admin/store/AppearanceSettings.jsx`
- `src/pages/admin/store/BranchSettings.jsx`
- `src/pages/customer/qr/QrOrderEntryPage.jsx`
- `src/services/cakeService.js`
- `src/services/kitchenOrderService.js`
- `src/services/loyaltyService.js`
- `src/services/supabase/supabaseRuntimeClient.js`
