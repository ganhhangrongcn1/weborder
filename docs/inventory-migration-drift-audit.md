# Audit lệch lịch sử migration trước khi triển khai Kho

Ngày audit: 2026-08-24
Phạm vi: Supabase project đang link với repository GHR VER 5
Chế độ: Audit chỉ đọc; riêng ngày 2026-08-24 đã được phê duyệt và thực hiện `migration repair` cho đúng 15 version local-only. Chưa chạy `db push`, `db pull` hoặc SQL mutation.

## Kết luận

Hai migration Kho đã triển khai production ngày 2026-08-24. Local và remote đã được đồng bộ phần lịch sử có đủ bằng chứng; hai cặp loyalty redemption đã được chuẩn hóa timestamp local theo production sau khi xác nhận lại hash khớp tuyệt đối.

1. Cùng tên nghiệp vụ nhưng khác timestamp.
2. Chỉ có file local, chưa có bản ghi migration remote cùng tên.
3. Chỉ có bản ghi remote, không có file local cùng tên.

Production hiện có 0 bảng, 0 function, 0 policy và 0 trigger mang tiền tố `inventory_`, nên việc dừng deploy Kho không ảnh hưởng dữ liệu kho thực tế.

## Nhóm A — Cùng tên nhưng khác timestamp

Các cặp dưới đây có khả năng là cùng migration được tạo hoặc ghi nhận lại với timestamp khác. Phải so sánh nội dung/đối tượng database trước khi repair history.

| Tên migration | Local | Remote |
|---|---:|---:|
| `cleanup_print_jobs` | 20260721073654 | 20260721073804 |
| `add_nexpos_ready_sync` | 20260722001232 | 20260722001928 |
| `create_nexpos_shadow_sync` | 20260722030242 | 20260722030423 |
| `add_nexpos_shadow_hub_registry` | 20260722030725 | 20260722030752 |
| `add_nexpos_shadow_retention` | 20260722030859 | 20260722030921 |
| `review_reward_claims` | 20260731073417 | 20260731073926 |
| `review_reward_loyalty_award` | 20260731075457 | 20260731075604 |
| `review_reward_service_role_grants` | 20260731084600 | 20260731085020 |
| `review_reward_set_5000_points` | 20260731091000 | 20260731091023 |
| `allow_pos_mobile_atomic_loyalty_completion` | 20260803064243 | 20260803064349 |
| `partner_review_worker_settings` | 20260804040654 | 20260804040954 |
| `partner_review_busy_toggle` | 20260804042312 | 20260804042551 |
| `partner_review_store_control` | 20260804044500 | 20260804044434 |
| `partner_grab_finance_transactions` | 20260805020658 | 20260805021018 |
| `allow_configurable_loyalty_redemption_percent` | 20260815012523 | 20260815012613 |
| `use_active_loyalty_redemption_percent_for_orders` | 20260815012711 | 20260815012832 |
| `loyalty_points_rolling_60_day_expiry` | 20260818000639 | 20260818001614 |

### Dấu chân object cần đối chiếu

| Nhóm migration | Object production cần kiểm tra | Rủi ro nếu chạy lại nhầm |
|---|---|---|
| Cleanup print jobs | `public.cleanup_print_jobs`, 2 unique index `print_jobs_*`, cron cleanup | Có `UPDATE`/`DELETE` dữ liệu print job và lịch cron |
| NexPOS ready/shadow | `partner_orders`, `integration_sessions`, `nexpos_shadow_*`, cron shadow/retention | Có seed, cron, retention delete và bảng đang phục vụ worker |
| Review reward | `review_reward_settings`, `review_reward_claims`, bucket proof, `approve_review_reward_claim` | Có seed settings, Storage bucket và RPC cộng điểm |
| POS atomic loyalty | `complete_website_order_with_loyalty(text,text)` | Thay toàn bộ function hoàn tất đơn và loyalty |
| Partner review | `partner_review_worker_settings`, các cột busy/store-control của `partner_review_sources` | Ảnh hưởng worker và điều khiển cửa hàng |
| Grab Finance | `partner_grab_finance_transactions` và các index ngày/chi nhánh | Ảnh hưởng luồng đồng bộ/báo cáo Finance |
| Loyalty redemption | `activate_loyalty_program_version`, `loyalty_private.get_loyalty_max_redemption_percent` | Ảnh hưởng giới hạn đổi điểm của Web/POS |
| Rolling expiry | `loyalty_private.point_lots`, allocations, trigger ledger, cron expiry | Có backfill, trigger, cron và cập nhật số điểm thật |

