import { useState } from "react";
import PosCashCountModal from "./PosCashCountModal.jsx";
import { formatMoney } from "./posHelpers.js";
import {
  formatCashBreakdownSummary,
  getCashBreakdownTotal
} from "../../services/posCashBreakdownService.js";

export default function PosShiftOpenPanel({
  branchLabel = "",
  cashierName = "",
  loading = false,
  error = "",
  onOpenShift,
  onLogout
}) {
  const [openingBreakdown, setOpeningBreakdown] = useState(null);
  const [openingNote, setOpeningNote] = useState("");
  const [cashCounterOpen, setCashCounterOpen] = useState(false);

  const amount = getCashBreakdownTotal(openingBreakdown);
  const hasOpeningCount = Boolean(openingBreakdown);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (loading || !hasOpeningCount) return;
    onOpenShift?.({
      openingCash: amount,
      openingNote,
      openingCashBreakdown: openingBreakdown
    });
  };

  return (
    <section className="pos-shift-gate">
      <form className="pos-shift-open-card" onSubmit={handleSubmit}>
        <header>
          <div>
            <span>POS</span>
            <strong>Mở ca bán hàng</strong>
            <small>{branchLabel || "Chi nhánh POS"}</small>
          </div>
          <button type="button" onClick={onLogout}>Đổi tài khoản</button>
        </header>

        <div className="pos-shift-open-summary">
          <div>
            <span>Thu ngân</span>
            <strong>{cashierName || "Thu ngân"}</strong>
          </div>
          <div>
            <span>Tiền đầu ca</span>
            <strong>{formatMoney(amount)}</strong>
          </div>
        </div>

        <div className="pos-shift-breakdown-box">
          <span>Tiền mặt đầu ca</span>
          <strong>{hasOpeningCount ? formatMoney(amount) : "Chưa đếm tiền"}</strong>
          <p>{formatCashBreakdownSummary(openingBreakdown)}</p>
        </div>

        <button
          type="button"
          className="pos-shift-cash-count-button"
          onClick={() => setCashCounterOpen(true)}
        >
          {hasOpeningCount ? "Đếm lại theo mệnh giá" : "Đếm tiền theo mệnh giá"}
        </button>

        <label>
          <span>Ghi chú</span>
          <textarea
            value={openingNote}
            rows={3}
            placeholder="Ví dụ: Nhận két từ ca sáng..."
            onChange={(event) => setOpeningNote(event.target.value)}
          />
        </label>

        {error ? <div className="pos-create-message is-error">{error}</div> : null}

        <button type="submit" className="pos-shift-open-submit" disabled={loading || !hasOpeningCount}>
          {loading ? "Đang mở ca..." : "Mở ca"}
        </button>
      </form>

      <PosCashCountModal
        open={cashCounterOpen}
        title="Đếm tiền đầu ca"
        subtitle="Nhập đầy đủ số tờ đang có trong két trước khi bán."
        initialCounts={openingBreakdown}
        onClose={() => setCashCounterOpen(false)}
        onApply={({ counts }) => {
          setOpeningBreakdown(counts);
          setCashCounterOpen(false);
        }}
      />
    </section>
  );
}
