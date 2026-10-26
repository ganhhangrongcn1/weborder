# Phát hành mẫu bill chung và POS 0.4.31 — 26/10/2026

## Nguồn và website

- Anh duyệt merge PR #14, triển khai web chính và APK kế tiếp, giữ đúng mã Android để cập nhật tại chỗ.
- Nguồn đã kiểm tra: `8d89f4013dbaa4a836309594c72772bca064da0a`; PR #14 merge thành `fc89598e022d10e1314d49aeaaaf6179964ba576`.
- Vercel production `dpl_7seqNPTvrykth7cKgZJAJboHbegU` READY, alias `ganhhangrong.vn`/`www.ganhhangrong.vn`, đúng commit merge trên.
- Đọc bundle công khai trên domain chính xác nhận menu `store-receipt-template`, “Mẫu in bill”, phiên bản hỗ trợ 0.4.31, tiêu đề QR và lời nhắc tem cuối cùng. Chưa kiểm chứng lưu cài đặt bằng phiên admin trên trình duyệt thật.
- Supabase `qjaklysckgzdfjthzkzu`: tạo cấu hình `ghr_receipt_template` lúc `2026-10-26 00:12:16.208065+00`, tức 07:12:16 giờ Việt Nam. Không đổi schema/RLS hoặc nghiệp vụ loyalty.
- Bản web/POS mới bắt buộc qua mẫu chung; thiếu cấu hình hoặc enabled=false cũ không quay về mẫu in legacy. Web bỏ HTML legacy; native dùng footerText/footerQrUrl đúng kênh để tránh rasterizer Android cắt mất QR/tem.

## Kiểm chứng nguồn in

- Web build/encoding, lint file sửa: đạt.
- POS Jest 5 bộ/21 ca (in, bundle, tem, giới hạn nhập điểm): đạt.
- `scripts/receipt-template.test.mjs`: kiểm tra mẫu POS/web/đối tác, dựng lại từ đơn thay text hàng đợi cũ, số tiền/topping/ghi chú, footer QR native, token, thiếu SĐT 10 ô trống, 3 tem còn 7, đủ 10 và in lại không lặp.
- Receipt loyalty + stamp print station: đạt; không tạo đơn/lệnh in/điểm/tem thật.
- Nội dung native và web ở commit nguồn build khớp main vừa merge (diff rỗng).

## APK và công bố tải xuống

- Kế tiếp bản 0.4.30/versionCode 61: `vn.ghr.posmobile`, versionName `0.4.31`, versionCode `62`, ABI arm64-v8a/armeabi-v7a; giữ khóa ký hiện hữu.
- Chữ ký đối chiếu từ APK 0.4.30 thật: SHA-256 `728d5843ae0c8883171fdae3fd65b6375810d27ed946297c5cee3a51b62224ea`.
- Metadata tải xuống cũ ghi versionCode 60 dù APK thực tế là 61; công bố bản mới phải dùng code 62 lấy từ APK đã kiểm chứng, không sao chép metadata sai.
- Gradle `app:assembleRelease --console=plain --no-daemon` đã BUILD SUCCESSFUL (25m22s); build local bằng khóa hiện hữu, không đổi guard hoặc secrets của GitHub Actions.
- APK cuối: `ghr-pos-mobile-native/releases/GHR-POS-0.4.31.apk`, 31.195.403 bytes. Manifest thực xác nhận `vn.ghr.posmobile` / `0.4.31` / `62`, hai ABI và chữ ký đúng hash đối chiếu trên.
- APK SHA-256: `0c94d3630f488d0680abbe828d99f049080c6edec20497eddfec4618358f5e44`. Manifest kiểm chứng lưu cạnh APK tại `GHR-POS-0.4.31.manifest.json`. Không ghi đè APK 0.4.30.
- Upload vào bucket app-downloads hiện hữu, đường dẫn mới `pos-printer/releases/62-0-4-31/GHR-POS-0.4.31.apk`, x-upsert=false. Đã tải lại URL public: HTTP 200, kích thước và SHA-256 trùng APK ký local.
- URL: https://qjaklysckgzdfjthzkzu.supabase.co/storage/v1/object/public/app-downloads/pos-printer/releases/62-0-4-31/GHR-POS-0.4.31.apk ; trang tải https://ganhhangrong.vn/download .
- Công bố metadata `ghr_app_downloads` lúc `2026-10-26T00:37:52.432Z` = 07:37:52 giờ Việt Nam: versionName 0.4.31, versionCode 62, hash/kích thước đúng APK. Giữ các app khác, ghi chú máy in và bản lưu trữ cũ; cập nhật tùy chọn, mandatory=false.

## Giới hạn nghiệm thu

- Build/test/deploy không chứng minh giấy in tại quán. Sau khi cài bản mới cần thử POS tiền mặt/QR, web trả trước/thu tại quầy, đối tác, in lại và thiếu mạng trên thiết bị thực.
- POS cũ chưa cài bản mới vẫn chạy mã cũ; bản APK mới giữ package/chữ ký để cập nhật thay vì gỡ ứng dụng.

## File liên quan phát hành

- Nội dung tính năng và danh sách file: `admin-receipt-template-2026-10-25.md` cùng thư mục.
- Phiên bản: `ghr-pos-mobile-native/android/app/build.gradle`.
- Đường in native: `ghr-pos-mobile-native/src/services/pos/posPrinterService.js`, `posPrintStationService.js`, `receiptTemplate.js`, `compactReceiptLayout.js`, `posReceiptTemplateService.js`.
- Đường in web: `src/services/printerService.js`, `receiptTemplateHtml.js`, `receiptTemplateService.js`, `repositories/receiptTemplateRepository.js`.
- Kiểm tra bổ sung: `scripts/receipt-template.test.mjs`, `ghr-pos-mobile-native/__tests__/posPrinterService.test.js`.
