# Lộ trình tối ưu an toàn — 07/10/2026

## Phạm vi

Làm lần lượt: (1) quy đổi Kho, (2) lỗi Supabase, (3) giảm tải luồng chính, (4) kiểm chứng và triển khai, (5) dọn tài nguyên thừa. Không mở rộng sang giao diện hoặc tính năng mới. Mỗi thay đổi phải có bằng chứng, phạm vi rõ và cách quay lại bản cũ.

## Bước 1 — hoàn thành đối chiếu ca kiểm tra quy đổi Kho

- Ca `service lưu bốn mức tồn theo đơn vị gốc` thiếu `displayUnitId`. Màn hình `InventoryMasterDataModal` gửi lựa chọn này cùng `stockSettingsUnit: purchase`; service dùng đơn vị hiển thị làm đơn vị tồn gốc.
- Sửa dữ liệu đầu vào kiểm tra để chọn Cái làm đơn vị tồn và Bịch làm đơn vị mua; giữ nguyên kỳ vọng 6 × 200 = 1.200 Cái, 24 × 200 = 4.800, 8 × 200 = 1.600 và 32 × 200 = 6.400.
- Xác nhận thêm đơn vị lưu và tỷ lệ 200 trong cùng ca kiểm tra. Không sửa service, màn hình, công thức, dữ liệu hay cấu hình Supabase.
- 38/38 kiểm tra đạt trong bốn nhóm: quy đổi đơn vị, dữ liệu danh mục Kho, ngưỡng tồn và báo cáo lô. Đây là bằng chứng ở mã nguồn; không thay thế kiểm chứng giao dịch Kho thật hay trigger database.
- File cập nhật: `scripts/inventory-unit-conversion.test.mjs`.

## Bước 2 — tiếp theo

Truy nguyên lỗi 42501 (quyền), 42703 (thiếu cột) và 57014 (hết thời gian). Ưu tiên xác định lời gọi, chức năng và vai trò bị ảnh hưởng trước khi sửa. Không nới RLS hoặc đổi quyền hàng loạt. Chỉ thay đổi sau khi có bằng chứng nguyên nhân và kiểm tra phù hợp.

### Kết quả lượt đối chiếu đầu

- Nhật ký cửa sổ 24 giờ tại thời điểm kiểm tra: `smart_promotions.name` thiếu cột (54 lần), `coupons.sales_channels` thiếu cột (18 lần); cuối cùng ghi nhận khoảng 15:25 UTC ngày 06/10. Schema trực tiếp xác nhận smart_promotions chỉ có id/data/updated_at; coupons không có sales_channels. Mã nhánh thử hiện đọc smart_promotions qua data và không chọn coupons.sales_channels. Chưa có bằng chứng cần thêm cột hoặc sửa lại logic nhánh thử; vẫn cần đối chiếu bản triển khai và phiên trình duyệt cũ.
- `sync_own_customer_profile`: 86 lỗi permission denied for function, cuối cùng 01:41 UTC ngày 07/10; một lỗi customer_profile_claim_denied. Metadata trực tiếp xác nhận authenticated có EXECUTE, anon không có; hàm kiểm tra quyền sở hữu, vai trò và email. `authenticator` trong log là vai trò kết nối, không đủ để xác định vai trò JWT của từng yêu cầu. Không cấp quyền anon và không thay đổi hàm.
- Phát hiện riêng trong supabaseAuthService: mã authUserId đầu vào lưu cũ có thể vượt kiểm tra mã người dùng khi getUser không có phiên hợp lệ. Đã chặn RPC trước khi ghi nếu getUser lỗi hoặc không có user.id. Đây là sửa một đường gọi cụ thể, chưa chứng minh nguồn của toàn bộ 86 lỗi. Đường gọi khác trong coreSupabaseRepository còn cần đối chiếu phiên runtime/customer.
- Ba kiểm tra giả lập đạt: phiên mất dù có mã lưu cũ; xác thực lỗi dù trả user; phiên hợp lệ giữ đường đồng bộ cũ. Không chạy RPC ghi hồ sơ thật để kiểm tra, không thay đổi hồ sơ/điểm/quyền.
- Timeout PostgREST trong cùng cửa sổ thuộc order-count summary (7), popular products (6), order point statuses (5), business analytics (3), CRM cached (1). Đây là lượt lỗi, không phải số đơn lỗi; chưa đo lại sau sửa hoặc xác định timeout còn xảy ra với bản mới.
- File sửa: src/services/supabaseAuthService.js. File mới: scripts/customer-profile-session-guard.test.mjs. Bước 2 đang thực hiện, chưa hoàn tất; tiếp theo là xác định đường gọi runtime bị mất phiên và đối chiếu phiên bản đang triển khai.

### Đường gọi hồ sơ trong repository

- `writeProfileRowToTable` trước đây lấy client runtime trực tiếp; nay dùng `getCustomerActionSupabaseClientAsync` có sẵn: ưu tiên customer có session, fallback runtime có session. Không thay đổi cơ chế chọn client của các chức năng khác.
- Nếu client được chọn không có session, trả lỗi 42501 tại ứng dụng trước khi gọi RPC. Không trả thành công giả; lỗi quyền sở hữu từ server vẫn truyền về bên gọi. Kiểm tra session phía ứng dụng không thay thế xác thực và quyền sở hữu trên Supabase.
- 4 kiểm tra mới đạt: customer hợp lệ/runtime chưa đăng nhập; runtime fallback; cả hai mất phiên; server từ chối quyền sở hữu. Cùng 3 kiểm tra đường auth, tổng 7/7 đạt. Đây là giả lập mã thực, chưa chứng minh toàn bộ lỗi production đã hết.
- File sửa thêm: src/services/repositories/coreSupabaseRepository.js. File mới: scripts/customer-profile-client-selection.test.mjs. Chưa triển khai bản sửa. Tiếp theo vẫn là đối chiếu phiên bản production và nguồn các lỗi còn lại, không chuyển sang tối ưu hạng mục khác.

