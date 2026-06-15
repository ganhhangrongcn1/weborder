import { useState } from "react";
import { PosIcon } from "./PosPrimitives.jsx";
import { PaymentMethodButton } from "./PosPaymentModals.jsx";
import { formatMoney, toNumber } from "./posHelpers.js";

function getVoucherId(voucher = {}) {
  const source = String(voucher.source || voucher.voucherSource || "").trim();
  const id = String(voucher.id || voucher.code || voucher.title || voucher.name || "").trim();
  return source ? `${source}:${id}` : id;
}

function CompactCartItem({ item, onQuantityChange, onRemove }) {
  const optionSummary = Array.isArray(item.options) ? item.options.slice(0, 3).join(" · ") : "";
  const isAutoGift = Boolean(item?.metadata?.autoAddedGift || item?.metadata?.giftPromotionId);

  return (
    <article className="pos-compact-cart-item">
      <div className="pos-cart-item-main">
        <div className="pos-cart-item-headline">
          <strong title={item.name}>{item.name}</strong>
          <strong className="pos-cart-line-total">{formatMoney(item.lineTotal)}</strong>
        </div>
        {isAutoGift ? <p className="pos-cart-item-option-line">Quà tặng tự động</p> : null}
        {!isAutoGift && optionSummary ? <p className="pos-cart-item-option-line">{optionSummary}</p> : null}
        {item.note ? <small>{item.note}</small> : null}
      </div>
      <div className={isAutoGift ? "pos-cart-item-actions is-locked" : "pos-cart-item-actions"}>
        {isAutoGift ? (
          <span className="pos-cart-gift-badge">Tặng</span>
        ) : (
          <>
            <button type="button" onClick={() => onQuantityChange(item.cartId, item.quantity - 1)}>-</button>
            <span>{item.quantity}</span>
            <button type="button" onClick={() => onQuantityChange(item.cartId, item.quantity + 1)}>+</button>
            <button type="button" className="is-danger" onClick={() => onRemove(item.cartId)}>×</button>
          </>
        )}
      </div>
    </article>
  );
}

