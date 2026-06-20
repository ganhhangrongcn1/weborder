# Loyalty V2 — Phase 1: Audit và hợp đồng nghiệp vụ

Ngày chốt: 20/06/2026

Trạng thái: Đã chốt thiết kế, chưa thay đổi production

Phạm vi áp dụng: Website, QR, POS tại quầy, GrabFood, ShopeeFood, Xanh Ngon và các đối tác mới

## 1. Mục tiêu

Loyalty V2 phải đưa toàn bộ luồng cộng, trừ và hoàn điểm về một nguồn sự thật duy nhất trong Supabase. Mọi kênh bán hàng dùng chung quy tắc, nhưng vẫn giữ đúng định danh và điều kiện nghiệp vụ của từng nguồn đơn.

Kết quả bắt buộc:

- Đơn chỉ được cộng điểm khi đã hoàn tất.
- Một sự kiện dù gọi lại nhiều lần cũng chỉ ảnh hưởng số dư một lần.
- Cộng điểm, trừ điểm và hoàn điểm phải được xử lý trong transaction tại database.
- Website, QR và POS dùng khóa thật của bảng `orders`.
- Đơn đối tác dùng khóa thật `partner_orders.id`; không dùng mã hiển thị làm định danh.
- Thay đổi tỷ lệ tích điểm không làm tính lại các đơn cũ.
- `loyalty_ledger` là sổ giao dịch; `loyalty_accounts` chỉ là số dư tổng hợp.
- Frontend không được tự truyền số điểm cần cộng hoặc trừ cho RPC xử lý đơn hàng.

## 2. Phạm vi Phase 1

Phase 1 chỉ thực hiện:

- Audit cấu hình admin, giao diện khách, luồng website/QR/POS/đối tác, repository, RPC, trigger và RLS.
- Chốt công thức, định danh, trạng thái, sự kiện, transaction, phân quyền và tiêu chí kiểm thử.
- Chốt lộ trình triển khai an toàn cho các phase tiếp theo.

Phase 1 không thực hiện:

- Không chạy migration.
- Không thay RPC production.
- Không sửa dữ liệu hoặc bù điểm.
- Không đổi giao diện hoặc luồng đang chạy.

## 3. Hiện trạng đã đối chiếu

Snapshot production ngày 20/06/2026:

| Hạng mục | Số lượng |
| --- | ---: |
| Tài khoản điểm | 36 |
| Dòng sổ điểm | 211 |
| Đơn trong `orders` | 178 |
| Đơn trong `partner_orders` | 5.914 |
| Hồ sơ khách | 4.213 |
| Tổng điểm trong tài khoản | 78.151 |
| Tổng điểm trong ledger | 78.151 |

Tổng số dư hiện tại đang khớp với tổng ledger. Đây là mốc đối chiếu trước migration, không chứng minh từng đơn đã được xử lý đúng.

Cấu hình `ghr_loyalty` đang chạy:

| Trường | Giá trị |
| --- | ---: |
| `enabled` | `true` |
| `currencyPerPoint` | 100 |
| `pointPerUnit` | 1 |
| `redeemPointUnit` | 1 |
| `redeemValue` | 1 |
| `checkinDailyPoints` | 100 |
| Mốc 7 ngày | 700 |
| Mốc 14 ngày | 1.500 |
| Mốc 30 ngày | 3.000 |

### 3.1 Các lỗi kiến trúc cần xử lý

Mức nghiêm trọng cao:

1. `apply_loyalty_event` nhận trực tiếp số điện thoại, loại sự kiện, số điểm và số tiền từ client. Database chưa tự kiểm tra đơn, trạng thái và quy tắc tính điểm.
2. Kiểm tra trùng hiện nằm trước khóa tài khoản; `INSERT ... ON CONFLICT DO NOTHING` vẫn có thể đi tiếp và cập nhật số dư. Gọi đồng thời có nguy cơ lệch tài khoản với ledger.
3. Website/POS cập nhật đơn trước rồi mới gọi loyalty. Loyalty lỗi thì đơn vẫn hoàn tất hoặc vẫn hưởng giảm giá.
4. Một số RLS production đang cho `anon` và `authenticated` đọc/ghi rộng vào `loyalty_accounts`, `loyalty_ledger`, `orders`, `partner_orders` và `app_configs`.
5. `claim_partner_order_points` cho phép client truyền `p_amount_per_point`, đồng thời chưa bắt buộc trạng thái phải là hoàn tất.

