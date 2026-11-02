# Tích hợp Pay2S song song SePay — 02/11/2026

## Đã tiếp tục, chờ thử giao dịch thật — 02/11/2026

- Cập nhật mới nhất theo yêu cầu người dùng: **chuyển phạm vi thử sang Đường 30/4 (`branches.id=48`)**, cùng tài khoản MB và danh sách một số thử; Thích Quảng Đức (`id=47`) đã tắt Pay2S. Chỉ phiên mới ở 30/4 của số thử dùng Pay2S; phiên cũ giữ nguyên provider. Các mô tả bật thử Thích Quảng Đức bên dưới là lịch sử trước lần chuyển này.
- Người dùng đã liên kết MB thành công, sau đó xác nhận cho tạo webhook tiền vào và lưu token trên server GHR để thử riêng. Pay2S hiển thị tài khoản MB hộ kinh doanh đang hoạt động; QR do Pay2S tạo dùng cùng tài khoản liên kết, không thấy số VA khác trong màn hình đã kiểm tra.
- Đã tạo webhook ID `3760`, chỉ nhận tiền vào, không giới hạn mẫu mã thanh toán, gửi về endpoint GHR bên dưới. Token riêng được lưu vào Supabase secret `PAY2S_WEBHOOK_TOKEN`; không lưu token hoặc số tài khoản vào tài liệu/Git. File trung chuyển token tạm đã xóa sau khi lưu và kiểm tra.
- Kiểm tra HTTP thật: token sai trả `401 unauthorized`; token đúng với danh sách giao dịch rỗng trả `400 invalid_transactions`. Đây là bằng chứng xác thực đã cấu hình, chưa chứng minh Pay2S đã chuyển một giao dịch ngân hàng thật.
- Chỉ chi nhánh Thích Quảng Đức (`branches.id=47`) ở `pay2sMode=test`, giữ nguyên danh sách hash số thử đã chuẩn bị. Tài khoản MB riêng được đối chiếu QR Pay2S và lưu vào cấu hình chi nhánh; provider/tài khoản SePay cũ giữ nguyên. Ba chi nhánh còn lại vẫn off; khách ngoài danh sách thử tiếp tục SePay.
- Chạy lại 13 kiểm tra Node về routing, snapshot QR website/POS, webhook và SePay: đạt. Chưa có receipt Pay2S thật tại thời điểm cập nhật. Chờ người dùng tạo đơn website thử, đối chiếu QR trước khi người dùng tự chuyển tiền, sau đó kiểm tra thanh toán/bếp/in/điểm; POS cần cài APK thử trước khi nghiệm thu trên thiết bị.
- Không bật chính thức và không thay bản POS cập nhật chung. Không bật gửi thông báo Pay2S qua n8n/Zalo.

## Lịch sử tạm dừng trước khi MB liên kết thành công — 02/11/2026

- Người dùng yêu cầu dừng tại đây, đồng bộ Cloud và ghi lại tiến trình để tiếp tục vào dịp khác. Không tiếp tục liên kết ngân hàng, gửi form, tạo webhook, bật thử hay chuyển provider cho đến khi người dùng yêu cầu làm tiếp.
- Người dùng phỏng đoán hồ sơ hộ kinh doanh chưa được MB xác nhận. Đây **chưa phải nguyên nhân đã được MB/Pay2S xác nhận**; bằng chứng hiện có chỉ là lỗi “Record is not exist” khi liên kết MB ở chế độ Hộ kinh doanh/Doanh nghiệp.
- Đã đồng bộ source lên `main`, triển khai website/Supabase và lưu APK thử 0.4.33 đã xác minh chữ ký, phiên bản và bytecode. Bản POS cập nhật chung chưa đổi; chưa cài/thử thật trên thiết bị, chưa giao dịch ngân hàng thật hoặc nghiệm thu in giấy.
- Tại thời điểm ghi nhận tạm dừng: kiểm tra Cloud cho thấy **0/4 chi nhánh bật Pay2S**. SePay và tài khoản Sacombank hiện có được giữ nguyên; cấu hình MB/số thử tại Thích Quảng Đức chỉ ở trạng thái chuẩn bị.
- Điểm tiếp tục: nhận kết quả xác minh hồ sơ/hỗ trợ từ MB/Pay2S → hoàn tất liên kết MB và lấy tài khoản/VA đúng → tạo webhook IN và lưu token server → cài APK lên một máy thử → chỉ bật chế độ thử cho số đã chuẩn bị → thử website/POS, bếp/in bill và đối soát trùng/hết hạn. Chỉ chuyển chính thức sau khi người dùng chấp thuận kết quả thử.
- Tài liệu này là điểm bàn giao chính; đường dẫn APK, checksum, trạng thái triển khai, kiểm tra và toàn bộ file thay đổi nằm ở các mục bên dưới.

