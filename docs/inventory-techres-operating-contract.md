# Hợp đồng vận hành Kho GHR theo tham chiếu Techres

Ngày chốt bản đầu: 2026-08-24
Phạm vi: thiết kế local cho `inventory-app` và schema `inventory_*`
Trạng thái production: schema Kho, RLS, chứng từ, movement, balance và bộ bảo vệ quy đổi đơn vị đã được triển khai ngày 2026-08-25.

## Nguyên tắc tham chiếu

GHR bám Techres ở ba phần:

1. Cấu trúc module và đường đi nghiệp vụ.
2. Chuỗi trạng thái chứng từ từ tạo, duyệt, giao/nhận đến hoàn tất.
3. Khả năng truy ngược tồn kho về chứng từ, người thao tác và thời điểm phát sinh.

GHR không sao chép nguyên giao diện hoặc toàn bộ độ phức tạp của ERP. Mỗi phase chỉ mở chức năng khi engine chứng từ và kiểm tra đối chiếu đã an toàn.

## Bản đồ module và router đích

| Nghiệp vụ | Techres tham chiếu | Router GHR đích | Ghi chú |
|---|---|---|---|
| Danh sách kho | `/inventory/warehouses` | `/admin/inventory/warehouses` | Kho trung tâm, chi nhánh, bộ phận hoặc lưu động |
| Hàng hóa | `/inventory/items` | `/admin/inventory/items` | Nguyên liệu, bao bì, bán thành phẩm, thành phẩm |
| Nhóm hàng | `/inventory/item-categories` | `/admin/inventory/item-groups` | GHR giữ tên bảng `inventory_item_groups` |
| Đơn vị | `/inventory/units` | `/admin/inventory/units` | Có đơn vị gốc và tỷ lệ quy đổi |
| Nhập kho | `/inventory/stock-in` | `/admin/inventory/receipts` | Tồn đầu, nhập mua, nhập hoàn |
| Xuất kho | `/inventory/stock-out` | `/admin/inventory/issues` | Hao hụt, hủy, dùng nội bộ; không dùng thay phiếu chuyển |
| Chuyển kho | `/production/transfers` | `/admin/inventory/transfers` | Giao và nhận là hai mốc tồn riêng |
| Yêu cầu nội bộ | `/inventory/internal-requisitions` | `/admin/inventory/requisitions` | Yêu cầu không tự làm thay đổi tồn |
| Tồn hiện tại | `/inventory/stock-levels` | `/admin/inventory/stock-levels` | Chỉ đọc từ balance do engine cập nhật |
| Cảnh báo | `/inventory/stock-alerts` | `/admin/inventory/alerts` | Tồn thấp, âm, hạn dùng và độ bao phủ |
| BOM | `/production/boms` | `/admin/inventory/boms` | Chỉ mở sau khi nhập–xuất–chuyển ổn định |
| Lệnh sản xuất | `/production/orders` | `/admin/inventory/production-orders` | Ngoài MVP đầu tiên |
| Đối chiếu đơn | `/inventory/order-reconciliation` | `/admin/inventory/reconciliation` | Đơn thiếu BOM, chưa trừ hoặc trừ lỗi |

Router trên là hợp đồng đích. `inventory-app` hiện vẫn dùng `activePage` trong React state; chưa thay router ở Phase 1.

## Nguồn dữ liệu chuẩn

- `inventory_documents` là phần đầu chứng từ.
- `inventory_document_lines` là số lượng dự kiến, thực tế và quy đổi về đơn vị gốc.
- `inventory_stock_movements` là sổ biến động bất biến.
- `inventory_stock_balances` là số tồn hiện tại được cập nhật trong cùng transaction với movement.
- UI không được insert/update/delete trực tiếp movement hoặc balance.
- Chứng từ đã phát sinh movement không được sửa dòng hoặc xóa. Sai sót phải tạo chứng từ đảo hoặc điều chỉnh có liên kết chứng từ gốc.
- Mọi thao tác hoàn tất phải có `idempotency_key`; gửi lại cùng khóa phải trả cùng kết quả và không ghi tồn lần hai.

## Hợp đồng quy đổi đơn vị

Đây là quy tắc bắt buộc cho mọi luồng nhập, xuất, chuyển, hủy, kiểm kê, điều chỉnh, BOM và sản xuất:

1. Mỗi nguyên vật liệu có đúng một **đơn vị gốc nhỏ nhất** để lưu tồn, ví dụ `Gram`, `ml`, `cái`.
2. `inventory_stock_balances.quantity`, `inventory_stock_movements.quantity` và `inventory_document_lines.base_quantity` luôn lưu bằng đơn vị gốc.
3. Số nhân viên nhập được lưu cùng `unit_id`; `conversion_to_base` là ảnh chụp hệ số tại thời điểm lập chứng từ.
4. Công thức duy nhất: `base_quantity = quantity × conversion_to_base`.
5. Supabase là nơi quyết định hệ số cuối cùng:
   - Dùng đơn vị gốc → hệ số `1`.
   - Đơn vị thuộc cùng hệ và trỏ về đơn vị gốc → dùng `inventory_units.conversion_factor`.
   - Đơn vị mua mang tính riêng theo nguyên vật liệu → dùng `purchase_to_base_ratio` khi không có hệ số chung phù hợp.
   - Khác hệ đơn vị → từ chối ghi chứng từ.
6. Trigger `inventory_normalize_document_line_unit` chuẩn hóa lại mọi dòng chứng từ trước khi ghi; frontend không được tự quyết định hệ số cuối cùng.
7. Phiếu điều chỉnh không có bộ chọn đơn vị riêng thì luôn dùng `display_unit_id`, sau đó Supabase tự quy đổi về đơn vị gốc.
8. Báo cáo chỉ đổi cách nhìn: `display_quantity = base_quantity ÷ conversion_to_base`; không sửa số tồn gốc.
9. Giá vốn bình quân lưu theo một đơn vị gốc; giá vốn hiển thị theo kg/thùng bằng `base_average_cost × conversion_to_base`.
10. Không làm tròn trước khi ghi đơn vị gốc. Database dùng `numeric(18,6)`; UI chỉ làm tròn khi hiển thị.

Ví dụ chuẩn: tồn `1.000 gram`, điều chỉnh tăng `1 kg`, hệ số `1.000` → movement tăng `1.000 gram` → tồn mới `2.000 gram` → báo cáo hiển thị `2 kg`.

## State machine chứng từ

### 1. Tồn đầu

```text
draft → submitted → completed
  └──────────────→ cancelled
```

- `draft`: được sửa dòng.
- `submitted`: chờ người có quyền duyệt, không cho nhân viên sửa tự do.
- `completed`: ghi movement `in` và tăng balance đúng một lần.
- Chỉ dùng khi khởi tạo kho/pilot; không dùng để chữa chênh lệch sau vận hành.

### 2. Nhập mua

```text
draft → submitted → completed
  └──────────────→ cancelled
```

- Bắt buộc kho đích, nhà cung cấp, ngày nhận và số lượng thực nhận.
- Đơn giá có thể bằng 0 khi chưa chốt hóa đơn nhưng phải xuất hiện trong danh sách cần bổ sung giá.
- `completed`: ghi movement `in`, tăng balance và cập nhật giá vốn theo phương pháp đã chốt.
- Phase đầu chưa ghi nhận công nợ nhà cung cấp.

### 3. Xuất hủy, hao hụt hoặc dùng nội bộ

```text
draft → submitted → completed
  └──────────────→ cancelled
```

- Bắt buộc kho nguồn và lý do xuất.
- `completed`: ghi movement `out` và giảm balance đúng một lần.
- Không dùng loại chứng từ này cho giao hàng sang kho khác.
- Nếu kho không cho tồn âm, transaction phải từ chối khi số khả dụng không đủ.

### 4. Chuyển kho

```text
draft → submitted → in_transit → received → completed
                               └→ received_with_variance → completed
draft/submitted ─────────────────────────────────────────→ cancelled
```

- `draft`: kho nguồn lập số lượng đề nghị giao.
- `submitted`: chờ duyệt/xác nhận xuất.
- `in_transit`: ghi movement `out` tại kho nguồn theo số thực giao.
- `received`: kho đích xác nhận nhận đủ; ghi movement `in` theo số thực nhận.
- `received_with_variance`: ghi nhận số thực nhận và lý do chênh lệch; không tự sửa số đã xuất ở kho nguồn.
- `completed`: khóa chứng từ. Nếu có chênh lệch, phải có người duyệt và kết quả xử lý trước khi hoàn tất.
- Hủy sau khi đã `in_transit` không được đổi thẳng sang `cancelled`; phải tạo luồng trả hàng hoặc chứng từ đảo.

### 5. Yêu cầu cấp hàng nội bộ

```text
draft → submitted → approved → fulfilled
                  └→ rejected
draft/submitted ──→ cancelled
```

- Yêu cầu cấp hàng không tạo movement và không cập nhật balance.
- `approved`: xác nhận kho nguồn và số lượng được duyệt.
- Khi kho nguồn chuẩn bị giao, hệ thống sinh phiếu chuyển có liên kết tới yêu cầu.
- `fulfilled`: phiếu chuyển liên quan đã hoàn tất.

### 6. Kiểm kê

```text
draft → counting → submitted → approved → completed
  └────────────────────────────────────→ cancelled
```