Mức nghiêm trọng trung bình:

1. Website không lưu riêng `pointsSpent`, chỉ lưu số tiền giảm; khi tỷ lệ đổi điểm khác 1:1 sẽ không thể dựng lại số điểm đã trừ.
2. POS lưu được `pointsSpent`, nhưng luồng hủy có thể dùng nhầm số tiền giảm làm số điểm hoàn.
3. Website tính điểm trên tiền hàng sau khuyến mãi, trước giảm điểm; POS đang có chỗ tính trên tổng tiền sau giảm điểm.
4. Khi đơn hoàn tất, điểm được tính bằng cấu hình tại thời điểm xử lý thay vì phiên bản quy tắc đã gắn với đơn.
5. Admin lưu cấu hình có thể tính lại lịch sử đơn local theo quy tắc mới.
6. Điều chỉnh/reset điểm trong CRM hiện có đường ghi vào config local thay vì tạo giao dịch ledger chuẩn.
7. Check-in và milestone được tính ở client, chưa có khóa chống trùng theo ngày/mốc tại database.
8. Giao diện lịch sử luôn thêm dấu `+`, nên giao dịch âm có thể hiển thị sai.

### 3.2 Ba luồng đang không đồng nhất

| Nguồn | Định danh hiện có | Cách cộng/trừ hiện tại | Vấn đề chính |
| --- | --- | --- | --- |
| Website/QR | Bản ghi `orders` | Frontend gọi loyalty sau ghi đơn/trạng thái | Không atomic, thiếu `pointsSpent` |
| POS tại quầy | Bản ghi `orders`, nguồn POS | POS service gọi loyalty sau ghi đơn/thanh toán | Không atomic, hoàn điểm có thể nhầm đơn vị |
| Đối tác | `partner_orders.id` | RPC claim riêng | Chưa bắt buộc hoàn tất, cho override tỷ lệ |

Kết luận: không vá thêm RPC theo từng kênh. Loyalty V2 dùng một cổng xử lý sự kiện, còn phần đọc đơn được tách theo `source_type`.

## 4. Nguồn sự thật và thuật ngữ

### 4.1 Nguồn sự thật

| Dữ liệu | Nguồn sự thật |
| --- | --- |
| Thông tin khách | `profiles` theo số điện thoại chuẩn hóa |
| Đơn web/QR/POS | `orders` |
| Đơn đối tác | `partner_orders` |
| Lịch sử điểm | `loyalty_ledger` |
| Số dư điểm | `loyalty_accounts`, được suy ra từ ledger |
| Quy tắc hiện hành | Phiên bản loyalty đang active |
| Quy tắc của đơn | Snapshot bất biến đã gắn với đơn |

Không suy số dư từ danh sách đơn. Không dùng localStorage làm nguồn sự thật của điểm.

### 4.2 Định danh nguồn đơn

| `source_type` | Bảng | `source_order_id` | Ghi chú |
| --- | --- | --- | --- |
| `ORDER` | `orders` | Khóa chính thật của bản ghi | Dùng thêm `order_source` để phân biệt web, QR, POS |
| `PARTNER_ORDER` | `partner_orders` | UUID `partner_orders.id` | Ingest tiếp tục dùng `partner_source + nexpos_order_id` để chống trùng |

`order_code`, `display_order_code` và mã in hóa đơn chỉ dùng để hiển thị/tìm kiếm, không dùng làm khóa nghiệp vụ loyalty.

## 5. Hợp đồng quy tắc tính điểm

### 5.1 Phiên bản bất biến

Mỗi lần admin đổi quy tắc phải tạo một phiên bản mới. Không sửa nội dung phiên bản đã được đơn sử dụng.

Một phiên bản tối thiểu gồm:

