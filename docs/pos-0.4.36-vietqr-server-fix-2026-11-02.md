# POS 0.4.36 — trở lại ảnh VietQR, sửa tạo phiên

## Nguyên nhân và khắc phục

Ảnh anh gửi có lỗi `Edge Function returned a non-2xx status code`, đơn 51.000đ. Log 20:08–20:09 xác nhận HTTP 500: `serviceClient.rpc(...).catch is not a function` tại `posQrCheckout.ts`. Supabase RPC trả query builder có `then`, không phải Promise có đầy đủ `.catch`. Test cũ dùng hàm async giả nên đã bỏ lọt lỗi này; lỗi là phần server vừa tối ưu, không phải bộ vẽ QR hay cấu hình MB.

Đổi sang `try { await rpc(...) } catch`. Giữ nguyên xác thực, RLS, một giao dịch lưu phiên/đơn/món, routing Pay2S và chống trùng. Edge `pos-payment-session-api` v48 ACTIVE, verify_jwt=true; đã đọc lại mã triển khai và xác nhận đúng bản sửa. Máy 0.4.35 nhận sửa server ngay, chưa cần APK mới.

Log thật sau sửa có request tạo phiên thành công 20:12:48: route 30ms, giao dịch 1799ms, tổng 1829ms. Bill `POS-20261102-200830` tạo đủ phiên/đơn 51.000đ rồi được hủy; phiên mới `POS-20261102-201308` 51.000đ tạo được và chờ thanh toán khi kiểm tra. Đây là bằng chứng server, chưa chứng minh QR hiện trên màn hình hay khách đã chuyển tiền.

Theo yêu cầu anh, bản 0.4.36 trở lại `buildPosQrImageUrl` và React Native Image cho QR ngân hàng. Chỉ hiện sau khi phiên/bill đã lưu; dùng snapshot tài khoản của phiên. MoMo vẫn QRCode cũ. Giữ bố cục ba cột, icon, không tìm kiếm, MB/Pay2S, phục hồi bill và QR in tại máy đã có. VietQR là cách tạo ảnh; Pay2S là bên thông báo giao dịch, hai phần khác nhau. Việc này không khắc phục độ trễ webhook Pay2S hay bổ sung Zalo.

## Kiểm tra

- 6 bài Node đạt, thêm bài sử dụng client Supabase thật với fetch giả kiểm tra RPC được gửi đúng một lần và chờ kết quả (không giả RPC bằng async function).
- 4 suite Jest, 21 bài đạt: tạo bill QR, phục hồi phiên, bản nháp, đổi tem. Lần đầu bị quyền ghi cache Windows; chạy lại với cache trong workspace đạt.
- Lint component và encoding đạt. Android Gradle release build thành công; Hermes production bundle, bytecode đóng trong APK khớp bản build.
- Website không thay đổi trong lần sửa này; build website gần nhất đã đạt ở commit hoàn tác 027ca09.

## APK

`ghr-pos-mobile-native/releases/GHR-POS-0.4.36.apk`, versionCode 67, package `vn.ghr.posmobile`, arm64-v8a và armeabi-v7a, 31,766,279 byte.

SHA-256: `6f1bd4dd3b879407d735739147d823de889cddc45c26a44da678b8eff7330ad8`.

Certificate SHA-256: `728d5843ae0c8883171fdae3fd65b6375810d27ed946297c5cee3a51b62224ea`, trùng bản cũ. Bytecode SHA-256: `3a55d1f81cc88d3234ca6e94515155f71226f67653b2c1408bd614fb9b698b85`.

Anh cài đè tại 30/4, không gỡ app, thử mở QR và đối chiếu tài khoản/số tiền/nội dung; anh tự chuyển thử và kiểm tra Kitchen/giấy. Chưa tự cài lên máy quầy, chưa thay metadata cập nhật APK toàn hệ thống.

## File

Cập nhật `supabase/functions/_shared/posQrCheckout.ts`, `scripts/pos-qr-checkout.test.mjs`, `ghr-pos-mobile-native/src/features/pos/components/QrPaymentModal.js`, `ghr-pos-mobile-native/android/app/build.gradle`. Tạo báo cáo này và APK ngoài Git. Không đổi schema, không sửa dữ liệu thanh toán thủ công.