- `counting`: lưu snapshot tồn hệ thống tại thời điểm bắt đầu.
- `submitted`: khóa số đếm để chờ duyệt chênh lệch.
- `approved`: xác nhận lý do và người chịu trách nhiệm với chênh lệch.
- `completed`: sinh chứng từ điều chỉnh/movement theo chênh lệch; không ghi đè balance trực tiếp.
- Giao dịch phát sinh trong lúc kiểm kê phải được tính theo snapshot và thời điểm, không lấy balance hiện tại làm số đầu một cách im lặng.

## Quy tắc thời điểm ghi tồn

| Nghiệp vụ | Mốc ghi movement | Kho | Hướng |
|---|---|---|---|
| Tồn đầu | `completed` | Kho đích | `in` |
| Nhập mua/nhập hoàn | `completed` | Kho đích | `in` |
| Xuất hủy/hao hụt/dùng nội bộ | `completed` | Kho nguồn | `out` |
| Chuyển kho giao hàng | `in_transit` | Kho nguồn | `out` |
| Chuyển kho nhận hàng | `received` hoặc `received_with_variance` | Kho đích | `in` |
| Kiểm kê tăng | Hoàn tất điều chỉnh được duyệt | Kho kiểm kê | `in` |
| Kiểm kê giảm | Hoàn tất điều chỉnh được duyệt | Kho kiểm kê | `out` |
| Yêu cầu cấp hàng | Không ghi movement | — | — |

## Quyền vận hành tối thiểu

| Vai trò | Phạm vi chính |
|---|---|
| `owner` | Toàn bộ cấu hình, chứng từ, phân quyền và báo cáo |
| `admin` | Toàn bộ kho được hệ thống giao; quản lý danh mục và duyệt |
| `central_manager` | Kho trung tâm, mua hàng, duyệt/xuất chuyển |
| `branch_manager` | Kho chi nhánh được giao, nhận chuyển, kiểm kê và duyệt cấp chi nhánh |
| `staff` | Tạo nháp, nhập số đếm, giao/nhận khi được phân công; không tự duyệt chênh lệch |
| `viewer` | Chỉ xem đúng kho được giao |

RLS phải kiểm tra cả tài khoản và phạm vi kho. `TO authenticated` một mình không phải là phân quyền.

## Điều chỉnh schema cần làm trước khi viết engine

Schema MVP hiện tại cần được chỉnh ở local trước khi tạo migration production:

1. Bổ sung loại phiếu xuất dùng nội bộ rõ ràng, không gộp mơ hồ vào `stock_adjustment`.
2. Tách yêu cầu cấp hàng khỏi chứng từ làm thay đổi tồn hoặc thêm quan hệ nguồn rõ ràng.
3. Bổ sung số lượng thực giao/thực nhận cho phiếu chuyển; không dùng một `actual_quantity` cho cả hai đầu.
4. Bổ sung liên kết chứng từ gốc/chứng từ đảo và lý do đảo.
5. Bổ sung snapshot kiểm kê và trạng thái `counting`, `approved`, `received` nếu dùng chung bảng chứng từ.
6. Bổ sung cấu hình cho phép tồn âm theo kho và/hoặc mặt hàng.
7. Liên kết bằng `branch_id` tới khóa chính `branches.id`; giữ `branch_uuid` để tương thích nhận diện hiện tại. Không ép `branch_uuid` duy nhất vì một chi nhánh có thể có nhiều kho bộ phận.
8. Chỉ cấp quyền SELECT trực tiếp cho balance/movement; mọi ghi thông qua RPC transaction.
9. Khi triển khai bảng mới, cấp quyền Data API rõ ràng cho `authenticated` và luôn giữ RLS bật.

## Chưa kích hoạt trong Phase 1

- BOM và tự trừ nguyên liệu theo đơn.
- Lệnh sản xuất nhiều công đoạn.
- Lô/hạn dùng và FIFO đầy đủ.
- Tự động đặt mua và công nợ nhà cung cấp.
- Realtime rộng trên toàn bộ sổ movement.

Các phần này vẫn có route/mô hình tham chiếu Techres nhưng chỉ được mở sau khi engine nhập–xuất–chuyển–kiểm kê vượt qua kiểm thử idempotency và đối chiếu sổ kho.

## Tiêu chí kiểm thử bắt buộc cho engine

- Bấm hoàn tất hai lần chỉ có một bộ movement.
- Hai người hoàn tất cùng lúc chỉ một transaction thắng.
- Mất mạng sau khi server hoàn tất, tải lại vẫn hiển thị đúng kết quả.
- Phiếu chuyển giảm kho nguồn và tăng kho đích ở đúng hai mốc đã chốt.
- Nhận lệch không làm biến mất phần chênh lệch.
- Không thể sửa/xóa dòng sau khi đã có movement.
- Tổng movement theo kho/mặt hàng giải thích được balance.
- Tài khoản chi nhánh không đọc hoặc ghi được kho khác.