- `version_id`: khóa duy nhất.
- `status`: `DRAFT`, `ACTIVE`, `RETIRED`.
- `effective_from`: thời điểm bắt đầu áp dụng.
- `earn_numerator` và `earn_denominator`: tỷ lệ tích điểm dạng số nguyên.
- `redeem_point_unit` và `redeem_value`: số điểm đổi được bao nhiêu tiền.
- Các quy tắc check-in/milestone nếu tính năng bật.
- Người tạo và thời điểm tạo.

Không dùng số thực để tính tiền/điểm. Công thức dùng số nguyên:

```txt
earn_points = floor(eligible_amount × earn_numerator / earn_denominator)
```

Cấu hình hiện tại tương đương:

```txt
earn_numerator = 1
earn_denominator = 100
```

Nếu sau này 100.000đ tích 10.000 điểm:

```txt
earn_numerator = 10
earn_denominator = 100
earn_points = floor(100.000 × 10 / 100) = 10.000
```

Thay tỷ lệ chỉ ảnh hưởng đơn mới gắn với phiên bản mới. Đơn cũ luôn dùng snapshot cũ.

### 5.2 Số tiền đủ điều kiện tích điểm

Áp dụng chung cho web, QR, POS và đối tác:

```txt
eligible_amount = tiền món sau khuyến mãi không phải loyalty
```

Không bao gồm:

- Phí giao hàng.
- Tiền tip/phụ phí không thuộc món.
- Phần giảm do đổi điểm.

Điểm tích được tính trước khi trừ giảm giá loyalty. Nhờ vậy dùng điểm không làm giảm lượng điểm được tích từ giá trị hàng hóa thực tế sau khuyến mãi.

### 5.3 Snapshot bắt buộc trên đơn

Khi đơn được chấp nhận, phải lưu bất biến:

- `loyalty_rule_version_id`.
- `points_base_amount`.
- `expected_earn_points`.
- `points_spent`.
- `points_discount_amount`.

RPC settlement không đọc lại cấu hình mới để tính đơn cũ.

## 6. Hợp đồng sự kiện Loyalty V2

Một RPC công khai duy nhất xử lý loyalty liên quan đơn hàng:

```txt
process_order_loyalty(
  source_type,
  source_order_id,
  action,
  idempotency_key
)
```

Client không được truyền số điện thoại, số tiền hoặc số điểm. RPC phải đọc đơn, chuẩn hóa khách, kiểm tra trạng thái, lấy snapshot quy tắc và tự tính kết quả.

| `action` | Dấu ledger | Ý nghĩa |
| --- | ---: | --- |
| `SPEND` | Âm | Trừ điểm đã dùng cho đơn |
| `SETTLE_EARN` | Dương | Cộng điểm khi đơn hoàn tất |
| `REVERSE_SPEND` | Dương | Hoàn lại điểm đã dùng khi đơn hủy/hoàn |
| `REVERSE_EARN` | Âm | Thu hồi điểm đã cộng khi đơn hoàn/hủy sau hoàn tất |
| `CLAIM_PARTNER_EARN` | Dương | Khách nhận điểm đơn đối tác đã hoàn tất |

Các sự kiện không gắn với đơn dùng cổng nghiệp vụ riêng nhưng chung ledger:

- `CHECKIN` với khóa duy nhất theo khách + ngày kinh doanh.
- `MILESTONE` với khóa duy nhất theo khách + chu kỳ + mốc.
- `ADMIN_ADJUST` bắt buộc có lý do và người thao tác.

Không dùng số dương với loại `ORDER_SPEND` để biểu diễn hoàn điểm. Mỗi ý nghĩa có loại sự kiện riêng, dấu điểm cố định.

## 7. Ma trận trạng thái đơn

