import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import { formatMoney } from "../../../utils/format.js";

export default function MenuPromoRail({ items = [], onOpen }) {
  if (!items.length) return null;
  const canSwipe = items.length > 1;

  return (
    <section className={`menu-promo-rail${canSwipe ? " is-scrollable" : " is-single"}`} aria-label="Ưu đãi món đang giảm">
      <div className="menu-promo-rail__head">
        <div>
          <small>Ưu đãi hôm nay</small>
          <strong>{items.length} món đang giảm</strong>
        </div>
      </div>
      <div className="menu-promo-rail__scroll no-scrollbar" aria-label="Món đang giảm giá">
        {items.map((item) => (
          <article key={item.id} className="menu-promo-card">
            <CustomerControl
              type="button"
              className="menu-promo-card__main"
              onClick={() => onOpen(item.product)}
              aria-label={`Chọn ${item.product.name}`}
            >
              <span className="menu-promo-card__image">
                <img src={item.product.image} alt={item.product.name} width="176" height="176" loading="lazy" />
                <em>{item.offer.eyebrow || "Flash Sale"}</em>
              </span>
              <span className="menu-promo-card__copy">
                <strong>{item.product.name}</strong>
                <small>{item.product.short || item.offer.detail || "Giá ưu đãi đang áp dụng"}</small>
                <span className="menu-promo-card__price">
                  <b>{formatMoney(Number(item.offer.currentPrice || item.product.price || 0))}</b>
                  <span>
                    <del>{formatMoney(Number(item.offer.originalPrice || item.product.originalPrice || item.product.price || 0))}</del>
                    <span className="menu-promo-card__cta">
                      Chọn món
                    </span>
                  </span>
                </span>
              </span>
              <span className="menu-promo-card__discount">
                -{Math.max(1, Math.round(((Number(item.offer.originalPrice || item.product.originalPrice || 0) - Number(item.offer.currentPrice || item.product.price || 0)) / Math.max(Number(item.offer.originalPrice || item.product.originalPrice || 1), 1)) * 100))}%
              </span>
            </CustomerControl>
          </article>
        ))}
      </div>
    </section>
  );
}
