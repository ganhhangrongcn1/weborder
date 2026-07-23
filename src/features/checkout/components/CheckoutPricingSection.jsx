import Icon from "../../../components/Icon.jsx";
import CheckoutMilestoneSuggest from "./CheckoutMilestoneSuggest.jsx";
import CheckoutCard from "./CheckoutCard.jsx";
import CheckoutTotalCard from "./CheckoutTotalCard.jsx";
import { formatMoney } from "../../../utils/format.js";

export default function CheckoutPricingSection({
  subtotal,
  addToCart,
  openOptionModal,
  navigate,
  promoCodes = [],
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
  maxRedemptionPercent = 50,
  maxPointDiscount = 0,
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
  setIsDeliveryFeeModalOpen,
  isRegisteredCustomer = false,
  isQrCounterOrder = false,
  webBankQrEnabled = false,
  paymentMethod = "COD",
  setPaymentMethod
}) {
  const showMemberBenefits = !isQrCounterOrder || isRegisteredCustomer;
  const isBankQrSelected = String(paymentMethod || "").toLowerCase() === "bank_qr";
  const isMomoSelected = String(paymentMethod || "").toLowerCase() === "momo";
  const isCounterSelected = !isBankQrSelected && !isMomoSelected;
  const hasPromoCodes = promoCodes.length > 0;
  const promoSummary = selectedPromo
    ? selectedPromo.freeShip
      ? `${selectedPromo.code} · Hỗ trợ phí ship`
      : `${selectedPromo.code} · Tiết kiệm ${formatMoney(selectedPromo.discount)}`
    : hasPromoCodes
      ? "Chọn mã phù hợp với đơn"
      : "Hiện chưa có voucher áp dụng";
  const formattedAvailablePoints = Number(availablePoints || 0).toLocaleString("vi-VN");
  const formattedEarnedPoints = Number(earnedPreviewPoints || 0).toLocaleString("vi-VN");
  const canUsePoints = availablePoints > 0 && maxPointDiscount > 0;

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

      {showMemberBenefits ? (
        <CheckoutCard title="Ưu đãi & điểm Gánh" className="checkout-benefits-card">
          <div className="checkout-benefit-stack">
            <button
              type="button"
              onClick={() => setIsPromoModalOpen(true)}
              className={`promo-select${selectedPromo ? " is-applied" : ""}`}
            >
              <span className="promo-select__copy">
                <small>Mã ưu đãi</small>
                <strong>{promoSummary}</strong>
              </span>
              <span className="promo-select__status">
                {selectedPromo ? "Đã áp dụng" : hasPromoCodes ? "Chọn" : "Chưa có"}
                <Icon name="back" size={14} />
              </span>
            </button>

            <label className={`points-row${canUsePoints ? "" : " is-disabled"}`}>
              <div>
                <strong>{usePoints ? `Đã giảm ${formatMoney(pointsDiscount)} bằng điểm` : "Dùng điểm Gánh"}</strong>
                <span>
                  {usePoints
                    ? `Đơn hàng đã được trừ ${formatMoney(pointsDiscount)}.`
                    : canUsePoints
                      ? `Bạn có ${formattedAvailablePoints} điểm • Giảm tối đa ${formatMoney(maxPointDiscount)}`
                      : `Bạn có ${formattedAvailablePoints} điểm`}
                </span>
                <small className="points-limit-note">
                  Đặt đơn này nhận thêm +{formattedEarnedPoints} điểm. Có thể dùng điểm cho tối đa {maxRedemptionPercent}% tiền món sau ưu đãi.
                </small>
              </div>
              <input
                type="checkbox"
                checked={usePoints}
                onChange={(event) => setUsePoints(event.target.checked)}
                className="toggle-input"
                aria-label="Dùng điểm thưởng cho đơn hàng"
                disabled={!canUsePoints}
              />
            </label>
          </div>
        </CheckoutCard>
      ) : isQrCounterOrder ? (
        <>
          <CheckoutCard title="Voucher của quán" className="checkout-benefits-card">
            <div className="checkout-benefit-stack">
              <button
                type="button"
                onClick={() => setIsPromoModalOpen(true)}
                className={`promo-select${selectedPromo ? " is-applied" : ""}`}
                disabled={!hasPromoCodes}
              >
                <span className="promo-select__copy">
                  <small>Mã ưu đãi</small>
                  <strong>{promoSummary}</strong>
                </span>
                <span className="promo-select__status">
                  {selectedPromo ? "Đã áp dụng" : hasPromoCodes ? "Chọn" : "Chưa có"}
                  <Icon name="back" size={14} />
                </span>
              </button>
            </div>
          </CheckoutCard>

          <CheckoutCard title="Thành viên Gánh" className="qr-member-checkout-card">
            <div className="qr-member-checkout-note">
              <Icon name="gift" size={18} />
              <div className="qr-member-checkout-note__content">
                <span className="qr-member-checkout-note__text">
                  <strong>Đăng nhập để sử dụng điểm tích lũy và mã ưu đãi.</strong>
                  <small>Khi đăng nhập, voucher cá nhân sẽ được gộp chung và ưu tiên hiển thị trước.</small>
                </span>
                <button type="button" className="qr-member-checkout-note__cta" onClick={() => navigate?.("account", "account")}>
                  Đăng nhập ngay
                </button>
              </div>
            </div>
          </CheckoutCard>
        </>
      ) : (
        <CheckoutCard title="Ưu đãi & điểm Gánh">
          <div className="checkout-benefit-stack">
            <button type="button" onClick={() => setIsPromoModalOpen(true)} className="promo-select">
              <span className="promo-select__copy">
                <small>Mã ưu đãi</small>
                <strong>Chọn mã phù hợp với đơn</strong>
              </span>
              <span className="promo-select__status">
                Chọn
                <Icon name="back" size={14} />
              </span>
            </button>
          </div>
          <div className="mt-3 rounded-2xl bg-orange-50 px-3 py-3 text-sm font-semibold text-orange-700">
            Đăng nhập để dùng voucher thành viên và điểm tích lũy của bạn.
          </div>
        </CheckoutCard>
      )}

      <CheckoutCard title="Phương thức thanh toán">
        {isQrCounterOrder || fulfillmentType === "pickup" ? (
          <div className="payment-choice-stack">
            <button
              type="button"
              onClick={() => setPaymentMethod?.("momo")}
              className={`payment-card payment-card--momo${isMomoSelected ? " active" : ""}`}
              aria-label="Phương thức thanh toán: Thanh toán ví MoMo"
              aria-pressed={isMomoSelected}
            >
              <img
                className="payment-card__brand payment-card__brand--momo"
                src="/brand/momo-logo-app.png"
                alt=""
                width="32"
                height="32"
                decoding="async"
              />
              <span>
                <strong>Thanh toán ví MoMo</strong>
                <small>Mở ứng dụng MoMo</small>
              </span>
              {isMomoSelected ? <span className="payment-card__selected" aria-hidden="true">✓</span> : null}
            </button>
            {webBankQrEnabled ? (
              <button
                type="button"
                onClick={() => setPaymentMethod?.("bank_qr")}
                className={`payment-card${isBankQrSelected ? " active" : ""}`}
                aria-label="Phương thức thanh toán: QR ngân hàng"
                aria-pressed={isBankQrSelected}
              >
                <Icon name="qr" size={18} />
                <span>
                  <strong>QR ngân hàng</strong>
                  <small>Quét mã bằng ứng dụng ngân hàng</small>
                </span>
                {isBankQrSelected ? <span className="payment-card__selected" aria-hidden="true">✓</span> : null}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPaymentMethod?.("counter")}
              className={`payment-card${isCounterSelected ? " active" : ""}`}
              aria-label="Phương thức thanh toán: Thanh toán tại quầy"
              aria-pressed={isCounterSelected}
            >
              <Icon name="bag" size={18} />
              <span>
                <strong>Thanh toán tại quầy</strong>
                <small>Thanh toán khi nhận món</small>
              </span>
              {isCounterSelected ? <span className="payment-card__selected" aria-hidden="true">✓</span> : null}
            </button>
          </div>
        ) : (
          <div className="payment-card active" aria-label="Phương thức thanh toán: Tiền mặt">
            <Icon name="bag" size={18} />
            <span>
              <strong>Tiền mặt</strong>
              <small>Thanh toán khi nhận món</small>
            </span>
            <span className="payment-card__selected" aria-hidden="true">✓</span>
          </div>
        )}
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
