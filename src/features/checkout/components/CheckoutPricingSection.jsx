import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import Icon from "../../../components/Icon.jsx";
import CheckoutCard from "./CheckoutCard.jsx";
import CheckoutTotalCard from "./CheckoutTotalCard.jsx";
import CustomerSelectionIndicator from "../../../components/customer/CustomerSelectionIndicator.jsx";

export default function CheckoutPricingSection({
  subtotal,
  navigate,
  promoCodes = [],
  selectedPromo,
  setSelectedPromo,
  setIsPromoModalOpen,
  availablePoints,
  usePoints,
  setUsePoints,
  pointsDiscount,
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
  webMomoEnabled = true,
  webBankQrEnabled = false,
  webCounterPaymentEnabled = true,
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
      : selectedPromo.code
    : hasPromoCodes
      ? "Chọn mã phù hợp với đơn"
      : "Hiện chưa có voucher áp dụng";
  const formattedAvailablePoints = Number(availablePoints || 0).toLocaleString("vi-VN");
  const formattedEarnedPoints = Number(earnedPreviewPoints || 0).toLocaleString("vi-VN");
  const canUsePoints = availablePoints > 0 && maxPointDiscount > 0;


  return (
    <>
      <section className="checkout-pricing-group" aria-label="Ưu đãi và tổng tiền">
      {showMemberBenefits ? (
        <CheckoutCard title={<span className="checkout-benefit-heading"><Icon name="ticket" size={23} />Ưu đãi & điểm Gánh</span>} className="checkout-benefits-card">
          <div className="checkout-benefit-stack">
            <CustomerControl
              type="button"
              onClick={() => setIsPromoModalOpen(true)}
              className={`promo-select${selectedPromo ? " is-applied" : ""}`}
            >
              <i className="checkout-promo-icon" aria-hidden="true"><Icon name="ticket" size={23} /></i>
              <span className="promo-select__copy">
                <strong>{promoSummary}</strong>
                <small>{selectedPromo?.title || "Xem điều kiện và chọn mã phù hợp"}</small>
              </span>
              <span className="promo-select__status">
                {selectedPromo && <Icon name="check" size={14} />}
                {selectedPromo ? "Đã áp dụng" : hasPromoCodes ? "Chọn" : "Chưa có"}
                <Icon name="back" size={14} />
              </span>
            </CustomerControl>

            <label className={`points-row${canUsePoints ? "" : " is-disabled"}`}>
              <i className="checkout-points-icon" aria-hidden="true"><Icon name="coins" size={24} /></i>
              <div className="checkout-points-copy">
                <strong>Dùng điểm Gánh</strong>
                <span>{formattedAvailablePoints} điểm khả dụng</span>
                {!canUsePoints && availablePoints > 0 && <small className="points-limit-note">Đơn này chưa đủ điều kiện dùng điểm.</small>}
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
            <div className="checkout-earned-points"><Icon name="coins" size={20} /><p>Điểm dự kiến cho đơn này: <strong>+{formattedEarnedPoints} điểm</strong></p></div>
          </div>
        </CheckoutCard>
      ) : isQrCounterOrder ? (
        <>
          <CheckoutCard title={<span className="checkout-benefit-heading"><Icon name="ticket" size={23} />Voucher của quán</span>} className="checkout-benefits-card">
            <div className="checkout-benefit-stack">
              <CustomerControl
                type="button"
                onClick={() => setIsPromoModalOpen(true)}
                className={`promo-select${selectedPromo ? " is-applied" : ""}`}
                disabled={!hasPromoCodes}
              >
                <i className="checkout-promo-icon" aria-hidden="true"><Icon name="ticket" size={23} /></i>
                <span className="promo-select__copy">
                  <small>Mã ưu đãi</small>
                  <strong>{promoSummary}</strong>
                </span>
                <span className="promo-select__status">
                  {selectedPromo && <Icon name="check" size={14} />}
                  {selectedPromo ? "Đã áp dụng" : hasPromoCodes ? "Chọn" : "Chưa có"}
                  <Icon name="back" size={14} />
                </span>
              </CustomerControl>
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
                <CustomerControl type="button" className="qr-member-checkout-note__cta" onClick={() => navigate?.("account", "account")}>
                  Đăng nhập ngay
                </CustomerControl>
              </div>
            </div>
          </CheckoutCard>
        </>
      ) : (
        <CheckoutCard title="Ưu đãi & điểm Gánh">
          <div className="checkout-benefit-stack">
            <CustomerControl type="button" onClick={() => setIsPromoModalOpen(true)} className="promo-select">
              <span className="promo-select__copy">
                <small>Mã ưu đãi</small>
                <strong>Chọn mã phù hợp với đơn</strong>
              </span>
              <span className="promo-select__status">
                Chọn
                <Icon name="back" size={14} />
              </span>
            </CustomerControl>
          </div>
          <div className="mt-3 rounded-2xl bg-orange-50 px-3 py-3 text-sm font-semibold text-orange-700">
            Đăng nhập để dùng voucher thành viên và điểm tích lũy của bạn.
          </div>
        </CheckoutCard>
      )}

      <CheckoutTotalCard
        title="Chi tiết thanh toán"
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
      </section>

      <CheckoutCard title="Phương thức thanh toán" className="checkout-payment-card">
        {isQrCounterOrder || fulfillmentType === "pickup" ? (
          <div className="payment-choice-stack">
            {webMomoEnabled ? (
              <CustomerControl
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
                <CustomerSelectionIndicator selected={isMomoSelected} className="payment-card__selected" />
              </CustomerControl>
            ) : null}
            {webBankQrEnabled ? (
              <CustomerControl
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
                <CustomerSelectionIndicator selected={isBankQrSelected} className="payment-card__selected" />
              </CustomerControl>
            ) : null}
            {webCounterPaymentEnabled ? (
              <CustomerControl
                type="button"
                onClick={() => setPaymentMethod?.("counter")}
                className={`payment-card${isCounterSelected ? " active" : ""}`}
                aria-label="Phương thức thanh toán: Thanh toán tại quầy"
                aria-pressed={isCounterSelected}
              >
                <Icon name="bag" size={18} />
                <span>
                  <strong>Thanh toán tại quầy</strong>
                  <small>{Number(checkoutTotal) === 0 ? "Đơn 0đ · Không cần thanh toán" : "Thanh toán khi nhận món"}</small>
                </span>
                <CustomerSelectionIndicator selected={isCounterSelected} className="payment-card__selected" />
              </CustomerControl>
            ) : null}
          </div>
        ) : (
          <div className="payment-card active" aria-label="Phương thức thanh toán: Tiền mặt">
            <Icon name="bag" size={18} />
            <span>
              <strong>Tiền mặt</strong>
              <small>Thanh toán khi nhận món</small>
            </span>
            <CustomerSelectionIndicator selected className="payment-card__selected" />
          </div>
        )}
      </CheckoutCard>
    </>
  );
}
