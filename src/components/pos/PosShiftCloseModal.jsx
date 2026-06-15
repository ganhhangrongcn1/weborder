import { useEffect, useState } from "react";
import PosCashCountModal from "./PosCashCountModal.jsx";
import { formatMoney } from "./posHelpers.js";
import {
  formatCashBreakdownSummary,
  getCashBreakdownTotal
} from "../../services/posCashBreakdownService.js";

function getDifferenceState(hasCountedCash, difference) {
  if (!hasCountedCash) {
    return {
      className: "is-pending",
      label: "Chưa đếm tiền"
    };
  }

  if (difference === 0) {
    return {
      className: "is-even",
      label: "Khớp tiền"
    };
  }

  if (difference > 0) {
    return {
      className: "is-over",
      label: "Thừa tiền"
    };
  }

  return {
    className: "is-short",
    label: "Thiếu tiền"
  };
}

export default function PosShiftCloseModal({
  open = false,
  activeShift = null,
  summary = null,
  loading = false,
  error = "",
  onClose,
  onConfirm
}) {
  const [closingNote, setClosingNote] = useState("");
  const [printReceipt, setPrintReceipt] = useState(true);
  const [cashCounterOpen, setCashCounterOpen] = useState(false);
  const [cashBreakdown, setCashBreakdown] = useState(null);

  useEffect(() => {
    if (!open) return;
    setClosingNote("");
    setPrintReceipt(true);
    setCashCounterOpen(false);
    setCashBreakdown(null);
  }, [open]);

  if (!open) return null;

  const expectedCash = summary?.expectedCash ?? activeShift?.openingCash ?? 0;
  const countedAmount = getCashBreakdownTotal(cashBreakdown);
  const difference = countedAmount - expectedCash;
  const hasCountedCash = Boolean(cashBreakdown);
  const differenceState = getDifferenceState(hasCountedCash, difference);

  return (
    <div className="pos-modal-layer" role="presentation">
      <button
        type="button"
        className="pos-modal-backdrop"
        aria-label="Đóng kết ca"
        onClick={onClose}
      />

      <section
        className="pos-cash-payment-modal pos-shift-close-modal"
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div>
            <span>POS</span>
            <strong>Kết ca bán hàng</strong>
          </div>
          <button type="button" onClick={onClose}>Đóng</button>
        </header>

        <div className="pos-shift-close-summary">
          <div>
            <span>Tiền đầu ca</span>
            <strong>{formatMoney(activeShift?.openingCash || 0)}</strong>
          </div>
          <div>
            <span>Tiền mặt đã thu</span>
            <strong>{formatMoney(summary?.cashTotal || 0)}</strong>
          </div>
          <div>
            <span>Tiền chuyển khoản</span>
            <strong>{formatMoney(summary?.qrTotal || 0)}</strong>
          </div>
          <div>
            <span>Dự kiến trong két</span>
            <strong>{formatMoney(expectedCash)}</strong>
          </div>
        </div>

        <section className="pos-shift-close-section">
          <div className="pos-shift-close-section-head">
            <div>
              <span>Đếm tiền cuối ca</span>
              <strong>{hasCountedCash ? "Đã nhập theo mệnh giá" : "Chưa đếm tiền thực tế"}</strong>
            </div>
            <button
              type="button"
              className="pos-shift-cash-count-button"
              onClick={() => setCashCounterOpen(true)}
            >
              {hasCountedCash ? "Đếm lại" : "Đếm theo mệnh giá"}
            </button>
          </div>

          <div className="pos-shift-breakdown-box pos-shift-close-breakdown">
            <span>Tiền mặt thực đếm</span>
            <strong>{hasCountedCash ? formatMoney(countedAmount) : "Chưa có dữ liệu"}</strong>
            <p>{formatCashBreakdownSummary(cashBreakdown)}</p>
          </div>

          <div className={`pos-shift-close-difference ${differenceState.className}`}>
            <div>
              <span>{differenceState.label}</span>
              <strong>{!hasCountedCash ? formatMoney(0) : formatMoney(Math.abs(difference))}</strong>
            </div>
            <div className="pos-shift-close-difference-meta">
              <small>Thực đếm: {hasCountedCash ? formatMoney(countedAmount) : "--"}</small>
              <small>Dự kiến: {formatMoney(expectedCash)}</small>
            </div>
          </div>
        </section>

        <section className="pos-shift-close-section">
          <div className="pos-shift-close-section-head">
            <div>
              <span>Biên bản kết ca</span>
              <strong>Ghi chú và in phiếu bàn giao</strong>
            </div>
          </div>

          <label className="pos-payment-cash-input">
            <span>Ghi chú kết ca</span>
            <textarea
              value={closingNote}
              rows={3}
              placeholder="Ví dụ: Bàn giao ca tối, thiếu 1 tờ 20.000đ..."
              onChange={(event) => setClosingNote(event.target.value)}
            />
          </label>

          <label className="pos-shift-print-toggle">
            <input
              type="checkbox"
              checked={printReceipt}
              onChange={(event) => setPrintReceipt(event.target.checked)}
            />
            <span>
              <strong>In phiếu kết ca</strong>
              <small>Phiếu sẽ in số liệu ca, chênh lệch tiền và phần nhân viên ký.</small>
            </span>
          </label>
        </section>

        {error ? <div className="pos-create-message is-error">{error}</div> : null}

        <button
          type="button"
          className="pos-modal-primary"
          disabled={loading || !hasCountedCash}
          onClick={() => onConfirm?.({
            closingCashCounted: countedAmount,
            closingCashBreakdown: cashBreakdown,
            closingNote,
            printReceipt
          })}
        >
          {loading ? "Đang kết ca..." : "Xác nhận kết ca"}
        </button>
      </section>

      <PosCashCountModal
        open={cashCounterOpen}
        title="Đếm tiền cuối ca"
        subtitle="Nhập đầy đủ số tờ thực tế còn trong két."
        initialCounts={cashBreakdown}
        onClose={() => setCashCounterOpen(false)}
        onApply={({ counts }) => {
          setCashBreakdown(counts);
          setCashCounterOpen(false);
        }}
      />
    </div>
  );
}
