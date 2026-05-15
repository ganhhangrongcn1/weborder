import { formatMoney } from "../utils/format.js";
import Icon from "./Icon.jsx";

export default function ProductCard({ product, compact = false, onOpen, onAdd, onRemove, selectedCount = 0 }) {
  const badgeText = String(product?.badge || "").trim();

  return (
    <article className={`${compact ? "product-row" : "product-card"} ${selectedCount ? "product-selected" : ""}`}>
      <button onClick={() => onAdd(product)} className={compact ? "product-row-image" : "product-image-wrap"} aria-label={`Tùy chọn ${product.name}`}>
        <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        {badgeText ? <span className="badge">{badgeText}</span> : null}
        {selectedCount > 0 && <span className="selected-badge">Đã chọn {selectedCount}</span>}
      </button>
      <div className={compact ? "min-w-0 flex-1 py-1" : "p-3"}>
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => onOpen(product)} className="min-w-0 text-left">
            <h3 className={compact ? "line-clamp-2 text-[15px] font-black text-brown" : "line-clamp-2 text-sm font-black text-brown"}>{product.name}</h3>
          </button>
          {!compact && <span className="product-card-mark"><Icon name="star" size={14} /></span>}
        </div>
        <p className={compact ? "mt-1 line-clamp-2 text-xs leading-5 text-brown/55" : "mt-1 line-clamp-2 min-h-9 text-xs leading-5 text-brown/55"}>{product.short}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex flex-col">
            {Number(product.originalPrice || 0) > Number(product.price || 0) ? (
              <span className="text-[11px] font-semibold text-brown/40 line-through">{formatMoney(product.originalPrice)}</span>
            ) : null}
            <strong className="text-[15px] font-black text-orange-600">{formatMoney(product.price)}</strong>
          </div>
          {selectedCount > 0 ? (
            <div className="product-card-stepper">
              <button onClick={() => onRemove?.(product)} aria-label={`Bớt ${product.name}`}>-</button>
              <span>{selectedCount}</span>
              <button onClick={() => onAdd(product)} aria-label={`Thêm ${product.name}`}>+</button>
            </div>
          ) : (
            <button onClick={() => onAdd(product)} aria-label={`Thêm ${product.name}`} className="product-add-btn">+</button>
          )}
        </div>
      </div>
    </article>
  );
}