| Tình huống | Hành động loyalty | Kết quả |
| --- | --- | --- |
| Tạo đơn không dùng điểm | Không ghi ledger | Chờ hoàn tất |
| Tạo đơn có dùng điểm | `SPEND` trong giao dịch chấp nhận đơn | Trừ đúng `points_spent` |
| Không đủ điểm | Hủy toàn bộ thao tác chấp nhận giảm điểm | Đơn không được giữ giảm loyalty |
| Đơn chuyển sang hoàn tất | `SETTLE_EARN` | Cộng đúng một lần |
| Hủy trước khi hoàn tất, không dùng điểm | Không phát sinh | Số dư không đổi |
| Hủy trước khi hoàn tất, có dùng điểm | `REVERSE_SPEND` | Hoàn đúng số điểm đã trừ |
| Hủy/hoàn sau khi đã hoàn tất | `REVERSE_EARN`; thêm `REVERSE_SPEND` nếu đã dùng điểm | Đưa tác động loyalty của đơn về 0 |
| Chuyển trạng thái lặp lại | Dùng cùng khóa idempotency | Không cộng/trừ lần hai |
| Mở lại đơn đã hủy | Không tự tái áp dụng | Phải có hành động nghiệp vụ rõ ràng |
| Đơn không có số điện thoại hợp lệ | Không xử lý loyalty | Đơn vẫn vận hành bình thường |
| Claim đơn đối tác chưa hoàn tất | Từ chối | Không ghi ledger |
| Claim đơn đối tác sai số điện thoại | Từ chối | Không ghi ledger |
| Claim lại đơn đối tác | Trả kết quả cũ | Không cộng lần hai |

Hoàn tiền một phần chưa có nghiệp vụ chuẩn trong hệ thống hiện tại. V2 giai đoạn đầu không tự suy diễn; admin dùng `ADMIN_ADJUST` có lý do. Khi triển khai hoàn một phần sẽ thêm action riêng và khóa idempotency riêng.

## 8. Transaction, idempotency và cạnh tranh đồng thời

### 8.1 Một transaction duy nhất

Mỗi lần RPC xử lý phải thực hiện trong cùng transaction:

1. Xác thực người gọi và action.
2. Khóa bản ghi đơn cần thiết.
3. Đọc khách, trạng thái, snapshot tiền/điểm.
4. Khóa `loyalty_accounts` của khách bằng `FOR UPDATE`.
5. Chèn ledger với khóa idempotency duy nhất.
6. Chỉ cập nhật số dư nếu ledger thật sự được chèn.
7. Gắn trạng thái loyalty lên đơn nếu cần.
8. Trả số dư và sự kiện đã áp dụng.

Bất kỳ bước nào lỗi thì toàn bộ transaction rollback.

### 8.2 Khóa chống trùng

Khóa chuẩn:

```txt
source_type + source_order_id + action + action_version
```

Database phải có unique constraint cho khóa này. `idempotency_key` do caller gửi chỉ là khóa yêu cầu bổ sung, không thay thế unique nghiệp vụ.

Khi gọi lại:

- Cùng nguồn + đơn + action: trả lại kết quả đã có.
- Không cập nhật số dư lần nữa.
- Không tạo thêm dòng ledger.

### 8.3 Quan hệ đảo giao dịch

`REVERSE_SPEND` và `REVERSE_EARN` phải tham chiếu `reversal_of_ledger_id`. Một giao dịch gốc chỉ được đảo tối đa một lần cho mỗi phạm vi đầy đủ.

## 9. Hợp đồng dữ liệu ledger và tài khoản

Ledger V2 cần có tối thiểu:

- `id` UUID hoặc khóa ổn định.
- `customer_phone` đã chuẩn hóa.
- `entry_type`.
- `points` có dấu.
- `source_type`.
- `source_order_id`.
- `action`.
- `action_version`.
- `idempotency_key`.
- `rule_version_id`.
- `amount` là `points_base_amount` của sự kiện earn hoặc giá trị liên quan.
- `reversal_of_ledger_id` nếu là giao dịch đảo.
- `actor_type`, `actor_id`.
- `metadata` phục vụ hiển thị/audit, không chứa logic quyết định số dư.
- `created_at` do database tạo.

Quy tắc số dư:

```txt
loyalty_accounts.total_points = sum(loyalty_ledger.points)
```

Không cho frontend sửa trực tiếp `total_points`. Không cho frontend update/delete ledger. Sửa sai bằng giao dịch bù, không sửa lịch sử.

## 10. Phân quyền và RLS

### 10.1 Nguyên tắc

