import CustomerControl from "./customer/CustomerControl.jsx";
import { formatMoney } from "../utils/format.js";
import CustomerBadge from "./customer/CustomerBadge.jsx";

function getProductBadge(product, badgeText) {
  if (product?.flashPromoId) return "⚡ Flash Sale";
  if (badgeText) return badgeText;
  if (Number(product?.originalPrice || 0) > Number(product?.price || 0)) return "Giá tốt";
  return "";
}

export default function ProductCard({ product, compact = false, onOpen, onAdd, onRemove, selectedCount = 0 }) {
  const badgeText = getProductBadge(product, String(product?.badge || "").trim());
  const hasDiscount = Number(product?.originalPrice || 0) > Number(product?.price || 0);
  const handleCardClick = (event) => {
    if (event.target.closest("button,a,input,select,textarea,[role='button']")) return;
    (onAdd || onOpen)?.(product);
  };
  const rootClass = [
    compact ? "product-row" : "product-card",
    product?.flashPromoId ? "product-flash-sale" : "",
    selectedCount ? "product-selected" : ""
  ].filter(Boolean).join(" ");

  return (
    <article className={rootClass} onClick={handleCardClick}>
      <CustomerControl
        type="button"
        onClick={() => onOpen(product)}
        className={compact ? "product-row-image" : "product-image-wrap"}
        aria-label={`Xem ${product.name}`}
      >
        <img
          src={product.image}
          alt={product.name}
          width={compact ? 220 : 360}
          height={compact ? 202 : 281}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {badgeText ? <CustomerBadge compact={compact} title={badgeText}>{badgeText}</CustomerBadge> : null}
        {selectedCount > 0 ? <CustomerBadge className="product-count-badge" compact={compact} title={`Đã chọn ${selectedCount}`}>{compact ? `×${selectedCount}` : `Đã chọn ${selectedCount}`}</CustomerBadge> : null}
      </CustomerControl>

      <div className="product-card-body">
        <CustomerControl type="button" onClick={() => onOpen(product)} className="product-card-copy">
          <h3>{product.name}</h3>
          {product.short ? <p>{product.short}</p> : null}
        </CustomerControl>

        <div className="product-card-footer">
          <CustomerControl type="button" className="product-price-stack" onClick={() => onOpen(product)} aria-label={`Xem ${product.name}`}>
            {hasDiscount ? <span>{formatMoney(product.originalPrice)}</span> : null}
            <strong>{formatMoney(product.price)}</strong>
            {product?.flashPromoId ? <small>Đang giảm sốc</small> : null}
          </CustomerControl>

          {selectedCount > 0 ? (
            <div className="product-card-stepper" role="group" aria-label={`Số lượng ${product.name}`}>
              <CustomerControl appearance="quantity" type="button" onClick={() => onRemove?.(product)} aria-label={`Bớt ${product.name}`}>-</CustomerControl>
              <span>{selectedCount}</span>
              <CustomerControl appearance="quantity" type="button" onClick={() => onAdd(product)} aria-label={`Thêm ${product.name}`}>+</CustomerControl>
            </div>
          ) : (
            <CustomerControl type="button" onClick={() => onAdd(product)} aria-label={`Thêm ${product.name}`} className="product-add-btn">
              <span>+</span>
            </CustomerControl>
          )}
        </div>
      </div>
    </article>
  );
}
