import {
  buildPosPaymentReference,
  buildPosQrImageUrl,
  calculateCashChange,
  getPosQrPaymentConfig,
  normalizeCashReceived
} from "../../services/posPaymentService.js";
import { createPosOrderIdentity } from "../../services/posService.js";
import { PosIcon } from "./PosPrimitives.jsx";
import { formatMoney } from "./posHelpers.js";

const CASH_SUGGESTIONS = [50000, 100000, 200000, 500000];

function openBrowserQrPrint({ qrUrl, amount, transferContent }) {
  if (!qrUrl) {
    return {
      ok: false,
      message: "Chưa tạo được mã QR để in."
    };
  }

  const printWindow = window.open("", "_blank", "width=360,height=520");
  if (!printWindow) {
    return {
      ok: false,
      message: "Trình duyệt đang chặn cửa sổ in QR."
    };
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>In QR ${transferContent}</title>
        <style>
          body{font-family:system-ui,Arial,sans-serif;margin:0;padding:14px;text-align:center;color:#111827}
          img{width:260px;max-width:100%;display:block;margin:8px auto}
          strong{display:block;font-size:20px;margin-top:8px}
          span{display:block;font-size:14px;margin-top:4px}
        </style>
      </head>
      <body>
        <img src="${qrUrl}" alt="QR thanh toán" />
        <strong>${formatMoney(amount)}</strong>
        <span>${transferContent}</span>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();

  return {
    ok: true,
    message: "Đã mở hộp thoại in QR."
  };
}

export function CashPaymentModal({ amount, cashReceived, setCashReceived, onClose, onConfirm }) {
  const normalized = normalizeCashReceived(cashReceived);
  const change = calculateCashChange(amount, normalized);
  const missing = Math.max(0, amount - normalized);
  const paidEnough = normalized >= amount;
  const formattedCashReceived = normalized > 0 ? normalized.toLocaleString("vi-VN") : "";

  const handleCashReceivedChange = (event) => {
    setCashReceived(event.target.value.replace(/[^\d]/g, ""));
  };

  return (
    <div className="pos-modal-layer" role="presentation">
      <button type="button" className="pos-modal-backdrop" aria-label="Đóng thanh toán tiền mặt" onClick={onClose} />
      <section className="pos-cash-payment-modal" role="dialog" aria-modal="true" aria-labelledby="pos-cash-payment-title">
        <header>
          <div>
            <span>Tiền mặt</span>
            <strong id="pos-cash-payment-title">Xác nhận thanh toán</strong>
          </div>
          <button type="button" onClick={onClose}>Đóng</button>
        </header>
        <div className="pos-cash-summary">
          <div>
            <span>Cần thu</span>
            <strong>{formatMoney(amount)}</strong>
          </div>
        </div>
        <div className="pos-cash-suggestions pos-cash-quick-grid">
          {CASH_SUGGESTIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={normalized === value ? "is-selected" : ""}
              onClick={() => setCashReceived(String(value))}
            >
              {formatMoney(value)}
            </button>
          ))}
        </div>
        <label className="pos-payment-cash-input">
          <span>Tiền khách đưa</span>
          <input
            value={formattedCashReceived}
            onChange={handleCashReceivedChange}
            inputMode="numeric"
            placeholder="Nhập số tiền"
            autoFocus
          />
        </label>
        <div className={`pos-cash-payment-note ${paidEnough ? "is-paid" : "is-missing"}`}>
          <div>
            <span>Khách đưa</span>
            <strong>{formatMoney(normalized)}</strong>
          </div>
          <div>
            <span>{paidEnough ? "Tiền thối" : "Còn thiếu"}</span>
            <strong>{formatMoney(paidEnough ? change : missing)}</strong>
          </div>
        </div>
        <button type="button" className="pos-modal-primary" disabled={!paidEnough} onClick={onConfirm}>
          Xác nhận đã thanh toán
        </button>
      </section>
    </div>
  );
}

