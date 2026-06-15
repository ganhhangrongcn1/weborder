import { useState } from "react";
import { formatMoney } from "./posHelpers.js";

function toNumber(value = 0) {
  const parsed = Number(String(value || "").replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCashInput(value = "") {
  const amount = toNumber(value);
  return amount ? amount.toLocaleString("vi-VN") : "";
}

function formatOpeningCashAmount(value = 0) {
  const amount = toNumber(value);
  return amount.toLocaleString("vi-VN");
}

const OPENING_CASH_PRESETS = [
  { label: "0đ", value: 0 },
  { label: "300.000đ", value: 300000 },
  { label: "500.000đ", value: 500000 },
  { label: "1.000.000đ", value: 1000000 },
  { label: "1.500.000đ", value: 1500000 },
  { label: "2.000.000đ", value: 2000000 }
];

export default function PosShiftOpenPanel({
  branchLabel = "",
  cashierName = "",
  loading = false,
  error = "",
  onOpenShift,
  onLogout
}) {
  const [openingCash, setOpeningCash] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const amount = toNumber(openingCash);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (loading) return;
    onOpenShift?.({
      openingCash: amount,
      openingNote
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

        <label>
          <span>Tiền mặt đầu ca</span>
          <input
            value={openingCash}
            inputMode="numeric"
            placeholder="0"
            onChange={(event) => setOpeningCash(formatCashInput(event.target.value))}
            autoFocus
          />
        </label>

        <div className="pos-shift-cash-presets" aria-label="Chọn nhanh tiền đầu ca">
          {OPENING_CASH_PRESETS.map((preset) => {
            const selected = preset.value === 0
              ? openingCash !== "" && amount === 0
              : amount === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                className={selected ? "is-selected" : ""}
                onClick={() => setOpeningCash(formatOpeningCashAmount(preset.value))}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

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

        <button type="submit" className="pos-shift-open-submit" disabled={loading}>
          {loading ? "Đang mở ca..." : "Mở ca"}
        </button>
      </form>
    </section>
  );
}