Do các file này chứa `UPDATE`, `DELETE`, seed, trigger hoặc cron, tuyệt đối không dùng cách “chạy lại xem có lỗi không” để xác nhận tương đương.

### Kết quả so hash nội dung

Hash được tính sau khi bỏ toàn bộ khoảng trắng để loại trừ CRLF và format.

- **13/17 cặp khớp tuyệt đối:** cleanup print jobs; 4 migration NexPOS; review reward service grants; review reward 5.000 điểm; partner review worker settings; partner review store control; Grab Finance transactions; 2 migration loyalty redemption; rolling 60-day expiry.
- **4/17 cặp không khớp:** `review_reward_claims`, `review_reward_loyalty_award`, `allow_pos_mobile_atomic_loyalty_completion`, `partner_review_busy_toggle`.

### Nguyên nhân của 4 cặp không khớp

| Migration | Chênh lệch xác nhận được | Đánh giá |
|---|---|---|
| `review_reward_claims` | Remote lịch sử dùng mặc định 100 điểm và chưa có hai grant service-role; file local đã đổi thành 5.000 điểm và thêm grant | File lịch sử local đã được cập nhật ngược; production nhận 5.000 điểm/grant qua migration sau |
| `review_reward_loyalty_award` | Logic giống nhau; literal tiếng Việt trong SQL remote bị mojibake, local đã sửa UTF-8 | Không nên coi là hash-equivalent; cần giữ lịch sử và bản sửa encoding tách biệt |
| `allow_pos_mobile_atomic_loyalty_completion` | Logic giống nhau; message tiếng Việt remote bị mojibake, local đã sửa UTF-8 | Không nên chạy lại function đang phục vụ POS chỉ để sửa history |
| `partner_review_busy_toggle` | DDL giống nhau; comment remote bị mojibake, local là UTF-8 đúng | Chỉ khác comment nhưng vẫn là nội dung lịch sử khác |

Kết luận: 11 cặp hash-equivalent đã được chuẩn hoá timestamp ở local ngày 2026-08-24. Hai file loyalty redemption cũng hash-equivalent nhưng đang là file untracked thuộc worktree có sẵn nên được giữ nguyên tên, không đưa vào phạm vi Kho. Đây chỉ là đổi tên file đã được Git theo dõi, không chạy SQL và không sửa production. Bốn cặp còn lại phải xử lý riêng; không được che chênh lệch bằng cách chỉ đổi tên file.

### Object production đã xác nhận tồn tại

Đã kiểm tra chỉ bằng catalog, không đọc dữ liệu nghiệp vụ:

- `integration_sessions`
- `nexpos_shadow_sync_control`, `nexpos_shadow_orders`, `nexpos_shadow_sync_runs`, `nexpos_shadow_hubs`
- `review_reward_settings`, `review_reward_claims`
- `partner_review_worker_settings`
- `partner_grab_finance_transactions`
- `loyalty_private.point_lots`, `loyalty_private.point_lot_allocations`
- `cleanup_print_jobs`, `approve_review_reward_claim`, `get_loyalty_max_redemption_percent`

## Nhóm B — Chỉ thấy ở local

Chưa được phép kết luận các migration này chưa chạy. Một số có thể đã được chạy thủ công hoặc được thay bằng migration remote tên khác.

- `momo_webhook_logs`
- `grant_service_role_read_partner_automation_config`
- `secure_nexpos_shadow_cron_authorization`
- `optimize_admin_business_analytics`
- `review_reward_branch_guard`
- `review_reward_google_maps`
- `review_reward_google_points`
- `allow_jpeg_review_reward_proofs`
- `allow_png_review_reward_proofs`
- `allow_review_reward_resubmission`
- `partner_grab_finance_snapshots`
- `add_grab_finance_delivery_discount`
- `partner_review_reply_commands`
- `normalize_empty_partner_review_replies`
- `grant_web_order_notification_service_role`

### Kết quả kiểm tra production

Toàn bộ 15 migration local-only đã có trạng thái đích trên production:

