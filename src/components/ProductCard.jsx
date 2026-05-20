import { formatMoney } from "../utils/format.js";

function getProductBadge(product, badgeText) {
  if (badgeText) return badgeText;
  if (Number(product?.originalPrice || 0) > Number(product?.price || 0)) return "Giá tốt";
  return "";
}

export default function ProductCard({ product, compact = false, onOpen, onAdd, onRemove, selectedCount = 0 }) {
  const badgeText = getProductBadge(product, String(product?.badge || "").trim());
  const hasDiscount = Number(product?.originalPrice || 0) > Number(product?.price || 0);
  const rootClass = [
    compact ? "product-row" : "product-card",
    selectedCount ? "product-selected" : ""
  ].filter(Boolean).join(" ");

  return (
    <article className={rootClass}>
      <button
        type="button"
        onClick={() => onOpen(product)}
        className={compact ? "product-row-image" : "product-image-wrap"}
        aria-label={`Xem ${product.name}`}
      >
        <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        {badgeText ? <span className="badge">{badgeText}</span> : null}
        {selectedCount > 0 ? <span className="selected-badge">Đã chọn {selectedCount}</span> : null}
      </button>

      <div className="product-card-body">
        <button type="button" onClick={() => onOpen(product)} className="product-card-copy">
          <h3>{product.name}</h3>
          {product.short ? <p>{product.short}</p> : null}
        </button>

        <div className="product-card-footer">
          <div className="product-price-stack">
            {hasDiscount ? <span>{formatMoney(product.originalPrice)}</span> : null}
            <strong>{formatMoney(product.price)}</strong>
          </div>

          {selectedCount > 0 ? (
            <div className="product-card-stepper" aria-label={`Số lượng ${product.name}`}>
              <button type="button" onClick={() => onRemove?.(product)} aria-label={`Bớt ${product.name}`}>-</button>
              <span>{selectedCount}</span>
              <button type="button" onClick={() => onAdd(product)} aria-label={`Thêm ${product.name}`}>+</button>
            </div>
          ) : (
            <button type="button" onClick={() => onAdd(product)} aria-label={`Thêm ${product.name}`} className="product-add-btn">
              <span>+</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
