import { useEffect, useState } from "react";
import PosCashCountModal from "./PosCashCountModal.jsx";
import { formatMoney } from "./posHelpers.js";
import {
  formatCashBreakdownSummary,
  getCashBreakdownTotal
} from "../../services/posCashBreakdownService.js";

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

  return (
    <div className="pos-modal-layer" role="presentation">
      <button type="button" className="pos-modal-backdrop" aria-label="Đóng kết ca" onClick={onClose} />
      <section className="pos-cash-payment-modal pos-shift-close-modal" role="dialog" aria-modal="true">
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

        <div className="pos-shift-breakdown-box">
          <span>Tiền mặt thực đếm</span>
          <strong>{hasCountedCash ? formatMoney(countedAmount) : "Chưa đếm tiền"}</strong>
          <p>{formatCashBreakdownSummary(cashBreakdown)}</p>
        </div>

        <button
          type="button"
          className="pos-shift-cash-count-button"
          onClick={() => setCashCounterOpen(true)}
        >
          {hasCountedCash ? "Đếm lại theo mệnh giá" : "Đếm tiền theo mệnh giá"}
        </button>

        <div className={`pos-shift-close-difference ${!hasCountedCash ? "is-pending" : difference === 0 ? "is-even" : difference > 0 ? "is-over" : "is-short"}`}>
          <span>{!hasCountedCash ? "Chưa đếm tiền" : difference === 0 ? "Khớp tiền" : difference > 0 ? "Thừa tiền" : "Thiếu tiền"}</span>
          <strong>{!hasCountedCash ? formatMoney(0) : formatMoney(Math.abs(difference))}</strong>
        </div>

        <label className="pos-payment-cash-input">
          <span>Ghi chú kết ca</span>
          <textarea
            value={closingNote}
            rows={3}
            placeholder="Ví dụ: Bàn giao ca tối..."
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
            <small>Máy in POS sẽ nhận lệnh sau khi kết ca thành công.</small>
          </span>
        </label>

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