- Mặc định thu hồi quyền execute từ `PUBLIC` cho RPC ghi loyalty.
- Chỉ cấp execute đúng role cần thiết.
- `SECURITY DEFINER` phải đặt `search_path` cố định và tự kiểm tra actor.
- Customer chỉ đọc tài khoản/ledger của chính mình qua `auth.uid()` liên kết `profiles`.
- Admin/staff chỉ có quyền theo vai trò active.
- `anon` không được insert/update/delete `loyalty_accounts` hoặc `loyalty_ledger`.
- Service role dùng cho n8n/Edge Function ở môi trường server, không xuất hiện ở frontend.
- Không cho client override tỷ lệ, số điểm hoặc khách nhận điểm.

### 10.2 Quyền theo action

| Action | Actor hợp lệ |
| --- | --- |
| `SPEND` | Luồng tạo đơn đã được xác thực tại database hoặc service server |
| `SETTLE_EARN` | Admin/staff/kitchen hợp lệ hoặc service role theo luồng trạng thái |
| `REVERSE_SPEND`, `REVERSE_EARN` | Admin/staff được phân quyền hoặc service role |
| `CLAIM_PARTNER_EARN` | Customer sở hữu số điện thoại đơn hoặc nhân viên được phân quyền |
| `CHECKIN`, `MILESTONE` | Customer chính chủ; database tự kiểm tra ngày/mốc |
| `ADMIN_ADJUST` | Admin; bắt buộc lý do |

RLS các bảng đơn cũng cần được audit và siết riêng. Việc loyalty an toàn không đủ nếu client có thể tự sửa trạng thái hoặc số tiền của đơn.

## 11. Hợp đồng giao diện và service

UI chỉ gọi service; service gọi repository/RPC.

UI nhận kết quả chuẩn:

```txt
ok
applied
event_id
action
points_delta
balance_before
balance_after
message
```

Quy tắc hiển thị:

- Điểm dương hiển thị `+1.000`.
- Điểm âm hiển thị `-1.000`, không hiển thị `+-1.000`.
- Tên sự kiện phản ánh đúng cộng, sử dụng, hoàn hay thu hồi.
- Trang tra cứu đơn lấy trạng thái đã tích điểm từ ledger/RPC read model, không đoán từ field local.
- Admin thay tỷ lệ phải thấy rõ “chỉ áp dụng cho đơn mới từ thời điểm kích hoạt”.
- Admin điều chỉnh điểm phải nhập lý do và tạo ledger `ADMIN_ADJUST`.

## 12. Tương thích dữ liệu hiện tại

Migration phải bảo toàn:

- 211 dòng ledger hiện có.
- Tổng số dư 78.151 tại thời điểm snapshot.
- Các trường legacy đang được UI/service đọc.
- Các đơn đã claim không được cộng lại.

Cách chuyển đổi:

1. Tạo phiên bản quy tắc V1 từ cấu hình production hiện tại.
2. Backfill `source_type`, `source_order_id`, `action` và `rule_version_id` khi có thể xác định chắc chắn.
3. Dòng lịch sử không xác định đủ giữ nguyên, đánh dấu `LEGACY`; không tự đoán.
4. Tạo unique constraint sau khi chạy audit trùng và xử lý ngoại lệ.
5. Trong thời gian chuyển tiếp, giữ các cột legacy để frontend cũ vẫn đọc được.
6. Bật RPC V2 sau smoke test; sau đó mới chuyển từng kênh bằng feature flag.
7. Không xóa RPC/cột cũ cho đến khi đối chiếu production ổn định.

## 13. Lộ trình triển khai sau Phase 1

### Phase 2 — Database nền tảng

- Viết audit SQL chỉ đọc.
- Tạo bảng phiên bản quy tắc và cột snapshot.
- Mở rộng ledger bằng định danh nguồn/action/reversal.
- Viết RPC V2 transaction-safe và unique constraints.
- Siết quyền RPC và RLS loyalty.
- Viết script backfill có thể chạy lại an toàn.
- Chưa chuyển frontend production sang V2.

### Phase 3 — Service và website/QR