| Migration/nhóm | Bằng chứng chỉ đọc |
|---|---|
| `momo_webhook_logs` | Bảng production tồn tại |
| Grant `app_configs` | `service_role` có quyền SELECT |
| NexPOS cron authorization | Cron hiện có Authorization và đọc secret theo tên cấu hình |
| Admin business analytics | Helper tồn tại; overload 4 tham số hiện tại đang gọi helper |
| Review branch guard | Function hiện tại có điều kiện giới hạn `branch_uuid` người duyệt |
| Google Maps review reward | Constraint subject, unique index theo branch và cột Google points tồn tại |
| JPEG/PNG proof | Bucket hiện cho phép WebP, JPEG và PNG |
| Review resubmission | Cột `resubmit_until` tồn tại |
| Grab Finance snapshots | Bảng production tồn tại |
| Grab delivery discount | Cột `delivery_discount` tồn tại |
| Partner review reply commands | Bảng production tồn tại |
| Normalize empty replies | Hiện có 0 dòng Grab với `replies = [null]`; bằng chứng trạng thái đích, không chứng minh duy nhất migration đã chạy |
| Web notification grant | RLS bật và `service_role` có SELECT/INSERT/UPDATE |

Kết luận: 14 migration có bằng chứng object/quyền/function mạnh; migration normalize replies có bằng chứng trạng thái dữ liệu đích. Không cần và không được chạy lại 15 SQL này. Phương án phù hợp là đánh dấu version `applied` trong migration history sau khi được duyệt.

### Repair đã thực thi — 2026-08-24

```text
supabase migration repair --linked --status applied \
  20260720074037 20260726035216 20260727082715 20260727125217 \
  20260731080203 20260801090000 20260801124538 20260802080511 \
  20260802082324 20260802082943 20260805011228 20260805022248 \
  20260806062818 20260807021451 20260815021124
```

Lệnh đã được thực thi sau khi người dùng phê duyệt. Kết quả: cả 15 version đã được đánh dấu `applied`; lệnh không chạy nội dung SQL migration. Postcheck `migration list --linked` xác nhận 15 version khớp Local/Remote. Truy vấn catalog sau repair tiếp tục cho kết quả 0 bảng, 0 function, 0 policy và 0 trigger `inventory_*`.

Ba file loyalty ngày 15/08 đang là file chưa được Git theo dõi trong worktree; phải giữ nguyên phạm vi và không gộp vào công việc Kho.

## Nhóm C — Chỉ thấy ở remote

Các file dưới đây đã được khôi phục từ chính `supabase_migrations.schema_migrations` vào local ngày 2026-08-24. Không migration nào được thực thi lại.

- `secure_pos_app_releases`
- `admin_crm_analytics_cache`
- `fix_admin_dashboard_operational_status_refresh`
- `harden_admin_dashboard_rpc_search_path`
- `partner_grab_conversion_funnel`
- `add_site_visit_traffic_period_stats`
- `secure_site_visit_traffic_stats_search_path`
- `partner_grab_marketing_api_archive`

Hai file dashboard trong history remote có literal mojibake `Chưa xác định`. Bản local phục hồi dùng UTF-8 đúng theo quy tắc dự án; vì vậy version/name khớp nhưng hash hai file này được ghi nhận là khác có chủ đích. Production không bị cập nhật trong bước phục hồi.

## Kiểm tra bắt buộc trước khi repair

- [x] Đọc hash SQL lịch sử remote và so với 17 file local sau khi chuẩn hoá khoảng trắng.
- [x] Đọc SQL remote của bốn migration khác nội dung và xác định nguyên nhân chênh lệch.
- [x] Lập dấu chân object local cho 17 cặp cùng tên khác timestamp.
- [x] So sánh với SQL local tương ứng, không chỉ so tên file.
- [x] Xác định 15 migration local-only đã có trạng thái đích, không chạy lại SQL.
- [x] Xác minh trạng thái đích của 15 migration local-only bằng catalog/quyền/function và một số đếm tổng hợp.
- [x] Đã được duyệt và đánh dấu đúng 15 version local-only là `applied` trong remote history.
- [x] Khôi phục 8 file remote-only bằng lệnh fetch chính thức trong thư mục tạm; sửa đúng 8 literal mojibake ở hai file dashboard local.
- [ ] Chạy postcheck cho POS payment, print jobs, NexPOS, review rewards, dashboard, Grab, loyalty và notification.
- [x] Lập bản đồ repair, được duyệt và postcheck lịch sử ngay sau thay đổi.
- [ ] Chỉ tạo migration Kho sau khi `migration list` không còn lệch chưa giải thích được.

## Những lệnh tiếp tục bị cấm khi chưa có phê duyệt mới

```text
supabase migration repair <ngoài đúng 15 version đã duyệt>
supabase db push
supabase db reset --linked
supabase db query <SQL mutation>
```

## Bước kế tiếp

