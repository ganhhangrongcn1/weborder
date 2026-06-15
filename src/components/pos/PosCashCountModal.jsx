import { useEffect, useMemo, useState } from "react";
import {
  CASH_DENOMINATIONS,
  formatCashDenomination,
  getCashBreakdownTotal,
  normalizeCashBreakdown,
  toCashCount
} from "../../services/posCashBreakdownService.js";
import { formatMoney } from "./posHelpers.js";

export default function PosCashCountModal({
  title = "Đếm tiền",
  subtitle = "Nhập số tờ theo từng mệnh giá.",
  open = false,
  initialCounts = null,
  onClose,
  onApply
}) {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (!open) return;
    setCounts(normalizeCashBreakdown(initialCounts) || {});
  }, [initialCounts, open]);

  const total = useMemo(() => getCashBreakdownTotal(counts), [counts]);

  if (!open) return null;

  const setCount = (denomination, value) => {
    setCounts((current) => ({
      ...current,
      [denomination]: String(toCashCount(value) || "")
    }));
  };

  return (
    <div className="pos-modal-layer" role="presentation">
      <button type="button" className="pos-modal-backdrop" aria-label="Đóng đếm tiền" onClick={onClose} />
      <section className="pos-cash-payment-modal pos-cash-count-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span>POS</span>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </div>
          <button type="button" onClick={onClose}>Đóng</button>
        </header>

        <div className="pos-cash-count-total">
          <span>Tổng tiền</span>
          <strong>{formatMoney(total)}</strong>
        </div>

        <div className="pos-cash-count-list">
          {CASH_DENOMINATIONS.map((denomination) => {
            const count = toCashCount(counts[denomination]);
            return (
              <label key={denomination}>
                <span>{formatCashDenomination(denomination)}</span>
                <input
                  value={counts[denomination] || ""}
                  inputMode="numeric"
                  placeholder="0"
                  onChange={(event) => setCount(denomination, event.target.value)}
                />
                <strong>{formatMoney(denomination * count)}</strong>
              </label>
            );
          })}
        </div>

        <div className="pos-modal-actions">
          <button type="button" onClick={() => setCounts({})}>Xóa đếm</button>
          <button
            type="button"
            className="pos-modal-primary"
            onClick={() => onApply?.({
              total,
              counts: normalizeCashBreakdown(counts) || {}
            })}
          >
            Dùng số này
          </button>
        </div>
      </section>
    </div>
  );
}
