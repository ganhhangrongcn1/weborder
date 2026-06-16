# GHR POS Mobile Native

React Native CLI app thuần cho POS mobile của Gánh Hàng Rong.

## Trạng thái hiện tại

- Không dùng Expo.
- Có Android/iOS native project từ React Native CLI.
- Có màn hình POS cơ bản: đăng nhập demo, mở ca, chọn món, bill, xác nhận tiền mặt, tạo đơn local mock.
- Service đang mock để app chạy trước; bước sau mới nối Supabase thật.

## Chạy app

```bash
npm install
npm run start
npm run android
```

## Cấu trúc

- `src/screens`: màn hình route-level.
- `src/features/pos`: UI + hook POS.
- `src/services`: service layer, sau này nối Supabase/native bridge.
- `src/shared`: helper POS dùng lại được.
- `src/utils`: format/helper chung.

## Việc tiếp theo

- Nối Supabase auth/profile/shift/product/order qua service.
- Thêm recent orders và kiểm tra thẻ rung đang bận.
- Thêm QR/SePay payment session.
- Thêm Android printer bridge.