## Bước 3 — chờ bước 2

### Chốt kiểm tra chéo phiên đăng nhập

Vercel trực tiếp xác nhận production READY vẫn commit 4d188537532157bb12ae9b69f5a6a08acafb87c2. Các sửa hồ sơ local chưa triển khai.

Supabase AI phản biện rằng getSession chỉ là kiểm tra trước, lỗi xác thực không được làm đổi danh tính sang runtime, và logout sau khi gửi request vẫn cần server bảo vệ. Sau phản biện, bản cuối của writeProfileRowToTable thay cách chọn helper mô tả ở trên bằng lựa chọn riêng cho đường ghi hồ sơ: đọc phiên customer và giữ lỗi đọc phiên; chỉ chọn runtime khi customer không có phiên; gọi getUser trên chính client đã chọn, giữ nguyên lỗi Auth; không có user thì báo thất bại trước RPC. Không fallback/retry sau lỗi Auth hoặc RPC. Helper dùng bởi các customer actions khác không bị sửa.

10/10 kiểm tra giả lập đạt, gồm cả hai phiên cùng tồn tại, customer Auth lỗi không fallback và logout giữa chọn client với xác thực. Không chứng minh logout sau khi RPC bắt đầu bị chặn bằng frontend; server vẫn là nơi kiểm tra quyền sở hữu. Bước 2 chưa hoàn tất: còn đối chiếu lỗi partner/profiles/loyalty theo caller thật và kiểm chứng bản thử. Không cấp quyền để che lỗi.

### Đối chiếu đơn đối tác và loyalty

- Log 24 giờ tại thời điểm lượt này có 86 lỗi 42501 ở SELECT partner_orders, lần cuối 06/10 15:18 UTC; 15 ở process_order_loyalty, cuối 14:03 UTC; 9 permission denied prepare_customer_loyalty_account, cuối 14:12 UTC. Không suy ra lỗi còn hoạt động chỉ từ cửa sổ chứa lịch sử này.
- Metadata hiện tại: anon/authenticated có SELECT bảng và raw_data trên partner_orders; SELECT policies đều permissive true cho hai vai trò. Vì vậy không có căn cứ kết luận nhóm 86 lỗi do hiện thiếu SELECT hoặc sửa quyền để làm hết lỗi. Bộ lọc phone frontend không thay thế kiểm soát truy cập; quyền đọc rộng đã nằm trong hạng mục bảo mật chờ ma trận vai trò, không nới quyền thêm.
- prepare_customer_loyalty_account và process_order_loyalty: anon không EXECUTE, authenticated có. Wrapper process_order_loyalty gọi loyalty_private.process_order_loyalty_internal; authenticated có USAGE schema và EXECUTE hàm nội bộ. Hàm nội bộ kiểm tra hành động/caller, trạng thái hoàn tất/hủy/hoàn tiền, số điểm snapshot và idempotency. Metadata không thay thế kiểm chứng mỗi nhánh giao dịch.
- Nguồn hiện tại: getPartnerOrdersByPhone dùng client runtime, có cả caller khách tra cứu; orderSummaryService có fallback đọc bảng; claimPartnerOrderPoints và loyaltyRepository gọi processOrderLoyalty. Không đổi client xử lý điểm chung vì có caller nghiệp vụ khác và client được truyền vào. Không chạy RPC ghi hoặc giao dịch thử trên production.
- Log không trả được thông điệp cụ thể của hai nhóm partner/process qua các bucket an toàn đã kiểm tra. Không xuất truy vấn/PII để đoán lỗi. Chưa đủ bằng chứng xác định request/role/phiên bản của từng lỗi, chưa sửa các đường này.
- Tiếp theo trong bước 2: kiểm chứng bản thử của sửa phiên hồ sơ, đối chiếu caller lỗi mới qua request diagnostics; chỉ chọn sửa partner/loyalty khi có nguyên nhân cụ thể. Không coi các lỗi quyền có chủ đích là lỗi cần mở quyền.

Đo truy vấn và tần suất gọi ở báo cáo Admin, danh sách đơn, Kitchen/POS. Chọn điểm gây tải có bằng chứng; dùng cache, gom lời gọi, giới hạn phạm vi hoặc index theo nhu cầu thực. Số liệu tích lũy không chứng minh mức giảm tải sau sửa.

## Bước 4 — chờ bản sửa đủ kiểm chứng

Kiểm tra phần bị tác động của đặt hàng, thanh toán, tích điểm, Kho và phân quyền. Bản thử tách khỏi production; build thành công chưa chứng minh vận hành thật. Có cách quay lại phiên bản cũ trước triển khai. Các luồng nhạy cảm cần kiểm chứng bằng vai trò và môi trường phù hợp.

## Bước 5 — chờ xác minh tham chiếu

Rà Storage và tài nguyên nghi thừa. Không xem cảnh báo unused index hay dead tuples là bằng chứng đủ để xóa. Chỉ dọn khi xác minh không sử dụng, thời hạn lưu phù hợp và có bản lưu cần thiết.
