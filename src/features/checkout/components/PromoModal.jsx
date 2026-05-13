import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { formatMoney } from "../../../utils/format.js";

export default function PromoModal({
  promos,
  selectedPromo,
  onSelect,
  onClose
}) {
  return (
    <CustomerBottomSheet
      title="Mã khuyến mãi"
      subtitle="Chọn 1 mã phù hợp cho đơn hàng"
      ariaLabel="Chọn mã khuyến mãi"
      onClose={onClose}
      className="promo-sheet"
    >
      <div className="promo-code-list">
        {!promos.length ? (
          <p className="px-2 py-6 text-center text-sm font-semibold text-brown/50">Chưa có mã phù hợp.</p>
        ) : null}
        {promos.map((promo) => {
          const disabled = promo.freeShip ? !promo.freeShip : promo.discount <= 0;
          const active = selectedPromo?.id === promo.id;
          return (
            <button
              key={promo.id}
              disabled={disabled}
              onClick={() => onSelect(promo)}
              className={`promo-code-card ${active ? "promo-code-active" : ""}`}
            >
              <span>
                <strong>{promo.title}</strong>
                <small>{promo.condition}</small>
                <small>Mã: {promo.code}</small>
              </span>
              <em>{disabled ? "Chưa đủ" : promo.freeShip ? "Freeship" : `-${formatMoney(promo.discount)}`}</em>
            </button>
          );
        })}
      </div>
    </CustomerBottomSheet>
  );
}
