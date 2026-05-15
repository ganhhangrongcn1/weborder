import { formatMoney } from "../../../utils/format.js";
import CheckoutCard from "./CheckoutCard.jsx";

export default function CheckoutTotalCard({
  subtotal,
  originalSubtotal = subtotal,
  giftSavingAmount = 0,
  ship,
  originalShip = ship,
  shippingSupportDiscount = 0,
  shippingSupportMax = 0,
  customerExtraShip = 0,
  supportShippingEnabled = false,
  total,
  count,
  promoDiscount,
  promoCode,
  pointsDiscount,
  fulfillmentType,
  distanceKm,
  onShowDeliveryFee
}) {
  const isPickup = fulfillmentType === "pickup";
  const displayedShippingFee = isPickup ? 0 : ship;
  const appliedSupportMax = Math.max(0, Number(shippingSupportMax || 0));
  const displayedSubtotal = Number(subtotal || 0);
  const displayedOriginalSubtotal = Math.max(displayedSubtotal, Number(originalSubtotal || displayedSubtotal));
  const effectiveShippingPaid = isPickup ? 0 : Math.max(0, Number(displayedShippingFee || customerExtraShip || 0));
  const rawShippingFee = isPickup
    ? 0
    : Math.max(effectiveShippingPaid, Number(originalShip || effectiveShippingPaid));
  const originalTotal = displayedOriginalSubtotal + rawShippingFee;
  const savingOriginalTotal = originalTotal + Math.max(0, Number(giftSavingAmount || 0));
  const savedAmount = Math.max(savingOriginalTotal - total, 0);

  return (
    <CheckoutCard title="Tổng cộng">
      <div className="checkout-total-summary">
        <div className="summary-line">
          <span>Tạm tính ({count} món)</span>
          <strong>{formatMoney(displayedSubtotal)}</strong>
        </div>

        <div className="summary-line">
          <span>
            Phí ship bạn trả {!isPickup && distanceKm ? `(${distanceKm.toFixed(1)}km)` : ""}{" "}
            <button type="button" onClick={onShowDeliveryFee} className="fee-info-btn">i</button>
          </span>
          <strong>{isPickup ? "0đ" : formatMoney(effectiveShippingPaid)}</strong>
        </div>

        {shippingSupportDiscount > 0 ? (
          <div className="summary-line discount-line">
            <span><i /> GHR hỗ trợ phí ship</span>
            <strong>-{formatMoney(shippingSupportDiscount)}</strong>
          </div>
        ) : null}

        {!isPickup && supportShippingEnabled && appliedSupportMax > 0 ? (
          <div className="mt-[-4px] mb-1 text-[10px] leading-4 text-brown/45">
            <span>Mức hỗ trợ tối đa: </span>
            <span className="font-medium">{formatMoney(appliedSupportMax)}</span>
          </div>
        ) : null}

        {promoDiscount > 0 ? (
          <div className="summary-line discount-line">
            <span><i /> {promoCode ? `Ưu đãi ${promoCode}` : "Mã khuyến mãi"}</span>
            <strong>-{formatMoney(promoDiscount)}</strong>
          </div>
        ) : null}

        {pointsDiscount > 0 ? (
          <div className="summary-line discount-line">
            <span><i /> Dùng điểm thưởng</span>
            <strong>-{formatMoney(pointsDiscount)}</strong>
          </div>
        ) : null}

        <div className="summary-final">
          <span>Tổng thanh toán</span>
          <strong>{formatMoney(total)}</strong>
        </div>

        {savedAmount > 0 ? (
          <div className="summary-saving">
            <span><span aria-hidden="true">🎉</span> Bạn tiết kiệm được {formatMoney(savedAmount)}</span>
            <del>{formatMoney(savingOriginalTotal)}</del>
          </div>
        ) : null}
      </div>
    </CheckoutCard>
  );
}
