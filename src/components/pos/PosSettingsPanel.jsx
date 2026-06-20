export default function PosSettingsPanel({
  branchLabel = "",
  cashierName = "",
  online = true,
  printStationLabel = "",
  printStationTone = "idle",
  pendingOfflineOrderCount = 0,
  usingCachedCatalog = false,
  qrReady = false,
  printerTesting = false,
  printerTestMessage = "",
  printerTestTone = "",
  onTestPrinter
}) {
  const hasPrintStation = Boolean(printStationLabel);
  const offlineCount = Math.max(0, Number(pendingOfflineOrderCount || 0));

  return (
    <section className="pos-settings-grid">
      <article className="pos-settings-card is-wide pos-settings-hero">
        <span>Thiết lập POS</span>
        <strong>Kiểm tra nhanh trước ca bán</strong>
        <p>Thông tin ngân hàng, menu và phân quyền chi nhánh vẫn quản lý trong Admin.</p>
      </article>

      <article className="pos-settings-card">
        <span>Chi nhánh</span>
        <strong>{branchLabel || "Chưa xác định"}</strong>
        <p>POS và trạm in chỉ xử lý dữ liệu của chi nhánh đang đăng nhập.</p>
      </article>

      <article className="pos-settings-card">
        <span>Thu ngân</span>
        <strong>{cashierName || "Chưa xác định"}</strong>
        <p>Dùng tài khoản đăng nhập hiện tại để mở ca, tạo đơn và ghi nhận thao tác.</p>
      </article>

      <article className={`pos-settings-card ${hasPrintStation ? `is-${printStationTone}` : ""}`}>
        <span>Trạm in</span>
        <strong>{hasPrintStation ? printStationLabel : "Không chạy trên APK POS"}</strong>
        <p>{hasPrintStation ? "Máy này đang nhận lệnh in từ Kitchen/iPad qua print_jobs." : "Mở bằng APK POS để nhận lệnh in tự động từ chi nhánh."}</p>
        {typeof onTestPrinter === "function" ? (
          <div className="pos-settings-actions">
            <button type="button" disabled={printerTesting} onClick={onTestPrinter}>
              {printerTesting ? "Đang in test..." : "In bill test"}
            </button>
          </div>
        ) : null}
        {printerTestMessage ? (
          <small className={`pos-settings-message ${printerTestTone === "success" ? "is-success" : "is-error"}`} aria-live="polite">
            {printerTestMessage}
          </small>
        ) : null}
      </article>

      <article className={`pos-settings-card ${qrReady ? "is-ready" : "is-warning"}`}>
        <span>QR chuyển khoản</span>
        <strong>{qrReady ? "Đã cấu hình ngân hàng" : "Chưa đủ cấu hình"}</strong>
        <p>{qrReady ? "POS có thể tạo mã VietQR theo số tiền và mã bill." : "Cần kiểm tra bankBin, số tài khoản và tên tài khoản trong Admin."}</p>
      </article>

      <article className={`pos-settings-card ${online ? "is-ready" : "is-error"}`}>
        <span>Mạng & đồng bộ</span>
        <strong>{online ? "Online" : "Mất mạng"}</strong>
        <p>{offlineCount > 0 ? `${offlineCount} đơn tiền mặt đang chờ đồng bộ.` : "Không có đơn offline đang chờ đồng bộ."}</p>
      </article>

      <article className={`pos-settings-card ${usingCachedCatalog ? "is-warning" : "is-ready"}`}>
        <span>Menu bán hàng</span>
        <strong>{usingCachedCatalog ? "Đang dùng menu đã lưu" : "Đang dùng menu mới nhất"}</strong>
        <p>{usingCachedCatalog ? "POS vẫn bán được khi mất mạng, nhưng nên tải lại khi mạng ổn định." : "Menu, chi nhánh và danh mục đang lấy từ dữ liệu hiện tại."}</p>
      </article>
    </section>
  );
}
