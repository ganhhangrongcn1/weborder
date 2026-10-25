# Mẫu in bill chung — 25/10/2026

## Rút gọn theo duyệt ngày 26/10/2026

- Chỉnh tiếp theo ảnh anh duyệt: tiêu đề “ĐỪNG BỎ LỠ ĐIỂM ĐƠN NÀY”, dưới là “Quét để nhận 7000”; không có chữ/ký hiệu đơn vị sau số. Nếu chưa có số thưởng thì dùng lời mời chung, không suy từ tổng tiền.
- Bill khách thiếu SĐT hiển thị 10 ô tem trống và “Cung cấp SĐT để tích tem”, không giả làm số dư 0/10 đã tra cứu. Có SĐT thì giữ số tem máy chủ đã trả; không ghi điểm/tem khi dựng hoặc in mẫu. Bill món và tùy chọn tắt tem vẫn không hiện khối này.
- File sửa cho lần phản hồi này: `receiptTemplate.js`, `posPrinterService.js` trong native; `src/services/printerService.js`; `src/pages/admin/store/ReceiptTemplateEditor.jsx`; `scripts/receipt-template.test.mjs`; báo cáo này. Kiểm tra mẫu bổ sung cả ba kênh thiếu SĐT và in lại không lặp khối tem.

- Mặc định bỏ slogan, ẩn thu ngân và bỏ lời nhắc dài cuối bill món. Bill món chỉ giữ tiêu đề, mã đơn/thẻ rung, kênh/giờ, món, topping và ghi chú; không có tiền/QR/tem/thông tin thành viên.
- Bill khách gom kênh và giờ một dòng, giữ chi nhánh; bỏ phần địa chỉ/hotline chi nhánh lặp. Chỉ giữ một tổng tiền và một xác nhận thanh toán. Bỏ dòng còn phải thu chỉ khi bằng 0; khoản chưa thu khác 0 và giảm điểm/voucher vẫn giữ nguyên. Tiền khách đưa/thối vẫn chỉ theo builder thanh toán gốc.
- Anh yêu cầu không ghi “đã tích cho SĐT” và ưu tiên mời khách quét vào website. Không bổ sung tra cứu/trạng thái đã nhận hoặc số nhận vào lời mời. Số thưởng hiển thị riêng như `7000`, không phân cách, không chữ “điểm” hoặc ký hiệu tiền phía sau; nếu chưa có số đáng tin thì không tự suy từ tiền đơn. Định dạng số tiền thanh toán giữ nguyên.
- Một QR cuối bill, khối tem rút còn hình tem và số tem; website/hotline gộp một dòng. Nội dung tiền/điểm/tem thật và khóa chống nhận trùng không thay đổi.
- Bộ gọn dùng chung cho web và native direct/cloud. Native đưa số thưởng có sẵn trên đơn qua marker nội bộ rồi loại marker trước khi gửi máy in; không phát sinh điểm khi in.
- Kiểm tra mẫu/QR/tem đạt; đã mở local. Chưa merge, chưa triển khai production, chưa build/phát hành APK mới.
- File mới: `ghr-pos-mobile-native/src/services/pos/compactReceiptLayout.js`.
- File cập nhật: `ghr-pos-mobile-native/src/services/pos/receiptTemplate.js`, `ghr-pos-mobile-native/src/services/pos/posPrinterService.js`, `ghr-pos-mobile-native/src/services/pos/posPrintStationService.js`, `src/services/printerService.js`, `src/services/receiptTemplateHtml.js`, `scripts/receipt-template.test.mjs`, báo cáo này.

## Mục tiêu và phạm vi

Thêm Admin → Thiết lập hệ thống → Mẫu in bill. Anh chỉnh nội dung chung và xem bố cục ngay, chia bill món và bill khách (POS, website, đối tác). Các renderer cũ hiện có chân bill khác nhau, bill đối tác đưa quảng bá/QR lên trước món; một bộ trình bày dùng chung gom QR/tem/cuối bill về sau phần món và thanh toán.

## Cách sử dụng

- Chọn loại bill và khổ xem trước 58/80 mm; đổi trạng thái thanh toán/có SĐT trên dữ liệu minh họa.
- Chỉnh thương hiệu, dòng giới thiệu, tiêu đề, website, hotline, lời cảm ơn, lời nhắc bếp; bật/tắt chi nhánh, thu ngân, thông tin khách, QR thành viên, tem.
- Chỉ nút **Lưu và áp dụng** mới ghi cấu hình `ghr_receipt_template` vào `app_configs`. Xem mẫu mặc định chỉ thay bản nháp. Lỗi tải cấu hình khóa nút lưu để tránh ghi đè mẫu chưa đọc được.
- Khổ xem trước không đổi cài đặt phần cứng máy in. Đây là mô phỏng bố cục chung; chi tiết tiền mặt, đối soát và font phụ thuộc dữ liệu/đường in thật, cần nghiệm thu giấy in tại quán.
- Script `node scripts/preview-receipt-template.mjs` mở localhost:4180, dùng cùng editor nhưng không nối hook lưu/cấu hình thật. Nút lưu bị khóa, không có đăng nhập, lệnh in hoặc giao dịch loyalty. Chỉ dùng xem thử, không phải đường admin thay thế.