- Thêm service wrapper V2.
- Lưu đủ snapshot và `pointsSpent`.
- Chuyển web/QR sang RPC V2 bằng feature flag.
- Sửa read model và hiển thị dấu điểm.

### Phase 4 — POS và đối tác

- Chuyển POS spend/earn/reversal sang contract chung.
- Chuyển claim đối tác sang nguồn `PARTNER_ORDER`.
- Bỏ tham số override tỷ lệ ở client.
- Xác nhận các kênh cho cùng kết quả với cùng dữ liệu đầu vào.

### Phase 5 — Đối soát và bù dữ liệu

- Audit các đơn hoàn tất chưa có earn.
- Audit spend chưa có reversal và earn cần thu hồi.
- Lập danh sách dry-run để anh duyệt.
- Chỉ sau khi duyệt mới chạy bù điểm bằng sự kiện có idempotency.

### Phase 6 — Dọn legacy

- Theo dõi production và đối chiếu ledger/account.
- Tắt đường ghi local/legacy.
- Thu hồi RPC/quyền cũ sau thời gian ổn định.
- Không xóa dữ liệu lịch sử.

## 14. Tiêu chí bắt buộc trước khi vào Phase 2

Phase 1 được xem là đạt khi:

- [x] Đã xác định đúng nguồn sự thật cho khách, đơn, ledger và tài khoản.
- [x] Đã chốt `source_type + source_order_id`; không dùng mã hiển thị làm định danh.
- [x] Đã chốt điều kiện chỉ cộng điểm khi hoàn tất.
- [x] Đã chốt công thức tiền đủ điều kiện và snapshot quy tắc.
- [x] Đã chốt action cộng, trừ, hoàn và thu hồi.
- [x] Đã chốt transaction và unique idempotency tại database.
- [x] Đã chốt không truyền phone/points/amount từ client cho RPC đơn hàng.
- [x] Đã chốt nguyên tắc RLS và quyền actor.
- [x] Đã có snapshot đối chiếu trước migration.
- [x] Đã có kế hoạch tương thích và rollback theo feature flag.

## 15. Bộ kiểm thử chấp nhận cho Loyalty V2

Tối thiểu phải có các ca sau trước khi bật production:

1. Web hoàn tất cộng đúng một lần.
2. POS hoàn tất cộng đúng một lần.
3. QR hoàn tất cộng đúng một lần.
4. Partner chưa hoàn tất không claim được.
5. Partner hoàn tất claim đúng một lần bằng `partner_orders.id`.
6. Hai request đồng thời cho cùng action chỉ tạo một ledger.
7. Đơn dùng điểm nhưng không đủ số dư bị từ chối toàn bộ giảm loyalty.
8. Hủy trước hoàn tất hoàn đúng điểm đã dùng.
9. Hủy sau hoàn tất thu hồi earn và hoàn spend đúng một lần.
10. Đổi tỷ lệ không làm thay đổi điểm của đơn đã có snapshot.
11. Tỷ lệ 10% cho đơn đủ điều kiện 100.000đ tạo 10.000 điểm.
12. `sum(ledger.points)` luôn bằng `loyalty_accounts.total_points`.
13. Customer không đọc được ledger của số điện thoại khác.
14. `anon` không ghi/sửa/xóa trực tiếp ledger hoặc tài khoản.
15. UI hiển thị đúng dấu cộng, trừ, hoàn và thu hồi.
16. Migration giữ nguyên tổng số dư và không cộng lại đơn legacy.

## 16. Quyết định cuối Phase 1

Phương án lâu dài được chọn là một hệ thống event ledger thống nhất, một RPC façade theo action cho mọi nguồn đơn, và các adapter đọc đơn theo từng bảng. Đây không phải thêm một RPC vá lỗi: database trở thành nơi duy nhất quyết định khách nào, đơn nào, trạng thái nào, quy tắc nào và số điểm bao nhiêu.

Phase 2 chỉ được bắt đầu bằng audit SQL và migration có khả năng chạy lại. Không chuyển traffic production cho đến khi các kiểm thử transaction, idempotency, RLS và đối chiếu dữ liệu đều đạt.
