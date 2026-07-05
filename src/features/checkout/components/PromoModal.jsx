import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import CustomerOfferCard from "../../../components/customer/CustomerOfferCard.jsx";
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
          const valueText = promo.freeShip
            ? "Hỗ trợ phí ship"
            : `Giảm ${formatMoney(promo.discount)}`;
          return (
            <CustomerOfferCard
              key={promo.id}
              value={valueText}
              title={promo.title}
              status={active ? "Đã chọn" : disabled ? "Chưa đủ" : "Có thể dùng"}
              details={[
                { icon: "tag", text: promo.condition }
              ]}
              codeLabel={`Mã: ${promo.code}`}
              actionLabel={active ? "Bỏ chọn" : "Áp dụng"}
              actionIcon="check"
              selected={active}
              inactive={disabled}
              disabled={disabled}
              onAction={() => onSelect(promo)}
              className="checkout-offer-option"
            />
          );
        })}
      </div>
    </CustomerBottomSheet>
  );
}