function VoucherButtonList({
  title,
  vouchers,
  selectedVoucherId,
  setSelectedVoucherId,
  disabled,
  emptyText = "Chưa có voucher khả dụng."
}) {
  const hasVouchers = Array.isArray(vouchers) && vouchers.length > 0;

  return (
    <div className="pos-benefit-vouchers">
      <div className="pos-benefit-section-head">
        <strong>{title}</strong>
        <span>{hasVouchers ? vouchers.length : "0"}</span>
      </div>
      {hasVouchers ? (
        <div className="pos-benefit-voucher-list">
          {vouchers.map((voucher, index) => {
            const voucherId = getVoucherId(voucher);
            const active = voucherId && voucherId === selectedVoucherId;
            return (
              <button
                key={voucherId || `${title}-${index}`}
                type="button"
                className={active ? "is-active" : ""}
                disabled={disabled}
                onClick={() => setSelectedVoucherId(active ? "" : voucherId)}
              >
                <strong>{voucher.title || voucher.name || voucher.code || "Voucher"}</strong>
                <span>{voucher.conditionText || voucher.subtitle || voucher.code || "Áp dụng trực tiếp tại quầy"}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}

function LoyaltyBenefitBox({
  customerLookup,
  loyaltyBenefit,
  selectedVoucherId,
  setSelectedVoucherId,
  pointsInput,
  setPointsInput,
  disabled
}) {
  const customer = customerLookup.result;
  const availablePoints = toNumber(loyaltyBenefit?.availablePoints, 0);
  if (!customer && !availablePoints && !(loyaltyBenefit?.loyaltyVouchers || []).length) return null;

  return (
    <section className="pos-customer-card">
      <div className="pos-customer-head">
        <div>
          <span>Ưu đãi khách hàng</span>
          <strong>{customer?.registeredCustomer ? (customer.customerName || "Khách thành viên") : "Khách vãng lai"}</strong>
          <small>{customer?.registeredCustomer ? `${availablePoints.toLocaleString("vi-VN")} điểm loyalty khả dụng` : "Chưa có điểm loyalty khả dụng"}</small>
        </div>
        <div>
          <span>Đã giảm</span>
          <strong>{formatMoney((loyaltyBenefit?.voucherDiscount || 0) + (loyaltyBenefit?.pointsDiscount || 0))}</strong>
        </div>
      </div>

      <VoucherButtonList
        title="Voucher loyalty"
        vouchers={loyaltyBenefit?.loyaltyVouchers || []}
        selectedVoucherId={selectedVoucherId}
        setSelectedVoucherId={setSelectedVoucherId}
        disabled={disabled}
        emptyText="Khách chưa có voucher loyalty khả dụng."
      />

      {availablePoints > 0 ? (
        <>
          <label className="pos-points-input">
            <span>Dùng điểm</span>
            <input
              value={pointsInput}
              onChange={(event) => setPointsInput(event.target.value)}
              inputMode="numeric"
              placeholder="Nhập số điểm muốn dùng"
              disabled={disabled}
            />
          </label>
          <div className="pos-point-suggestions">
            {(loyaltyBenefit?.pointSuggestions || []).map((suggestion) => (
              <button
                key={`${suggestion.label}-${suggestion.points}`}
                type="button"
                disabled={disabled}
                onClick={() => setPointsInput(String(suggestion.points))}
              >
                <strong>{suggestion.points.toLocaleString("vi-VN")} điểm</strong>
                <span>{suggestion.label}</span>
              </button>
            ))}
            {String(pointsInput || "").trim() ? (
              <button type="button" disabled={disabled} onClick={() => setPointsInput("")}>
                <strong>Hủy dùng điểm</strong>
                <span>Đặt lại về 0 điểm</span>
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

function CustomerPointsOverview({ customerLookup }) {
  const customer = customerLookup.result;
  if (!customer) return null;

  const stats = customer?.stats || {};
  const claimedPoints = toNumber(stats.claimedPoints, 0);
  const pendingPoints = toNumber(stats.pendingPoints, 0);

  return (
    <section className="pos-customer-card">
      <div className="pos-customer-head">
        <div>
          <span>Tổng hợp theo SĐT</span>
          <strong>{customer?.registeredCustomer ? "Thành viên" : "Khách vãng lai"}</strong>
          <small>Gộp theo SĐT</small>
        </div>
        <div>
          <span>Tổng đơn</span>
          <strong>{toNumber(stats.totalOrders, 0).toLocaleString("vi-VN")}</strong>
        </div>
      </div>
      <div className="pos-customer-history-stats">
        <div>
          <span>Tổng mua</span>
          <strong>{formatMoney(stats.totalSpent || 0)}</strong>
        </div>
        <div>
          <span>Điểm đã tích</span>
          <strong>{claimedPoints.toLocaleString("vi-VN")} điểm</strong>
        </div>
        <div>
          <span>Điểm chờ tích</span>
          <strong>{pendingPoints.toLocaleString("vi-VN")} điểm</strong>
        </div>
      </div>
    </section>
  );
}

function GiftPromotionHints({ promotionHints = [] }) {
  if (!Array.isArray(promotionHints) || !promotionHints.length) return null;

  return (
    <div className="pos-hint-stack">
      {promotionHints.map((promotion) => (
        <article key={promotion.id} className="pos-promo-compact">
          <span>Hướng dẫn tư vấn</span>
          <strong>{promotion.eligible ? `Tặng ${promotion.rewardText}` : `Gợi ý thêm ${formatMoney(promotion.missing)}`}</strong>
          <small>{promotion.eligible ? "Đơn đã đủ mốc, nhắc khách nhận quà." : `Đủ ${formatMoney(promotion.minSubtotal)} sẽ tặng ${promotion.rewardText}.`}</small>
        </article>
      ))}
    </div>
  );
}

function buildBenefitCompactCopy({ promotionHints = [], loyaltyBenefit = {}, selectedVoucher = null }) {
  const normalVoucherCount = (loyaltyBenefit?.normalVouchers || []).length;
  const bestPromotion = Array.isArray(promotionHints) && promotionHints.length ? promotionHints[0] : null;
  const title = bestPromotion
    ? (bestPromotion.eligible ? `Đủ mốc quà: ${bestPromotion.rewardText}` : `Gợi ý thêm ${formatMoney(bestPromotion.missing)}`)
    : (selectedVoucher?.source === "checkout" ? (selectedVoucher.title || selectedVoucher.code || "Đang chọn voucher") : "Ưu đãi & tư vấn");
  const subtitleParts = [];
  if (bestPromotion) {
    subtitleParts.push(bestPromotion.eligible ? "Nhắc khách nhận quà" : `Đủ ${formatMoney(bestPromotion.minSubtotal)} có quà`);
  }
  if (normalVoucherCount) subtitleParts.push(`${normalVoucherCount} voucher`);
  if (selectedVoucher?.source === "checkout" && loyaltyBenefit?.voucherDiscount > 0) {
    subtitleParts.push(`Giảm ${formatMoney(loyaltyBenefit.voucherDiscount)}`);
  }
  return {
    title,
    subtitle: subtitleParts.length ? subtitleParts.join(" · ") : "Mở để xem chi tiết"
  };
}

function NormalVoucherModal({
  open,
  onClose,
  loyaltyBenefit,
  selectedVoucherId,
  setSelectedVoucherId,
  disabled,
  promotionHints
}) {
  if (!open) return null;

  return (
    <div className="pos-modal-layer" role="presentation">
      <button type="button" className="pos-modal-backdrop" aria-label="Đóng voucher" onClick={onClose} />
      <section className="pos-cash-payment-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span>POS</span>
            <strong>Voucher & quà tặng</strong>
          </div>
          <button type="button" onClick={onClose}>Đóng</button>
        </header>
        <GiftPromotionHints promotionHints={promotionHints} />
        <VoucherButtonList
          title="Voucher thường"
          vouchers={loyaltyBenefit?.normalVouchers || []}
          selectedVoucherId={selectedVoucherId}
          setSelectedVoucherId={setSelectedVoucherId}
          disabled={disabled}
          emptyText="Chưa có voucher thường khả dụng."
        />
        <button type="button" className="pos-modal-primary" onClick={onClose}>
          Xong
        </button>
      </section>
    </div>
  );
}

export default function PosCartPanel({
  cart,
  totals,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerLookup,
  loyaltyBenefit,
  selectedVoucherId,
  setSelectedVoucherId,
  pointsInput,
  setPointsInput,
  promotionHints,
  paymentMethod,
  paymentConfirmed,
  qrDraftOrder,
  qrDraftLoading,
  draftLocked,
  createError,
  creatingOrder,
  onOpenCashPayment,
  onOpenQrPayment,
  onQuantityChange,
  onRemove,
  onClear,
  onCreateOrder
}) {
  const [customerBenefitOpen, setCustomerBenefitOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const paymentLabel = paymentMethod === "bank_qr" ? "QR chuyển khoản" : "Tiền mặt";
  const isQrWaiting = Boolean(qrDraftOrder && !paymentConfirmed);
  const canCreateOrder = Boolean(
    cart.length &&
    !creatingOrder &&
    !isQrWaiting &&
    (paymentMethod === "cash" || Boolean(paymentConfirmed))
  );
  const customer = customerLookup.result;
  const selectedVoucher = loyaltyBenefit?.selectedVoucher || null;
  const hasCustomerValue = Boolean(String(customerName || "").trim() || String(customerPhone || "").trim());
  const phoneText = String(customerPhone || "").trim();
  const canOpenCustomer = Boolean(phoneText);
  const hasLookupResult = Boolean(customer);
  const statusText = customerLookup.loading
    ? "Đang tra khách..."
    : customerLookup.error
      ? customerLookup.error
      : hasLookupResult
        ? (customer?.registeredCustomer ? "Đã nhận diện thành viên" : "Đã nhận diện khách vãng lai")
        : (phoneText ? "Đã nhập SĐT" : "Chưa nhập SĐT");
  const statusTone = customerLookup.error
    ? "is-error"
    : customerLookup.loading
      ? "is-loading"
      : hasLookupResult
        ? "is-ready"
        : "";
  const actionLabel = customerLookup.loading ? "Đang tra" : "Xem";
  const benefitCopy = buildBenefitCompactCopy({ promotionHints, loyaltyBenefit, selectedVoucher });
  const hasBenefitCompact = Boolean(
    (promotionHints || []).length ||
    (loyaltyBenefit?.normalVouchers || []).length ||
    selectedVoucher?.source === "checkout"
  );
  return (
    <aside className="pos-cart-panel">
      <div className="pos-order-fields">
        <label>
          <span>Tên khách</span>
          <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Tên khách" disabled={draftLocked} />
        </label>
        <label>
          <span>SĐT</span>
          <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Số điện thoại" inputMode="tel" disabled={draftLocked} />
        </label>
        <div className="pos-order-field-actions">
          <button type="button" className="pos-inline-action-button" disabled={draftLocked || !canOpenCustomer || customerLookup.loading} onClick={() => setCustomerBenefitOpen(true)}>
            {actionLabel}
          </button>
          <button
            type="button"
            className="pos-inline-icon-button is-danger"
            disabled={draftLocked || !hasCustomerValue}
            onClick={() => {
              setCustomerName("");
              setCustomerPhone("");
              setCustomerBenefitOpen(false);
            }}
            aria-label="Xóa nhanh thông tin khách"
            title="Xóa nhanh"
          >
            <PosIcon name="trash" />
          </button>
        </div>
        <div className={`pos-order-field-status ${statusTone}`}>
          <span>{statusText}</span>
        </div>
      </div>

      {customerBenefitOpen ? (
        <div className="pos-modal-layer" role="presentation">
          <button type="button" className="pos-modal-backdrop" aria-label="Đóng khách hàng và ưu đãi" onClick={() => setCustomerBenefitOpen(false)} />
          <section className="pos-cash-payment-modal pos-customer-benefit-modal" role="dialog" aria-modal="true">
            <header>
              <div>
                <span>POS</span>
                <strong>Khách hàng & ưu đãi</strong>
              </div>
              <button type="button" onClick={() => setCustomerBenefitOpen(false)}>Đóng</button>
            </header>
            <div className="pos-customer-benefit-body">
              <div className="pos-order-fields">
                <label>
                  <span>Tên khách</span>
                  <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Tên khách" disabled={draftLocked} />
                </label>
                <label>
                  <span>Số điện thoại</span>
                  <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Số điện thoại" inputMode="tel" disabled={draftLocked} />
                </label>
              </div>
              <CustomerPointsOverview customerLookup={customerLookup} />
              <LoyaltyBenefitBox
                customerLookup={customerLookup}
                loyaltyBenefit={loyaltyBenefit}
                selectedVoucherId={selectedVoucherId}
                setSelectedVoucherId={setSelectedVoucherId}
                pointsInput={pointsInput}
                setPointsInput={setPointsInput}
                disabled={draftLocked || Boolean(paymentConfirmed)}
              />
            </div>
            <button type="button" className="pos-modal-primary" onClick={() => setCustomerBenefitOpen(false)}>
              Xong
            </button>
          </section>
        </div>
      ) : null}

      <NormalVoucherModal
        open={voucherOpen}
        onClose={() => setVoucherOpen(false)}
        loyaltyBenefit={loyaltyBenefit}
        selectedVoucherId={selectedVoucherId}
        setSelectedVoucherId={setSelectedVoucherId}
        disabled={draftLocked || Boolean(paymentConfirmed)}
        promotionHints={promotionHints}
      />

      {cart.length ? (
        <div className="pos-cart-tools">
          <button type="button" className="pos-cart-clear-button" onClick={onClear} title="Xóa bill" aria-label="Xóa bill">
            <PosIcon name="trash" />
          </button>
        </div>
      ) : null}

      <div className={`pos-cart-list ${cart.length ? "" : "is-empty"}`.trim()}>
        {cart.length ? cart.map((item) => (
          <CompactCartItem key={item.cartId} item={item} onQuantityChange={onQuantityChange} onRemove={onRemove} />
        )) : (
          <div className="pos-cart-empty">
            <PosIcon name="cart" />
            <strong>Chưa có món</strong>
            <span>Chọn món ở bên trái để bắt đầu tạo bill.</span>
          </div>
        )}
      </div>

      {cart.length ? (
        <div className="pos-cart-footer">
          {hasBenefitCompact ? (
            <button type="button" className="pos-benefit-compact-trigger" onClick={() => setVoucherOpen(true)}>
              <span>Ưu đãi & tư vấn</span>
              <strong>{benefitCopy.title}</strong>
              <small>{benefitCopy.subtitle}</small>
              <em>Mở</em>
            </button>
          ) : null}

          <div className="pos-total-box">
            <div>
              <span>Số món</span>
              <strong>{totals.quantity}</strong>
            </div>
            <div>
              <span>Tạm tính</span>
              <strong>{formatMoney(totals.subtotal)}</strong>
            </div>
            {totals.voucherDiscount > 0 ? (
              <div>
                <span>Voucher</span>
                <strong>-{formatMoney(totals.voucherDiscount)}</strong>
              </div>
            ) : null}
            {totals.pointsDiscount > 0 ? (
              <div>
                <span>Điểm loyalty</span>
                <strong>-{formatMoney(totals.pointsDiscount)}</strong>
              </div>
            ) : null}
            <div className="pos-grand-total">
              <span>Tổng cộng</span>
              <strong>{formatMoney(totals.total)}</strong>
            </div>
          </div>

          <section className="pos-payment-box pos-payment-box--footer">
            <div className="pos-payment-methods pos-payment-methods--footer">
              <PaymentMethodButton active={paymentMethod === "cash"} iconName="cash" label="Tiền mặt" disabled={Boolean(paymentConfirmed) || qrDraftLoading} onClick={onOpenCashPayment} />
              <PaymentMethodButton active={paymentMethod === "bank_qr"} iconName="qr" label={qrDraftLoading ? "Đang tạo QR" : "QR chuyển khoản"} disabled={qrDraftLoading} onClick={onOpenQrPayment} />
            </div>
            {paymentConfirmed ? (
              <div className="pos-payment-status">
                <span>Đã xác nhận thanh toán</span>
                <strong>{paymentLabel} · {paymentConfirmed.reference}</strong>
              </div>
            ) : isQrWaiting ? (
              <div className="pos-payment-status">
                <span>{qrDraftOrder.restored ? "Đã khôi phục · đang chờ chuyển khoản" : "Đơn đang chờ chuyển khoản"}</span>
                <strong>{qrDraftOrder.orderCode || qrDraftOrder.displayOrderCode || qrDraftOrder.id}</strong>
                <button type="button" className="pos-payment-status-action" onClick={onClear}>
                  Hủy để sửa bill
                </button>
              </div>
            ) : null}
          </section>
          {createError ? <div className="pos-create-message is-error">{createError}</div> : null}
          <button type="button" className="pos-checkout-button" disabled={!canCreateOrder} onClick={onCreateOrder}>
            {creatingOrder ? "Đang tạo đơn..." : "Tạo đơn"}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