## Giới hạn an toàn

- Mã đơn, dòng món, topping, ghi chú, tiền và trạng thái thanh toán vẫn do builder gốc sinh. Không sửa tính tiền hoặc ghi ledger/tem.
- Bill đối tác giữ cách không in tiền đối soát nội bộ; không tự đổi thành tiền mặt. Chỉ hiển thị số điểm đã có trên đơn hoặc lời mời chung, không suy số điểm từ tổng tiền.
- Phiếu làm món không có QR thưởng hoặc tem. Phiếu QR thanh toán, tem nhãn và báo cáo ca không dùng mẫu bill khách.
- Giữ token bill do server cấp. QR thưởng không thay QR chuyển khoản. Văn bản admin loại ký tự điều khiển/chỉ thị máy in và được escape khi render HTML.
- Web đọc cấu hình với deadline 1,5 giây, cache/in-flight; native tương tự và giữ mẫu đọc thành công gần nhất trong bộ nhớ. Không thêm polling/realtime hoặc localStorage.
- Supabase RLS hiện hữu đã đọc trực tiếp: app_configs cho đọc public, ghi chỉ admin qua `has_app_role`. Không đổi policy/schema và không ghi cấu hình production trong quá trình phát triển.
- Không có cấu hình hoặc enabled=false giữ mẫu in hiện hành. Nếu cần tắt sau phát hành, admin đặt enabled=false trong cấu hình này; không đụng điểm/tem.

## Kiểm tra

- `npm run build`: đạt (UTF-8/Vite); cảnh báo chunk lớn/Browserslist là hiện trạng dự án.
- ESLint theo các file thay đổi: đạt, khai báo require của React Native khi lint file native.
- `node --experimental-vm-modules scripts/receipt-template.test.mjs`: đạt bốn mẫu, tiền mặt/số dư phải thu, ghi chú/topping, đúng token, một QR/khối tem, in lặp không lặp footer, loại phiếu làm món/QR chuyển khoản, cấu hình tắt và escape.
- Receipt loyalty và stamp print station regression: đạt; không thực hiện lệnh in thật hoặc nhận điểm thật.
- Đã mở trình duyệt local, sửa dòng giới thiệu, chuyển có SĐT hiển thị tem, chuyển bill món không có tiền/QR. Admin thật đang ở màn đăng nhập, chưa xác minh thao tác lưu bằng phiên admin thật.

## Trạng thái phát hành

- Đây là tính năng mới, tách khỏi PR #12 đã triển khai. Chưa merge/deploy tính năng mẫu bill hoặc ghi cấu hình production.
- POS 0.4.30 chưa có bộ mẫu chung: phải build/phát hành APK mới sau khi chốt nội dung và kiểm tra giấy in. Chưa tăng versionCode hoặc thay file APK 0.4.30.
- Cần nghiệm thu trên máy quán: bill món; khách POS tiền mặt/QR; web trả trước/thu tại quầy; đối tác; in lại; thiếu mạng; giấy 58/80 mm. Không coi build/test là bằng chứng giấy in thật.

## File mới

- `ghr-pos-mobile-native/src/services/pos/receiptTemplate.js`
- `ghr-pos-mobile-native/src/services/pos/posReceiptTemplateService.js`
- `src/services/repositories/receiptTemplateRepository.js`
- `src/services/receiptTemplateService.js`
- `src/services/receiptTemplateHtml.js`
- `src/hooks/useReceiptTemplateSettings.js`
- `src/data/receiptTemplateSamples.js`
- `src/pages/admin/store/ReceiptTemplateSettings.jsx`
- `src/pages/admin/store/ReceiptTemplateEditor.jsx`
- `src/styles/admin/receipt-template.css`
- `scripts/receipt-template.test.mjs`
- `scripts/receipt-template-preview-entry.jsx`
- `scripts/preview-receipt-template.mjs`
- `docs/loyalty/reports/admin-receipt-template-2026-10-25.md`

## File cập nhật

- `src/pages/admin/AdminBackofficeSections.jsx`
- `src/pages/admin/adminNavigation.js`
- `src/services/repositories/writeThroughPolicy.js`
- `src/services/printerService.js`
- `ghr-pos-mobile-native/src/services/pos/posPrinterService.js`
- `ghr-pos-mobile-native/src/services/pos/posPrintStationService.js`
- `scripts/receipt-loyalty.test.mjs`
