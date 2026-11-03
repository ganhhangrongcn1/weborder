# Quy trình build Android POS trên Cloud

Cập nhật: 20/10/2026 (Asia/Bangkok).

## Ghi nhớ yêu cầu của anh

Build APK Android trên GitHub Actions của repo `ganhhangrongcn1/weborder`. Đây là quy trình đã chạy thành công, không cần hỏi lại anh build ở máy nào hoặc khóa ký nằm ở đâu. Khi anh yêu cầu build, tự thực hiện các bước đã được cho phép; chỉ báo lại nếu thực sự thiếu quyền và cần anh xử lý đúng bước bị chặn.

Không kết luận Cloud không build được chỉ vì workspace hiện tại thiếu SDK, Gradle, node_modules hoặc file ký. Khóa ký release đã được chuyển vào GitHub Actions Secrets; không lấy khóa mới, không dùng debug key, không yêu cầu gửi mật khẩu/khóa qua chat.

## Nguồn code và trạng thái bản hiện tại

Luôn kiểm tra remote trước khi sửa. Workspace có thể cũ hơn Cloud. So sánh main, bản đã build gần nhất và các thay đổi chưa merge; chỉ ghép thay đổi của tác vụ, giữ các sửa lỗi in, tích điểm và các tính năng mới hơn.

Bản APK đã build thành công ngày 20/10/2026:

- Phiên bản: **0.4.27**, versionCode **58**, applicationId `vn.ghr.posmobile`.
- Nguồn: `codex/pos-cashier-web-orders-0.4.27`.
- Commit build: `43873146edc8c8da77382492d59da46d69862ab6`.
- PR: https://github.com/ganhhangrongcn1/weborder/pull/8
- Build thành công: https://github.com/ganhhangrongcn1/weborder/actions/runs/39414186742
- Artifact: `GHR-POS-0.4.27-release`, ID `12261160910`, chứa APK và `SHA256SUMS`.
- SHA-256 APK: `1b4f832691e81f04d5aa207979b7e6af56320cbd3fc332234a447ee4655c7d70`.
- File đã giao trong workspace của chat này: `/workspace/releases/GHR-POS-0.4.27/GHR-POS-0.4.27.apk`. Đường dẫn chỉ dùng khi file còn tồn tại; artifact GitHub giữ 14 ngày, không coi là kho lưu vĩnh viễn.
- Đã kiểm tra package/version, chữ ký khớp bản cũ và checksum file tải về. Chưa xác nhận chạy thực tế trên thiết bị của quán.
- **Tại thời điểm ghi chú, PR #8 chưa merge. Main vẫn có POS 0.4.26.** Đây là ghi chú trạng thái, phải kiểm tra lại khi tiếp tục. Không lấy main cũ rồi ghi đè bản 0.4.27.
- Build APK không đồng nghĩa đã cập nhật kênh tải trong app, publish release hoặc deploy website. Những bước đó chưa làm trong tác vụ này.

Bản 0.4.27 bỏ nút chọn chế độ và luôn chạy thu ngân; bỏ qua chế độ phone đã lưu. Điện thoại vẫn chạy được app nhưng dùng chế độ thu ngân. Giữ xử lý các đơn đã tạo từ chế độ phone trước đây. Đọc phân trang đủ đơn trong ngày của chi nhánh trước khi lọc đơn web; giữ danh sách cũ nếu tải lỗi. Anh muốn sau này làm app riêng cho nhân viên order, chưa yêu cầu làm app riêng trong tác vụ này.

## Khóa ký và chốt duyệt commit

Workflow: `.github/workflows/pos-android-release.yml`, tên **POS Android release**, trigger `workflow_dispatch`.

Secrets hiện có trong repo:

- `POS_KEYSTORE_BASE64`
- `POS_SIGNING_PROPERTIES_BASE64`

Variables:

- `POS_RELEASE_CERT_SHA256`: fingerprint chứng chỉ release cũ; không thay đổi tùy tiện.
- `POS_RELEASE_APPROVED_SHA`: SHA chính xác của commit cần build.

Workflow chỉ chạy khi `github.sha == vars.POS_RELEASE_APPROVED_SHA` và checkout chính commit được duyệt. Vì vậy mỗi commit build mới cần cập nhật biến duyệt. Commit chỉ sửa tài liệu không phải lý do để thay SHA bản APK đã build. Không bỏ chốt này để xử lý lỗi quyền.

