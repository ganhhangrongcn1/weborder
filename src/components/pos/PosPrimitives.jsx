import { buildPagerOptions } from "./posHelpers.js";

export function PosIcon({ name }) {
  if (name === "trash") {
    return (
      <span className="pos-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
          <path d="M9 7V4h6v3" />
        </svg>
      </span>
    );
  }

  if (name === "cart") {
    return (
      <span className="pos-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
          <path d="M3 4h2l2.4 10.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H7" />
        </svg>
      </span>
    );
  }

  if (name === "cash") {
    return (
      <span className="pos-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M7 9h.01M17 15h.01" />
        </svg>
      </span>
    );
  }

  if (name === "qr") {
    return (
      <span className="pos-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="6" height="6" />
          <rect x="14" y="4" width="6" height="6" />
          <rect x="4" y="14" width="6" height="6" />
          <path d="M14 14h2v2h-2zM18 14h2v6h-6v-2h4zM14 18h2" />
        </svg>
      </span>
    );
  }

  return <span className="pos-icon" aria-hidden="true" />;
}

export function PosSessionBrand({ branchLabel = "" }) {
  return (
    <div className="pos-session-brand">
      <span>GHR</span>
      <div>
        <strong>POS Takeaway</strong>
        <small>{branchLabel || "Gánh Hàng Rong"}</small>
      </div>
    </div>
  );
}

export function UtilityActionButton({ label, onClick, tone = "default" }) {
  return (
    <button type="button" className={`pos-utility-action ${tone === "danger" ? "is-danger" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

export function CategoryButton({ label, active, onClick }) {
  return (
    <button type="button" className={`pos-category-chip ${active ? "is-active" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

export function ProductCard({ product, disabled, onAdd, formatMoney }) {
  return (
    <button type="button" className="pos-product-card" disabled={disabled} onClick={() => onAdd(product)}>
      <span className="pos-product-image">
        {product.image ? <img src={product.image} alt={product.name} /> : <span>GHR</span>}
      </span>
      <span className="pos-product-body">
        <h3>{product.name}</h3>
        <span className="pos-product-footer">
          <strong>{formatMoney(product.price)}</strong>
        </span>
      </span>
    </button>
  );
}

function normalizePagerValue(pager = "") {
  const text = String(pager || "").trim();
  const digits = text.replace(/\D/g, "");
  if (digits && digits.length <= 2) return digits.padStart(2, "0");
  return text;
}

export function PosPagerInlinePicker({ value, busyPagers = [], onOpen }) {
  const activePager = normalizePagerValue(value);
  const busySet = new Set((Array.isArray(busyPagers) ? busyPagers : []).map(normalizePagerValue).filter(Boolean));
  const isBusy = activePager && busySet.has(activePager);

  return (
    <button
      type="button"
      className={`pos-pager-compact ${activePager && !isBusy ? "is-selected" : "needs-selection"}`}
      onClick={onOpen}
    >
      <div>
        <span>Thẻ rung</span>
        <strong>{activePager ? `Thẻ ${activePager}` : "Chưa chọn"}</strong>
      </div>
      <em>{isBusy ? "Chọn thẻ khác" : activePager ? "Đổi" : "Chọn thẻ"}</em>
    </button>
  );
}

export function PosPagerModal({ open, value, busyPagers = [], onClose, onSelect }) {
  if (!open) return null;

  const activePager = normalizePagerValue(value);
  const busySet = new Set((Array.isArray(busyPagers) ? busyPagers : []).map(normalizePagerValue).filter(Boolean));

  return (
    <div className="pos-modal-layer" role="presentation">
      <button type="button" className="pos-modal-backdrop" aria-label="Đóng chọn thẻ rung" onClick={onClose} />
      <section className="pos-pager-modal" role="dialog" aria-modal="true" aria-labelledby="pos-pager-modal-title">
        <header>
          <div>
            <span>POS</span>
            <strong id="pos-pager-modal-title">Chọn thẻ rung</strong>
          </div>
          <button type="button" onClick={onClose}>Đóng</button>
        </header>
        <div className="pos-pager-modal-grid">
          {buildPagerOptions().map((pager) => {
            const normalizedPager = normalizePagerValue(pager);
            const isBusy = busySet.has(normalizedPager);
            return (
              <button
                key={pager}
                type="button"
                className={`${activePager === normalizedPager ? "is-active" : ""} ${isBusy ? "is-disabled" : ""}`.trim()}
                disabled={isBusy}
                title={isBusy ? `Thẻ ${pager} đang có đơn chưa hoàn tất` : `Chọn thẻ ${pager}`}
                onClick={() => onSelect(normalizedPager)}
              >
                {pager}
              </button>
            );
          })}
        </div>
        <small className="pos-pager-modal-note">Thẻ đang có đơn sẽ được khóa.</small>
      </section>
    </div>
  );
}