## Phạm vi

Thêm Pay2S cho chuyển khoản QR website nhận tại quán, QR tại quầy và POS Android hiện có. Không thay đổi MoMo, tiền mặt hoặc các chi nhánh sang Pay2S. Đối chiếu `origin/main` và production Vercel cùng commit `a41693c0eaa6f4c26dae4790532a296822a6558b`; ba Edge Function thanh toán và hai helper đang chạy khớp source local trước khi sửa.

## Cách hoạt động

- Admin → Quản lý chi nhánh → cấu hình thanh toán: Pay2S mặc định **Tắt — giữ SePay**.
- Chế độ thử định tuyến các phiên QR mới theo danh sách số điện thoại thử. Danh sách lưu dạng SHA-256, không lưu số nguyên văn trong cấu hình chi nhánh. Khách khác vẫn SePay. Chế độ chính thức chỉ chọn sau nghiệm thu.
- Người dùng chọn MB Bank sau khi triển khai phần đầu. Đối chiếu Cloud: QR SePay cả bốn chi nhánh đang dùng Sacombank. Vì vậy Pay2S có ngân hàng/số tài khoản/tên chủ riêng, không thay các ô tài khoản SePay. Phiên Pay2S lưu snapshot đầy đủ để kiểm tra webhook và dựng QR website/POS/in phiếu QR.
- Việc chọn provider nằm ở server. POS **0.4.33 / code 64** thêm hiển thị/in QR theo snapshot tài khoản của phiên; cần cài APK mới khi dùng MB khác ngân hàng SePay. Server chặn tạo/đọc phiên Pay2S từ POS không báo khả năng hỗ trợ snapshot; danh sách QR không trả phiên Pay2S cho POS cũ. SePay trên POS cũ tiếp tục hoạt động.
- SePay bỏ qua phiên/đơn Pay2S. Pay2S chỉ nhận phiên provider=pay2s, đúng mã tham chiếu đầy đủ, ngân hàng, tài khoản, số tiền, hạn thanh toán và trạng thái đơn.
- RPC khóa phiên/đơn và lưu biên nhận giao dịch cùng thao tác thanh toán. Retry cùng giao dịch không chuyển sang đơn khác; giao dịch khác cho đơn đã trả tiền vào diện đối soát. Đơn hủy/hết hạn không mở lại.
- In bill website dùng helper hiện có, ID lệnh in Pay2S cố định theo đơn để chống in trùng. POS cashier giữ cơ chế chốt/in hiện có, webhook không tạo thêm bill thứ hai.
- Không gọi n8n/Zalo từ webhook Pay2S trong bản này. Automatic approval review từ chối bản có chuyển dữ liệu đơn/khách sang n8n vì chưa được ủy quyền cụ thể; bản triển khai sau đó đã bỏ hoàn toàn import, call và dependency thông báo ngoài. SePay vẫn dùng thông báo cũ.

## Cấu hình còn cần trước giao dịch thật

1. Chủ tài khoản liên kết MB trong Pay2S, tự nhập thông tin và chấp thuận cấp quyền đọc giao dịch/đăng nhập/OTP. Đã mở form `https://pay2s.vn/client/add-bank?bank=MBB`; tại lần kiểm tra chưa có ngân hàng liên kết. Form OpenAPI lưu ý giao dịch phải qua tài khoản ảo VA được cấp sau khi thêm thành công.
2. Tạo webhook nhận tiền (IN), HTTPS endpoint:
   `https://qjaklysckgzdfjthzkzu.supabase.co/functions/v1/pay2s-payment-webhook`