Gradle nhận đường dẫn file ký từ `GHR_POS_RELEASE_SIGNING_PROPERTIES`. Workflow giải mã secrets vào thư mục tạm, sửa đường dẫn storeFile cho runner, xóa sau build và xác minh chứng chỉ APK. Không đưa secrets vào Git, log hoặc artifact.

## Các bước thực hiện lần sau

1. Đọc ghi chú này và workflow tại ref thực tế. Xác minh phiên bản remote và bản release mới nhất; không dùng workspace cũ làm toàn bộ nguồn phát hành.
2. Sửa trên nhánh riêng từ nguồn hiện tại, kiểm tra diff và test phù hợp. Tăng versionCode cao hơn bản đã phát hành; cập nhật versionName và các kiểm tra/tên artifact trong workflow cùng lúc.
3. Đồng bộ commit đã kiểm tra lên GitHub. User đã yêu cầu build thì tiếp tục các thao tác cần thiết trong phạm vi đó, không xin lại xác nhận chung về Cloud.
4. Cập nhật `POS_RELEASE_APPROVED_SHA` bằng đúng SHA commit build đã kiểm tra.
5. Dispatch workflow với đúng nhánh, theo dõi đến khi thành công hoặc lỗi. Nếu job `skipped`, kiểm tra SHA nhánh so với biến duyệt.
6. Nếu lỗi, đọc log, xử lý nguyên nhân và chạy lại trong phạm vi được phép. Nếu code thay đổi thì cập nhật SHA duyệt mới.
7. Lấy artifact, xác minh `sha256sum -c SHA256SUMS`. Chỉ giao APK khi build/package/version/certificate verification thành công.
8. Gửi link tải APK và ghi lại commit, run URL, version, checksum, trạng thái merge/publication. Cùng khóa ký và versionCode cao hơn cho phép cài cập nhật đè, không hướng dẫn gỡ app cũ.

## Lệnh tham khảo

Dùng GitHub CLI đã được cấu hình; không in token ra log. Trong môi trường managed, kiểm tra `cloud_environment.environment_status`, giữ proxy được cấp và xin quyền network của exec nếu sandbox chặn socket. Khả năng CLI/token có thể thay đổi giữa các lượt chat; kiểm tra trước khi kết luận thiếu công cụ.

```bash
gh variable set POS_RELEASE_APPROVED_SHA --repo ganhhangrongcn1/weborder --body <reviewed-commit-sha>
gh workflow run pos-android-release.yml --repo ganhhangrongcn1/weborder --ref <release-branch>
gh run list --repo ganhhangrongcn1/weborder --workflow pos-android-release.yml --branch <release-branch> --limit 1
gh run watch <run-id> --repo ganhhangrongcn1/weborder --interval 20 --exit-status
gh run download <run-id> --repo ganhhangrongcn1/weborder --name <artifact-name> --dir <output-dir>
```

Nếu CLI không tải được artifact qua redirect, dùng connector `github.download_workflow_artifact` theo artifact ID. Công cụ này đã tải thành công ZIP trong tác vụ 0.4.27 khi CLI trả Forbidden ở URL artifact.

## Lỗi quyền đã gặp và cách xử lý đúng

Ngày 20/10/2026, GitHub CLI/token có thể đọc repo và dispatch workflow nhưng sửa `POS_RELEASE_APPROVED_SHA` trả HTTP 403 `Resource not accessible by integration`. Lượt build đầu bị skipped, không phải lỗi code hoặc thiếu khóa ký.

Anh đã tự sửa biến ở https://github.com/ganhhangrongcn1/weborder/settings/variables/actions rồi báo lưu xong; agent dispatch lại và build thành công. Lần sau thử quyền hiện tại trước, không mặc định bắt anh sửa. Nếu vẫn 403, báo chính xác biến, giá trị SHA cần lưu và đường dẫn; không hỏi lại cả quy trình build hay xin lại khóa ký.

Lỗi dispatch HTTP 503 từng hết sau một lần thử lại. Không lặp vô hạn. Nếu không có quyền/API cần thiết thì nói rõ còn bước nào chưa làm, không báo build xong khi chưa có APK.