Giữ nguyên hai file loyalty redemption untracked ngoài phạm vi Kho và chưa `db push`. Bước tiếp theo của Phase 1 là chốt hợp đồng nghiệp vụ kho và thiết kế schema/RLS ở local trước; mọi triển khai production phải có audit và phê duyệt riêng.

## Bổ sung từ kiểm thử Supabase local — 2026-08-24

Khi dựng database trắng bằng Supabase CLI/PostgreSQL 17, chuỗi migration hiện tại dừng tại `20260614131538_pos_payment_sessions_phase_1.sql`: migration tạo index `sepay_webhook_logs_payment_session_idx` trên `public.sepay_webhook_logs` trước khi bảng này tồn tại. Đây là lỗi thứ tự/phụ thuộc của lịch sử local, không phải lỗi của schema Kho.

Để giữ phạm vi an toàn, lần kiểm thử Kho đầu tiên đã tắt tự chạy migration local, dùng database trắng, tạo duy nhất bảng `branches` tối thiểu rồi nạp riêng schema Kho. Chưa sửa migration thanh toán, chưa `db push`, chưa thay đổi production.

## Xác minh nguyên nhân và kiểm thử trên schema production rỗng — 2026-08-24

Truy vấn catalog chỉ đọc xác nhận production hiện có `profiles`, `branches`, `orders`, `sepay_webhook_logs` và `pos_payment_sessions`. Migration history production bắt đầu từ version `20260614131538`, trong khi repo không có migration baseline tạo bốn bảng nền đầu tiên. Vì vậy production chạy được do các object nền đã tồn tại trước lịch sử migration hiện tại; database local trắng thì không có các object đó.

Không thêm một migration baseline giả vào đầu chuỗi và không sửa ngược migration thanh toán đã áp dụng. Hai cách này có thể làm `db push` hiểu sai lịch sử hoặc đưa snapshot hiện tại chạy lại trên production.

Phương án kiểm thử an toàn đã thực hiện:

1. Dump schema-only của `public`, `private`, `loyalty_private`, `maintenance`; không lấy bất kỳ dữ liệu khách hàng hoặc đơn hàng nào.
2. Khởi động Supabase local tách riêng với tự chạy migration và seed bị tắt.
3. Nạp schema snapshot trong một transaction.
4. Nạp riêng `20260824030247_inventory_phase1_engine.sql`.
5. Chạy postcheck, smoke test và concurrency/lost-response test.

Kết quả:

- Migration Kho nạp thành công trên PostgreSQL 17.6 đúng phiên bản production.
- Postcheck xác nhận 14 public wrapper, 14 private implementation, RLS bật và frontend không có quyền ghi trực tiếp movement/balance/snapshot/event/operation.
- Smoke test nhập, xuất, chuyển, yêu cầu cấp hàng và kiểm kê qua; tồn đối chiếu 69/26; dữ liệu test rollback.
- Concurrency test có bốn kết quả `PASS`: cùng phiếu chỉ ghi một lần, hai phiếu tranh tồn chỉ một phiếu hoàn tất, retry sau mất phản hồi là idempotent replay.
- Advisor không trả cảnh báo nào cho `inventory_*`. Lint còn lỗi/cảnh báo cũ ở CRM/loyalty/profile, được giữ ngoài phạm vi Kho.

Chuỗi migration toàn hệ vẫn cần một dự án baseline riêng trước khi có thể coi `db reset` từ database trắng là tiêu chuẩn phát hành. Việc đó không phải lý do để sửa ngược migration POS/SePay trong phạm vi Kho.

## Cập nhật triển khai production — 2026-08-24

- Hash chuẩn hóa của hai file Loyalty local khớp tuyệt đối với statement production; chỉ timestamp khác.
- Đã đổi timestamp local sang `20260815012613` và `20260815012832`; không chạy lại SQL Loyalty và không repair history production.
- `db push --dry-run` sau chuẩn hóa chỉ liệt kê `20260824030247_inventory_phase1_engine.sql` và `20260824060412_inventory_phase3_foundation.sql`.
- Lượt push đầu dừng tại statement 0 vì BOM UTF-8 của file Phase 1, nên chưa có DDL nào được áp dụng. Sau khi bỏ BOM và dry-run lại, cả hai migration triển khai thành công.
- Postcheck production Phase 1 và Phase 3 đạt; 14 bảng Kho rỗng, Security Advisor không có cảnh báo `inventory_*`, cờ ghi Kho vẫn tắt.