3. Lưu token webhook Pay2S vào secret server `PAY2S_WEBHOOK_TOKEN`. Không dùng partner/access/secret key của cổng thanh toán thay cho token này; không đưa token vào frontend, Git hay URL.
4. Cấu hình gửi tất cả tiền vào, không bắt buộc paymentCode/mẫu trích mã. Handler có thể đọc mã GHR/POS từ content. Nếu có paymentCode phải giữ nguyên mã phiên, không cắt ngắn.
5. Cài APK hỗ trợ tài khoản Pay2S riêng. Chọn một chi nhánh → ngân hàng MB, số VA/tài khoản Pay2S, tên chủ tài khoản → chế độ thử → nhập số thử → Cập nhật danh sách thử → Lưu chi nhánh. Đã chuẩn bị hash số thử người dùng cung cấp tại Thích Quảng Đức, ngân hàng Pay2S MB và mode=off; chưa điền số nhận tiền vì chờ liên kết, chưa bật thử. Sacombank SePay giữ nguyên.
6. Tạo một đơn website nhận tại quán và một bill POS với đúng số thử. Kiểm tra QR, thanh toán, đúng đơn, gửi bếp, in bill, điểm/voucher; thử retry và đơn hết hạn. Khách ngoài danh sách vẫn SePay.
7. Chỉ sau nghiệm thu mới chuyển từng chi nhánh sang chính thức. Tắt Pay2S chỉ ảnh hưởng phiên mới; phiên đã tạo giữ provider ban đầu.

### Trạng thái liên kết MB hộ kinh doanh

Người dùng xác nhận tài khoản đứng tên hộ kinh doanh và đã tự điền form MB ở tab Hộ kinh doanh/Doanh nghiệp. Form trả lỗi chung **“Record is not exist”** trước bước OTP/liên kết thành công. Chưa xác định trường nào không khớp hoặc nguyên nhân phía MB/Pay2S. Không đổi sang loại tài khoản cá nhân, không tự gửi lại dữ liệu hay bấm chấp thuận quyền truy cập. Trên màn hình người dùng đã soạn yêu cầu hỗ trợ; cần Pay2S tra log hoặc xác nhận điều kiện MB hộ kinh doanh. Không ghi số tài khoản, MST/CCCD hoặc số điện thoại trên form vào repo.

## Kiểm tra

- `npm run build`: đạt; kiểm tra UTF-8 đạt.
- Lint các JS/JSX thay đổi: đạt.
- Typecheck các Edge Function và shared module: đạt (shim Deno/npm chỉ dùng kiểm tra local, không commit).
- 13 kiểm tra Node: route mặc định, danh sách thử, tài khoản MB riêng, snapshot, parsing, token, batch lỗi, retry, POS không in hai bill, SePay vẫn chốt phiên của mình; chạy trực tiếp service native để kiểm tra QR MB/Sacombank và cờ hỗ trợ snapshot. Website chỉ hiện QR sau khi có phiên của đúng đơn và thông tin tài khoản dạng chữ khớp QR; phiên Pay2S thiếu snapshot không lấy lại tài khoản SePay.
- Jest POS: **2 suites / 13 tests đạt** (`posPaymentRecovery`, `posWebsitePaymentAlert`), chạy với quyền đọc cache hệ thống và loại thư mục build khỏi quét. Các lần chạy sandbox trước không trả kết quả; không dùng các lần đó làm bằng chứng. Kiểm tra native trực tiếp qua bundle Node cũng đạt; APK và thiết bị là các bước xác nhận riêng.
- SQL regression trên Supabase: đạt; dữ liệu giả lập rollback toàn bộ. Có sai tiền/tài khoản/ngân hàng, outgoing, unmatched, hết hạn/hủy, phiên SePay, duplicate, xung đột payload, thanh toán website nguyên tử và quyền truy cập anon/authenticated.
- Security advisor: bảng receipt bật RLS, không có policy cho client là chủ đích; chỉ service_role có quyền đọc/ghi và gọi RPC.
- `smoke-order-success-payment.mjs` hiện lỗi assertion regex cũ trên Checkout (`fulfillmentType === "pickup" ? paymentMethod : "COD"`); Checkout đã dùng `resolveCheckoutPaymentMethod` từ trước và không sửa trong đợt này. Không thay code sản phẩm để khớp regex cũ.
- Chưa có giao dịch ngân hàng thật hoặc xác nhận in giấy trên thiết bị.

## Triển khai server

