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
  const rawShippingFee = isPickup ? 0 : originalShip;
  const appliedSupportMax = Math.max(0, Number(shippingSupportMax || 0));
  const displayedSubtotal = Number(subtotal || 0);
  const displayedOriginalSubtotal = Math.max(displayedSubtotal, Number(originalSubtotal || displayedSubtotal));
  const hasSubtotalDiscount = displayedOriginalSubtotal > displayedSubtotal;
  const originalTotal = displayedOriginalSubtotal + rawShippingFee;
  const savingOriginalTotal = originalTotal + Math.max(0, Number(giftSavingAmount || 0));
  const savedAmount = Math.max(savingOriginalTotal - total, 0);

  return (
    <CheckoutCard title="Tổng cộng">
      <div className="checkout-total-summary">
        <div className="summary-line">
          <span>Tổng tạm tính ({count} món)</span>
          <strong className="flex flex-col items-end leading-tight">
            {hasSubtotalDiscount ? (
              <del className="text-xs font-semibold text-brown/35">{formatMoney(displayedOriginalSubtotal)}</del>
            ) : null}
            <span>{formatMoney(displayedSubtotal)}</span>
          </strong>
        </div>

        <div className="summary-line">
          <span>
            Phí giao hàng {!isPickup && distanceKm ? `(${distanceKm.toFixed(1)}km)` : ""}{" "}
            <button type="button" onClick={onShowDeliveryFee} className="fee-info-btn">i</button>
          </span>
          <strong>
            {isPickup ? (
              "Không tính phí giao hàng"
            ) : shippingSupportDiscount > 0 ? (
              <span className="flex items-center gap-2">
                <del className="text-brown/35">{formatMoney(rawShippingFee)}</del>
                <span>{formatMoney(displayedShippingFee)}</span>
              </span>
            ) : (
              formatMoney(displayedShippingFee)
            )}
          </strong>
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

        {!isPickup && customerExtraShip > 0 ? (
          <div className="summary-line">
            <span>Phần phí ship khách trả thêm</span>
            <strong>{formatMoney(customerExtraShip)}</strong>
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
          <span>Tổng cộng</span>
          <strong className="flex flex-col items-end leading-tight">
            {originalTotal > total ? (
              <del className="text-sm font-semibold text-brown/35">{formatMoney(originalTotal)}</del>
            ) : null}
            <span>{formatMoney(total)}</span>
          </strong>
        </div>

        {savedAmount > 0 ? (
          <div className="summary-saving">
            <span>Bạn tiết kiệm được {formatMoney(savedAmount)}</span>
            <del>{formatMoney(savingOriginalTotal)}</del>
          </div>
        ) : null}
      </div>
    </CheckoutCard>
  );
}