export function QrPaymentModal({
  branch,
  amount,
  draftOrder,
  previewIdentity,
  processing,
  loading,
  errorMessage,
  printMessage = "",
  printMessageType = "",
  printingQr = false,
  canConfirmManually = false,
  onClose,
  onCancelPending,
  onConfirmPaid,
  onPrintQr
}) {
  const identity = draftOrder || previewIdentity || createPosOrderIdentity(new Date());
  const qrUrl = buildPosQrImageUrl({ branch, amount, orderIdentity: identity });
  const config = getPosQrPaymentConfig(branch);
  const transferContent = buildPosPaymentReference(identity, branch);

  const handlePrintQr = async () => {
    if (typeof onPrintQr === "function") {
      const result = await onPrintQr({
        qrUrl,
        amount,
        transferContent,
        identity
      });

      if (result?.fallbackToBrowser) {
        openBrowserQrPrint({ qrUrl, amount, transferContent });
      }
      return;
    }

    openBrowserQrPrint({ qrUrl, amount, transferContent });
  };

  return (
    <div className="pos-modal-layer" role="presentation">
      <button type="button" className="pos-modal-backdrop" aria-label="Đóng QR thanh toán" onClick={onClose} />
      <section className="pos-qr-payment-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span>Chuyển khoản QR</span>
            <strong>Quét mã thanh toán</strong>
          </div>
          <div className="pos-qr-payment-header-actions">
            {config.ready ? (
              <button type="button" disabled={printingQr} onClick={handlePrintQr}>
                {printingQr ? "Đang in..." : "In QR"}
              </button>
            ) : null}
            <button type="button" onClick={onClose}>Đóng</button>
          </div>
        </header>
        {config.ready ? (
          <div className="pos-qr-payment-scroll">
            <div className="pos-qr-payment-preview">
              <img src={qrUrl} alt="QR thanh toán POS" />
            </div>
            <div className="pos-qr-payment-summary">
              <div>
                <span>Số tiền</span>
                <strong>{formatMoney(amount)}</strong>
              </div>
              <div>
                <span>Nội dung</span>
                <strong>{transferContent}</strong>
              </div>
            </div>
            {draftOrder ? (
              <div className="pos-qr-draft-status">
                <span>Đang chờ thanh toán</span>
                <strong>{draftOrder.displayOrderCode || draftOrder.orderCode}</strong>
              </div>
            ) : null}
            {loading ? (
              <div className="pos-qr-draft-status">
                <span>Đang tạo phiên thanh toán</span>
                <strong>{transferContent}</strong>
              </div>
            ) : null}
            {printMessage ? (
              <div className={`pos-create-message ${printMessageType === "success" ? "is-success" : "is-error"}`}>
                {printMessage}
              </div>
            ) : null}
            {errorMessage ? (
              <div className="pos-create-message is-error">
                {errorMessage}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="pos-create-message is-error">
            Chi nhánh này chưa cấu hình thông tin ngân hàng để tạo QR thanh toán.
          </div>
        )}
        {config.ready && draftOrder && (onCancelPending || canConfirmManually) ? (
          <div className="pos-qr-payment-actions">
            {onCancelPending ? (
              <button
                type="button"
                className="pos-qr-cancel-button"
                disabled={processing || loading || printingQr}
                onClick={onCancelPending}
              >
                Hủy QR
              </button>
            ) : null}
            {canConfirmManually ? (
              <button type="button" className="pos-modal-primary" disabled={processing || loading || printingQr} onClick={onConfirmPaid}>
                {processing ? "Đang xử lý..." : "Xác nhận tay"}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function PosConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Đóng",
  processing = false,
  onClose,
  onConfirm
}) {
  if (!open) return null;

  return (
    <div className="pos-modal-layer pos-confirm-layer" role="presentation">
      <button
        type="button"
        className="pos-modal-backdrop"
        aria-label={cancelLabel}
        disabled={processing}
        onClick={onClose}
      />
      <section
        className="pos-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pos-confirm-modal-title"
        aria-describedby="pos-confirm-modal-message"
      >
        <div className="pos-confirm-content">
          <span className="pos-confirm-icon">
            <PosIcon name="trash" />
          </span>
          <div>
            <strong id="pos-confirm-modal-title">{title}</strong>
            <p id="pos-confirm-modal-message">{message}</p>
          </div>
        </div>
        <div className="pos-confirm-actions">
          <button type="button" className="pos-confirm-secondary" disabled={processing} onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className="pos-confirm-danger" disabled={processing} onClick={onConfirm}>
            {processing ? "Đang hủy..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function PaymentMethodButton({ active, iconName, label, disabled, onClick }) {
  return (
    <button type="button" className={`pos-payment-method-button ${active ? "is-active" : ""}`} disabled={disabled} onClick={onClick}>
      <span>
        <PosIcon name={iconName} />
      </span>
      <strong>{label}</strong>
    </button>
  );
}
