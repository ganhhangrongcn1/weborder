import { formatMoney, toText } from "./posHelpers.js";

const STATUS_META = {
  draft: { label: "Bản nháp", tone: "draft" },
  pending_payment: { label: "Chờ thanh toán", tone: "pending" },
  paid: { label: "Đã nhận tiền", tone: "paid" },
  converting: { label: "Đang tạo đơn", tone: "processing" }
};

function formatDateTime(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}

function getExpiryLabel(session = {}) {
  const expiresAt = new Date(session.expiresAt || "").getTime();
  if (!Number.isFinite(expiresAt)) return "";

  const remainingMinutes = Math.ceil((expiresAt - Date.now()) / 60000);
  if (remainingMinutes <= 0) return "Đang kiểm tra hết hạn";
  return `Còn ${remainingMinutes} phút`;
}

function getItemSummary(session = {}) {
  const items = Array.isArray(session.cartSnapshot) ? session.cartSnapshot : [];
  if (!items.length) return "Không có dữ liệu món";

  const firstItem = items[0];
  const quantity = Number(firstItem?.quantity || 1);
  const firstLabel = `${toText(firstItem?.name) || "Món"} ×${quantity}`;
  return items.length > 1 ? `${firstLabel} · +${items.length - 1} món` : firstLabel;
}

export default function PosPendingPaymentsPanel({
  sessions = [],
  embedded = false,
  loading = false,
  error = "",
  activeSessionId = "",
  cancellingSessionId = "",
  onRefresh,
  onOpen,
  onCancel
}) {
  const rows = Array.isArray(sessions) ? sessions : [];

  return (
    <div className={`pos-pending-payments-panel ${embedded ? "is-embedded" : ""}`}>
      {embedded ? (
        <div className="pos-pending-payments-group-title">
          <strong>Phiên QR đang xử lý</strong>
          <span>{rows.length}</span>
        </div>
      ) : (
        <header className="pos-pending-payments-toolbar">
          <div>
            <strong>Phiên QR chờ thanh toán</strong>
            <span>{rows.length} phiên đang cần xử lý tại chi nhánh</span>
          </div>
          <button type="button" onClick={onRefresh} disabled={loading}>
            {loading ? "Đang tải..." : "Tải lại"}
          </button>
        </header>
      )}

      {error ? <div className="pos-create-message is-error">{error}</div> : null}

      <div className="pos-pending-payments-list">
        {rows.length ? rows.map((session) => {
          const status = toText(session.status).toLowerCase();
          const statusMeta = STATUS_META[status] || STATUS_META.draft;
          const canCancel = ["draft", "pending_payment"].includes(status);
          const isActive = toText(activeSessionId) === toText(session.id);
          const customerLabel = toText(session.customerName) || "Khách vãng lai";
          const phoneLabel = toText(session.customerPhone);

          return (
            <article
              key={session.id}
              className={`pos-pending-payment-row ${isActive ? "is-active" : ""}`}
            >
              <div className="pos-pending-payment-main">
                <div className="pos-pending-payment-title">
                  <strong>{session.paymentReference || session.displayOrderCode}</strong>
                  <span className={`pos-pending-payment-status is-${statusMeta.tone}`}>
                    {statusMeta.label}
                  </span>
                </div>

                <div className="pos-pending-payment-meta">
                  <span>{session.pagerNumber ? `Thẻ ${session.pagerNumber}` : "Chưa có thẻ"}</span>
                  <span>{customerLabel}</span>
                  {phoneLabel ? <span>{phoneLabel}</span> : null}
                  <span>{formatDateTime(session.createdAt)}</span>
                  {status === "pending_payment" ? <span>{getExpiryLabel(session)}</span> : null}
                </div>

                <p>{getItemSummary(session)}</p>
              </div>

              <div className="pos-pending-payment-total">
                <span>Cần thu</span>
                <strong>{formatMoney(session.amountExpected)}</strong>
              </div>

              <div className="pos-pending-payment-actions">
                <button type="button" className="is-primary" onClick={() => onOpen(session)}>
                  {isActive ? "Đang mở" : status === "pending_payment" ? "Mở bill" : "Tiếp tục"}
                </button>
                {canCancel ? (
                  <button
                    type="button"
                    className="is-danger"
                    disabled={cancellingSessionId === session.id}
                    onClick={() => onCancel(session)}
                  >
                    {cancellingSessionId === session.id ? "Đang hủy..." : "Hủy"}
                  </button>
                ) : null}
              </div>
            </article>
          );
        }) : embedded ? null : (
          <div className="pos-cart-empty">
            <strong>Không có phiên QR đang chờ.</strong>
            <span>Các phiên mới sẽ tự xuất hiện tại đây.</span>
          </div>
        )}
      </div>
    </div>
  );
}
