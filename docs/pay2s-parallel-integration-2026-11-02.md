# Tích hợp Pay2S song song SePay — 02/11/2026

## Phạm vi

Thêm Pay2S cho chuyển khoản QR website nhận tại quán, QR tại quầy và POS Android hiện có. Không thay đổi MoMo, tiền mặt hoặc các chi nhánh sang Pay2S. Đối chiếu `origin/main` và production Vercel cùng commit `a41693c0eaa6f4c26dae4790532a296822a6558b`; ba Edge Function thanh toán và hai helper đang chạy khớp source local trước khi sửa.

## Cách hoạt động

- Admin → Quản lý chi nhánh → cấu hình thanh toán: Pay2S mặc định **Tắt — giữ SePay**.
- Chế độ thử định tuyến các phiên QR mới theo danh sách số điện thoại thử. Danh sách lưu dạng SHA-256, không lưu số nguyên văn trong cấu hình chi nhánh. Khách khác vẫn SePay. Chế độ chính thức chỉ chọn sau nghiệm thu.
- Dùng đúng tài khoản ngân hàng đã cấu hình cho chi nhánh. Không đổi QR/ngân hàng trong đợt này. Phiên Pay2S lưu snapshot ngân hàng/tài khoản để kiểm tra webhook và dựng QR website.
- Việc chọn provider nằm ở server; POS hiện có bảo toàn provider trả về và xử lý trạng thái paid như các phiên QR khác. Không đổi source runtime Android, không phát hành APK mới. Cần xác nhận thực tế trên thiết bị trước chuyển chính thức.
- SePay bỏ qua phiên/đơn Pay2S. Pay2S chỉ nhận phiên provider=pay2s, đúng mã tham chiếu đầy đủ, ngân hàng, tài khoản, số tiền, hạn thanh toán và trạng thái đơn.
- RPC khóa phiên/đơn và lưu biên nhận giao dịch cùng thao tác thanh toán. Retry cùng giao dịch không chuyển sang đơn khác; giao dịch khác cho đơn đã trả tiền vào diện đối soát. Đơn hủy/hết hạn không mở lại.
- In bill website dùng helper hiện có, ID lệnh in Pay2S cố định theo đơn để chống in trùng. POS cashier giữ cơ chế chốt/in hiện có, webhook không tạo thêm bill thứ hai.
- Không gọi n8n/Zalo từ webhook Pay2S trong bản này. Automatic approval review từ chối bản có chuyển dữ liệu đơn/khách sang n8n vì chưa được ủy quyền cụ thể; bản triển khai sau đó đã bỏ hoàn toàn import, call và dependency thông báo ngoài. SePay vẫn dùng thông báo cũ.

## Cấu hình còn cần trước giao dịch thật

1. Chủ tài khoản liên kết ngân hàng trong Pay2S, tự thao tác đăng nhập/OTP. Tài khoản Pay2S được kiểm tra trước đó chưa có ngân hàng/webhook.
2. Tạo webhook nhận tiền (IN), HTTPS endpoint:
   `https://qjaklysckgzdfjthzkzu.supabase.co/functions/v1/pay2s-payment-webhook`
3. Lưu token webhook Pay2S vào secret server `PAY2S_WEBHOOK_TOKEN`. Không dùng partner/access/secret key của cổng thanh toán thay cho token này; không đưa token vào frontend, Git hay URL.
4. Cấu hình gửi tất cả tiền vào, không bắt buộc paymentCode/mẫu trích mã. Handler có thể đọc mã GHR/POS từ content. Nếu có paymentCode phải giữ nguyên mã phiên, không cắt ngắn.
5. Chọn một chi nhánh → chế độ thử → nhập số thử → Cập nhật danh sách thử → Lưu chi nhánh.
6. Tạo một đơn website nhận tại quán và một bill POS với đúng số thử. Kiểm tra QR, thanh toán, đúng đơn, gửi bếp, in bill, điểm/voucher; thử retry và đơn hết hạn. Khách ngoài danh sách vẫn SePay.
7. Chỉ sau nghiệm thu mới chuyển từng chi nhánh sang chính thức. Tắt Pay2S chỉ ảnh hưởng phiên mới; phiên đã tạo giữ provider ban đầu.

## Kiểm tra

- `npm run build`: đạt; kiểm tra UTF-8 đạt.
- Lint các JS/JSX thay đổi: đạt.
- Typecheck các Edge Function và shared module: đạt (shim Deno/npm chỉ dùng kiểm tra local, không commit).
- 10 kiểm tra Node: route mặc định, danh sách thử, snapshot, parsing, token, batch lỗi, retry, POS không in hai bill và SePay vẫn chốt phiên của mình.
- SQL regression trên Supabase: đạt; dữ liệu giả lập rollback toàn bộ. Có sai tiền/tài khoản/ngân hàng, outgoing, unmatched, hết hạn/hủy, phiên SePay, duplicate, xung đột payload, thanh toán website nguyên tử và quyền truy cập anon/authenticated.
- Security advisor: bảng receipt bật RLS, không có policy cho client là chủ đích; chỉ service_role có quyền đọc/ghi và gọi RPC.
- `smoke-order-success-payment.mjs` hiện lỗi assertion regex cũ trên Checkout (`fulfillmentType === "pickup" ? paymentMethod : "COD"`); Checkout đã dùng `resolveCheckoutPaymentMethod` từ trước và không sửa trong đợt này. Không thay code sản phẩm để khớp regex cũ.
- Chưa có giao dịch ngân hàng thật hoặc xác nhận in giấy trên thiết bị.

## Triển khai server

- Migration `pay2s_parallel_payments` đã áp dụng.
- `pay2s-payment-webhook` v2, verify_jwt=false, tự kiểm tra Bearer token và từ chối nếu chưa có secret.
- `sepay-pos-webhook` v54, giữ verify_jwt=false và secret hiện có.
- `pos-payment-session-api` v41, giữ verify_jwt=true.
- `qr-payment-session-api` v37, giữ verify_jwt=false và hợp đồng xác thực hiện có.
- Cả bốn chi nhánh vẫn Pay2S off. Không sửa app_configs hoặc thông tin ngân hàng thật.

## File cập nhật

- `src/pages/admin/store/BranchSettings.jsx`
- `src/services/qrPaymentService.js`
- `supabase/functions/pos-payment-session-api/index.ts`
- `supabase/functions/qr-payment-session-api/index.ts`
- `supabase/functions/sepay-pos-webhook/index.ts`
- `ghr-pos-mobile-native/__tests__/posPaymentRecovery.test.js`

## File mới

- `src/pages/admin/store/Pay2sSettings.jsx`
- `src/services/pay2sTestPhoneService.js`
- `supabase/functions/_shared/bankTransferPrint.ts`
- `supabase/functions/_shared/bankTransferRouting.js`
- `supabase/functions/_shared/bankTransferSettlement.ts`
- `supabase/functions/_shared/bankTransferUtils.ts`
- `supabase/functions/_shared/pay2sPayload.js`
- `supabase/functions/pay2s-payment-webhook/index.ts`
- `supabase/migrations/20261102020724_pay2s_parallel_payments.sql`
- `docs/supabase-sql/pay2s-parallel-payments.sql`
- `docs/supabase-sql/pay2s-parallel-payments-test.sql`
- `scripts/pay2s-payments.test.mjs`
- `scripts/pay2s-webhook.test.mjs`
- `docs/pay2s-parallel-integration-2026-11-02.md`

Tài liệu giao thức: https://developer.pay2s.vn/docs/webhook/tai-lieu-ky-thuat/
