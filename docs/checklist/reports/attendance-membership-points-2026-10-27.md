# Tích điểm thành viên nhân viên — bản demo 27/10/2026

Theo yêu cầu chủ app, thêm tích điểm theo **mua hàng tại quán**, giữ chức năng chấm công. Màn đăng nhập có tiêu đề “Tích điểm thành viên”, mô tả ngắn dành cho nhân viên và lý do đăng nhập để xem điểm/giờ công cá nhân. Đổi nhãn không phải bằng chứng đáp ứng toàn bộ yêu cầu xét duyệt Zalo.

## Hành vi

- Tab Tích điểm: thẻ thành viên, số điểm, hóa đơn mẫu, lịch sử cộng/trừ điểm và đổi quà có xác nhận/hủy.
- Quy đổi minh họa 1.000đ = 1 điểm, làm tròn xuống trên từng hóa đơn. Chưa phải chính sách doanh nghiệp đã chốt.
- Ba hóa đơn cố định 45.000đ / 68.500đ / 120.000đ; điểm ban đầu 0. Chặn tích trùng từng hóa đơn, hóa đơn không có trong danh sách và truy cập ledger khác tài khoản.
- Hai quà minh họa 50/100 điểm, chặn đổi vượt số dư hoặc đổi lại cùng quà trong phiên. Không phát hành voucher hoặc đổi quà thật.
- Điểm chỉ giữ trong bộ nhớ của phiên đăng nhập, giữ khi chuyển tab; mất khi tải lại/đăng xuất. Không ghi DB, state chấm công, đơn hàng thật hoặc ledger điểm khách hàng của web chính.
- Tài khoản đăng nhập vẫn theo cơ chế hiện có; không tạo tài khoản, không đọc credentials. DEMO_ONLY vẫn true, không gửi Zalo API, không upload/gửi duyệt lại.

## Trước khi dùng thật

Cần chốt tỷ lệ quy đổi, quà/điều kiện và hết hạn; xác minh hóa đơn đã thanh toán/phạm vi nhân viên ở server; ledger có idempotency/hoàn điểm khi hủy-hoàn tiền; xác nhận đổi quà/quyền quản lý và lưu dữ liệu bền vững. Không cho client tự khai số tiền hoặc điểm thưởng. Bản hiện tại chưa tích hợp mua hàng thật.

## Kiểm tra Cloud

- `npm test --prefix attendance-miniapp`: 7 file test đạt.
- `node --test --test-isolation=none attendance-miniapp/tests/*.test.mjs`: 25/25 đạt, gồm 3 test mới cho làm tròn, trùng hóa đơn, giới hạn đổi quà và cô lập tài khoản.
- `npm run build --prefix attendance-miniapp`: đạt Vite 5.4.21, bundle hợp lệ 580264 byte.
- ESLint riêng source app và test mới: đạt. Encoding checker web chính: đạt 664 file; UTF-8 riêng file thay đổi: đạt. `git diff --check`: đạt.
- Chưa kiểm tra UI trên browser/thiết bị Zalo; chưa test đăng nhập hoặc giao dịch thật, chưa deploy. Không suy ra quyền/phát hành đã được duyệt.

## File thay đổi

- `attendance-miniapp/src/App.jsx`
- `attendance-miniapp/src/components/Login.jsx`
- `attendance-miniapp/src/components/Membership.jsx`
- `attendance-miniapp/src/components/NavigationIcon.jsx`
- `attendance-miniapp/src/components/PrivacyNotice.jsx`
- `attendance-miniapp/src/features/membership/useMemberPoints.js`
- `attendance-miniapp/src/services/memberPointsService.js`
- `attendance-miniapp/src/services/navigationService.js`
- `attendance-miniapp/src/styles.css`
- `attendance-miniapp/tests/member-points.test.mjs`
- `docs/checklist/reports/attendance-membership-points-2026-10-27.md`
- `docs/project-status.md`