- Migration `pay2s_parallel_payments` đã áp dụng.
- `pay2s-payment-webhook` v3, verify_jwt=false, tự kiểm tra Bearer token và từ chối nếu chưa có secret. HTTP 503 `pay2s_not_configured` đã xác minh từ endpoint thật.
- `sepay-pos-webhook` v54, giữ verify_jwt=false và secret hiện có.
- `pos-payment-session-api` v43, giữ verify_jwt=true.
- `qr-payment-session-api` v39, giữ verify_jwt=false và hợp đồng xác thực hiện có.
- Cả bốn chi nhánh vẫn Pay2S off. Không sửa app_configs hoặc thông tin nhận tiền SePay. Đã chuẩn bị cấu hình thử MB tại Thích Quảng Đức như mô tả trên.
- PR #21, #22 và #23 đã gộp; production Vercel `dpl_GXBaJP8FDQR9iacRQv8RVmrTJfi3` **READY**, source `76086d82ca0d802b872a9a9f09adaaad2462efaa`. Cấu hình MB riêng và QR/thông tin tài khoản theo phiên đã được build và triển khai lên website. Đã mở trực tiếp tab Thanh toán của Thích Quảng Đức, xác nhận SePay Sacombank, Pay2S MB và mode off.
- Kiểm tra cuối: 0 receipt Pay2S thật, 0 chi nhánh bật Pay2S. Không có webhook SePay tự nhiên trong 1 giờ quan sát; bằng chứng SePay sau thay đổi là kiểm tra hồi quy, chưa phải giao dịch ngân hàng thật.

## APK cài thử

- Đã build **POS 0.4.33 / versionCode 64**, package `vn.ghr.posmobile`, hai ABI `arm64-v8a`, `armeabi-v7a`.
- File local: `ghr-pos-mobile-native/releases/GHR-POS-0.4.33-pay2s-test.apk`, 31.759.975 bytes.
- SHA-256: `5e9b09d6b18dd94fa01c2ddbcad61893b7906155d2d667b01aa31a2c331c30de`.
- Chữ ký release SHA-256: `728d5843ae0c8883171fdae3fd65b6375810d27ed946297c5cee3a51b62224ea`, đối chiếu bằng apksigner với APK 0.4.32 đã xác minh (SHA-256 `ece0685b89c91812b0af7c725d9a8b9eca458fc93da211a7deffc419a280c46d`). Cùng package/chữ ký để cài đè; chưa kiểm chứng cài đặt thật trên thiết bị trong phiên này.
- Đã trích bytecode từ APK và so SHA-256 với bytecode vừa biên dịch: `f86fa11f59aae383128afb8faff768ffd1b5a336ed51d5f804368954a4aca708`. Xác nhận có `bank_account_snapshot`, `bankTransfer`, production environment và `__DEV__ = false`.
- Chưa thay metadata bản POS tải/cập nhật chung; đây là file thử riêng, cần cài lên máy thử rồi kiểm tra ngân hàng/bếp/in giấy.
- Build CLI Metro mặc định chậm ở bước băm toàn bộ thư viện. Bản thử dùng Node 22.23.4 portable từ nodejs.org (đã kiểm tra checksum), Metro một worker, `useWatchman=false`, `unstable_lazySha1=true`; gọi trực tiếp `unstable_buildBundleWithConfig` của CLI React Native với `dev=false`, `minify=false`, tạo bundle và copy đầy đủ asset bằng chính hàm CLI. Biên dịch Hermes bằng compiler đang có trong dự án và `-O`, sau đó Gradle chạy đủ assembleRelease/signing với init script tạm cấp bytecode đã kiểm tra cho tác vụ bundle. Không sửa/commit cấu hình Metro hoặc thay khóa ký, dependencies, Node hệ thống. Các helper build tạm nằm dưới `.tmp/` và không thuộc source phát hành.

## File cập nhật

- `src/pages/admin/store/BranchSettings.jsx`
- `src/services/qrPaymentService.js`
- `src/features/orders/OrderSuccessView.jsx`
- `supabase/functions/pos-payment-session-api/index.ts`
- `supabase/functions/qr-payment-session-api/index.ts`
- `supabase/functions/sepay-pos-webhook/index.ts`
- `ghr-pos-mobile-native/__tests__/posPaymentRecovery.test.js`
- `ghr-pos-mobile-native/android/app/build.gradle`
- `ghr-pos-mobile-native/src/features/pos/components/QrPaymentModal.js`
- `ghr-pos-mobile-native/src/features/pos/hooks/usePosComposer.js`
- `ghr-pos-mobile-native/src/services/pos/posPaymentService.js`
- `ghr-pos-mobile-native/src/services/pos/posPaymentSessionService.js`

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
- `scripts/pay2s-native.test.mjs`
- `docs/pay2s-parallel-integration-2026-11-02.md`

Tài liệu giao thức: https://developer.pay2s.vn/docs/webhook/tai-lieu-ky-thuat/

