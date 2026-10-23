# Báo cáo dọn mã nguồn ngày 22 tháng 10 năm 2026

## Kết quả

Thực hiện trong workspace cloud `/workspace/weborder`; chưa commit/push hoặc triển khai production.

Gỡ 18 module không có nơi gọi trong mã nguồn được Git quản lý và 3 khai báo nội bộ không dùng trong OrderManager, tổng cộng 1.013 dòng mã nguồn. Không đổi luồng đang render, tên route, API, schema, dữ liệu hoặc migration. Các bản cũ vẫn truy hồi được từ Git HEAD trước khi dọn.

## Căn cứ

- Lần theo import từ src/main.jsx qua App, routes và các feature; kết quả không reachable chỉ dùng để lập danh sách kiểm tra.
- Đọc các module ứng viên, tìm tên component/hook và đường dẫn trên source, ứng dụng phụ, script, test và cấu hình.
- Trước khi xóa, kiểm tra lại mọi tham chiếu đường dẫn tương đối trong file JS/JSX/TS/TSX/MJS/CJS/JSON/HTML được Git quản lý; không có module bên ngoài nhóm xóa trỏ tới nhóm này.
- App dùng src/app/routes.jsx; AppRouters cũ không có caller.
- OrderManager chỉ render OrderDetailPanelV2. Xóa OrderDetailPanel, OrderQuickActions và getPointStatusText không còn được gọi; giữ nguyên phần xử lý đang dùng.
- AdminStorePage chuyển cấu hình ship qua BranchSettings; ShippingSettings độc lập không có caller.
- Hook báo đơn bếp cũ không được import. Không xóa âm thanh hoặc thay đổi KitchenPage.

## File đã xóa

| File | Số dòng |
| --- | ---: |
| `src/components/CartItem.jsx` | 30 |
| `src/components/Header.jsx` | 29 |
| `src/components/PromoCard.jsx` | 21 |
| `src/components/app/LoadingState.jsx` | 8 |
| `src/components/app/ProductCardGrid.jsx` | 11 |
| `src/features/account/components/AccountNoticeModal.jsx` | 34 |
| `src/features/app/AppRouters.jsx` | 9 |
| `src/features/menu/components/MenuAddonSection.jsx` | 46 |
| `src/features/menu/components/ToppingMenuCard.jsx` | 26 |
| `src/hooks/useKitchenNewOrderAlert.js` | 232 |
| `src/pages/admin/orders/AdminOrderDetailModal.jsx` | 84 |
| `src/pages/admin/promotions/AdminSmartPromotionCard.jsx` | 70 |
| `src/pages/admin/promotions/PromotionGuideModal.jsx` | 22 |
| `src/pages/admin/store/ShippingSettings.jsx` | 43 |
| `src/pages/customer/account/SettingsToggle.jsx` | 13 |
| `src/pages/customer/home/HomeCategorySection.jsx` | 37 |
| `src/pages/customer/home/HomeFeaturedProducts.jsx` | 23 |
| `src/pages/customer/home/HomePromoCards.jsx` | 23 |

## File đã sửa trong đợt này

- `src/pages/admin/orders/OrderManager.jsx`: bỏ 252 dòng khai báo cũ không được gọi.
- `scripts/smoke-main-flows.mjs`: kiểm tra class sidebar chấp nhận trạng thái mobile; kiểm tra nhánh dashboard theo wrapper nhiều chi nhánh hiện tại, giữ kiểm tra UUID xuống RPC.
- `AGENTS.md`: bỏ đề xuất dọn AppRouters đã thực hiện.
- `docs/README.md`: liên kết báo cáo này.
- `docs/maintenance/code-cleanup-2026-10-22.md`: báo cáo này.

## Giữ lại có chủ đích

- CSS có tên legacy đang được import: tên file không chứng minh logic đã chết.
- CorrectiveActionsPanel, hook và service khắc phục giám sát: cụm nghiệp vụ riêng chưa nối vào entry web, chưa đủ căn cứ coi là tính năng đã bỏ.
- popularProductService, keyedReadCache và các helper có kiểm thử riêng: không xóa chỉ vì không reachable từ entry chính.
- profileBranchService, ví dụ CRUD Supabase và README liên quan: còn hợp đồng/tài liệu sử dụng.
- FlaticonCredit: giữ thông tin ghi công tài nguyên cho tới khi kiểm kê tài nguyên và nơi hiển thị credit.
- RPC cũ, migration, lớp tương thích dữ liệu và ứng dụng POS/checklist/kho độc lập: chưa xóa; caller ngoài web cần kiểm kê riêng.

## Kiểm chứng

- npm run build: đạt, còn cảnh báo chunk lớn hơn 500 kB.
- Lint riêng OrderManager và smoke-main-flows: đạt.
- admin-order-snapshot-cache, order-item-pages, checkout-combined-cap: đạt.
- checkout-order-persistence: đạt khi chạy Node với --experimental-vm-modules; lần đầu thiếu cờ nên không nạp được SourceTextModule.
- Smoke loyalty, main flows, Supabase config và success payment (cash, SePay/MoMo): đạt.
- npm run smoke dừng ở smoke-checkout-voucher.mjs dòng 89: kỳ vọng 1, nhận 0. Đã chạy cùng test trên bản Git HEAD chưa sửa trong thư mục tạm và tái hiện cùng lỗi; chưa sửa quy tắc voucher trong đợt này.
- Lint toàn repo: 117 lỗi, 279 cảnh báo ngoài các file code vừa sửa; không coi lint tổng là đạt.
- Build có kiểm tra encoding; tài liệu được kiểm tra liên kết nội bộ riêng.

Không kiểm thử thao tác trên thiết bị POS, trình duyệt đăng nhập hoặc database production trong đợt dọn này. Không khẳng định toàn repo đã hết code thừa; các ứng viên chưa đủ căn cứ được liệt kê để đối chiếu tiếp.
