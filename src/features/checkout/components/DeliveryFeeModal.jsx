import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { defaultDeliveryZones } from "../../../constants/storeConfig.js";
import { formatMoney } from "../../../utils/format.js";

export default function DeliveryFeeModal({
  zones,
  fulfillmentType,
  distanceKm,
  deliveryFee: currentDeliveryFee,
  source,
  onClose
}) {
  const isPickup = fulfillmentType === "pickup";

  return (
    <CustomerBottomSheet
      title="Phí giao hàng"
      subtitle="Phí giao hàng được tính theo quãng đường từ chi nhánh giao đến địa chỉ của bạn."
      ariaLabel="Giải thích phí giao hàng"
      onClose={onClose}
      className="promo-sheet"
    >
      {isPickup ? (
        <div className="delivery-fee-note">
          Bạn chọn tự đến lấy nên không phát sinh phí giao hàng.
        </div>
      ) : (
        <div className="delivery-fee-list">
          <div><span>Khoảng cách hiện tại: {distanceKm ? `${distanceKm.toFixed(1)}km` : "Chưa xác định"}</span></div>
          <div><span>Phí giao hàng dự kiến: {formatMoney(currentDeliveryFee || 0)}</span></div>
          <div><span>Cách tính phí: {source || "Theo khoảng cách giao hàng"}</span></div>
          {(zones.length ? zones : defaultDeliveryZones).map((zone, index) => (
            <div key={`${zone}-${index}`}><span>{zone}</span></div>
          ))}
        </div>
      )}
    </CustomerBottomSheet>
  );
}
