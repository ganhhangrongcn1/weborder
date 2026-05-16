import Icon from "../../../components/Icon.jsx";
import CheckoutMilestoneSuggest from "./CheckoutMilestoneSuggest.jsx";
import CheckoutCard from "./CheckoutCard.jsx";
import CheckoutTotalCard from "./CheckoutTotalCard.jsx";
import { formatMoney } from "../../../utils/format.js";

export default function CheckoutPricingSection({
  subtotal,
  addToCart,
  openOptionModal,
  products,
  toppings,
  coupons,
  smartPromotions,
  selectedPromo,
  setSelectedPromo,
  setIsPromoModalOpen,
  availablePoints,
  usePoints,
  setUsePoints,
  pointsDiscount,
  earnedPreviewPoints,
  originalSubtotal,
  giftSavingAmount,
  checkoutShip,
  baseCheckoutShip,
  autoShipSupport,
  configSupportLimit,
  customerExtraShip,
  shippingConfig,
  checkoutTotal,
  cart,
  promoDiscount,
  fulfillmentType,
  deliveryDistanceKm,
  setIsDeliveryFeeModalOpen
}) {
  return (
    <>
      <CheckoutMilestoneSuggest
        subtotal={subtotal}
        addToCart={addToCart}
        openOptionModal={openOptionModal}
        products={products}
        toppings={toppings}
        coupons={coupons}
        smartPromotions={smartPromotions}
      />

      <CheckoutCard title="Khuyến mãi">
        <button onClick={() => setIsPromoModalOpen(true)} className="promo-select">
          {selectedPromo ? `${selectedPromo.code} · -${formatMoney(selectedPromo.discount)}` : "Chọn mã khuyến mãi"} <span>›</span>
        </button>
      </CheckoutCard>

      <CheckoutCard title="Dùng điểm thưởng">
        <div className="points-row">
          <div>
            <strong>Bạn có {availablePoints.toLocaleString("vi-VN")} điểm</strong>
            <span>
              {usePoints
                ? `Đã áp dụng -${formatMoney(pointsDiscount)} vào đơn hàng`
                : `Bạn sẽ nhận được +${earnedPreviewPoints} điểm khi đặt đơn`}
            </span>
          </div>
          <input
            type="checkbox"
            checked={usePoints}
            onChange={(event) => setUsePoints(event.target.checked)}
            className="toggle-input"
          />
        </div>
      </CheckoutCard>

      <CheckoutCard title="Phương thức thanh toán">
        <button className="payment-card active">
          <Icon name="bag" size={18} />
          <span>
            <strong>Tiền mặt (COD)</strong>
            <small>Thanh toán khi nhận hàng</small>
          </span>
        </button>
      </CheckoutCard>

      <CheckoutTotalCard
        subtotal={subtotal}
        originalSubtotal={originalSubtotal}
        giftSavingAmount={giftSavingAmount}
        ship={checkoutShip}
        originalShip={baseCheckoutShip}
        shippingSupportDiscount={autoShipSupport}
        shippingSupportMax={configSupportLimit}
        customerExtraShip={customerExtraShip}
        supportShippingEnabled={Boolean(shippingConfig.supportShippingEnabled)}
        total={checkoutTotal}
        count={cart.reduce((sum, item) => sum + item.quantity, 0)}
        promoDiscount={promoDiscount}
        promoCode={selectedPromo?.code}
        pointsDiscount={pointsDiscount}
        fulfillmentType={fulfillmentType}
        distanceKm={deliveryDistanceKm}
        onShowDeliveryFee={() => setIsDeliveryFeeModalOpen(true)}
      />
    </>
  );
}

