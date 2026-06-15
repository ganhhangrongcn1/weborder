import { formatMoney } from "./posHelpers.js";
import { formatCashBreakdownSummary } from "../../services/posCashBreakdownService.js";

function formatShiftTime(value = "") {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}

function getShortShiftId(value = "") {
  return String(value || "").trim().slice(0, 8);
}

export default function PosShiftOverviewPanel({
  cashierName = "",
  activeShift = null,
  shiftSummary = null,
  shiftSummaryError = "",
  onRequestCloseShift
}) {
  const summary = shiftSummary || {};
  const expectedCash = summary.expectedCash ?? activeShift?.openingCash ?? 0;
  const shiftCode = getShortShiftId(activeShift?.id);

  return (
    <section className="pos-settings-grid pos-shift-overview">
      <article className="pos-settings-card is-wide pos-shift-overview-card">
        <header className="pos-shift-overview-head">
          <div>
            <span>Tổng quan ca</span>
            <strong>{activeShift?.id ? "Ca đang mở" : "Chưa mở ca"}</strong>
            <p>
              {activeShift?.id
                ? `${cashierName || "Thu ngân"} · Mở lúc ${formatShiftTime(activeShift.openedAt)} · Ca ${shiftCode}`
                : "POS cần mở ca trước khi bán hàng."}
            </p>
          </div>
          {activeShift?.id ? (
            <button type="button" className="pos-shift-close-button" onClick={onRequestCloseShift}>
              Kết ca
            </button>
          ) : null}
        </header>

        {activeShift?.id ? (
          <>
            {shiftSummaryError ? <div className="pos-create-message is-error">{shiftSummaryError}</div> : null}
            <div className="pos-shift-summary-grid is-primary">
              <div>
                <span>Tiền mặt</span>
                <strong>{formatMoney(summary.cashTotal || 0)}</strong>
              </div>
              <div>
                <span>Tiền chuyển khoản</span>
                <strong>{formatMoney(summary.qrTotal || 0)}</strong>
              </div>
              <div>
                <span>Dự kiến trong két</span>
                <strong>{formatMoney(expectedCash)}</strong>
              </div>
              <div>
                <span>Tổng đơn</span>
                <strong>{summary.orderCount || 0}</strong>
              </div>
            </div>

            <div className="pos-shift-overview-meta">
              <span>Tiền đầu ca {formatMoney(activeShift.openingCash)}</span>
              <span>Đơn hủy {summary.cancelledOrderCount || 0}</span>
              <span>Chuyển khoản chờ {summary.pendingQrCount || 0}</span>
            </div>

            <div className="pos-shift-breakdown-box is-compact">
              <span>Cơ cấu tiền đầu ca</span>
              <strong>{formatMoney(activeShift.openingCash || 0)}</strong>
              <p>{formatCashBreakdownSummary(activeShift.openingCashBreakdown)}</p>
            </div>
          </>
        ) : null}
      </article>
    </section>
  );
}
