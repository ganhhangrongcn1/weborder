import { PosIcon } from "./PosPrimitives.jsx";
import { PaymentMethodButton } from "./PosPaymentModals.jsx";
import { formatMoney, toNumber } from "./posHelpers.js";

function CompactCartItem({ item, onQuantityChange, onRemove }) {
  const options = Array.isArray(item.options) ? item.options.slice(0, 3) : [];

  return (
    <article className="pos-compact-cart-item">
      <div className="pos-cart-item-main">
        <strong title={item.name}>{item.name}</strong>
        {options.length ? (
          <div className="pos-cart-option-tags">
            {options.map((option) => <span key={option}>{option}</span>)}
          </div>
        ) : null}
        {item.note ? <small>{item.note}</small> : null}
      </div>
      <div className="pos-cart-item-actions">
        <button type="button" onClick={() => onQuantityChange(item.cartId, item.quantity - 1)}>-</button>
        <span>{item.quantity}</span>
        <button type="button" onClick={() => onQuantityChange(item.cartId, item.quantity + 1)}>+</button>
        <button type="button" className="is-danger" onClick={() => onRemove(item.cartId)}>×</button>
      </div>
      <strong className="pos-cart-line-total">{formatMoney(item.lineTotal)}</strong>
    </article>
  );
}

function CustomerLookupCard({ customerLookup, onOpen }) {
  if (!customerLookup.result) return null;
  const customer = customerLookup.result;
  const points = toNumber(customer.loyalty?.totalPoints || customer.totalPoints, 0);

  return (
    <button type="button" className="pos-customer-card" onClick={onOpen}>
      <span>Khách hàng</span>
      <strong>{customer.customerName || customer.name || "Khách đã đăng ký"}</strong>
      <small>{customer.phone}</small>
      <em>{points.toLocaleString("vi-VN")} điểm</em>
    </button>
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
  paymentMethod,
  paymentConfirmed,
  qrDraftOrder,
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
  const paymentLabel = paymentMethod === "bank_qr" ? "QR chuyển khoản" : "Tiền mặt";
  const isQrWaiting = Boolean(qrDraftOrder && !paymentConfirmed);

  return (
    <aside className="pos-cart-panel">
      <div className="pos-order-fields">
        <label>
          <span>Tên khách</span>
          <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Không bắt buộc" disabled={draftLocked} />
        </label>
        <label>
          <span>Số điện thoại</span>
          <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Không bắt buộc" inputMode="tel" disabled={draftLocked} />
        </label>
      </div>
      <CustomerLookupCard customerLookup={customerLookup} onOpen={() => {}} />
      {cart.length ? (
        <div className="pos-cart-tools">
          <button type="button" className="pos-cart-clear-button" onClick={onClear} title="Xóa bill" aria-label="Xóa bill">
            <PosIcon name="trash" />
          </button>
        </div>
      ) : null}
      <div className="pos-cart-list">
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
      <div className="pos-cart-footer">
        <div className="pos-total-box">
          <div>
            <span>Số món</span>
            <strong>{totals.quantity}</strong>
          </div>
          <div>
            <span>Tạm tính</span>
            <strong>{formatMoney(totals.subtotal)}</strong>
          </div>
          <div className="pos-grand-total">
            <span>Tổng cộng</span>
            <strong>{formatMoney(totals.total)}</strong>
          </div>
        </div>
        <section className="pos-payment-box pos-payment-box--footer">
          <div className="pos-payment-methods pos-payment-methods--footer">
            <PaymentMethodButton active={paymentMethod === "cash"} iconName="cash" label="Tiền mặt" disabled={draftLocked} onClick={onOpenCashPayment} />
            <PaymentMethodButton active={paymentMethod === "bank_qr"} iconName="qr" label="QR chuyển khoản" onClick={onOpenQrPayment} />
          </div>
          {paymentConfirmed ? (
            <div className="pos-payment-status">
              <span>Đã xác nhận thanh toán</span>
              <strong>{paymentLabel} · {paymentConfirmed.reference}</strong>
            </div>
          ) : isQrWaiting ? (
            <div className="pos-payment-status">
              <span>Đơn đang chờ chuyển khoản</span>
              <strong>{qrDraftOrder.displayOrderCode || qrDraftOrder.orderCode}</strong>
            </div>
          ) : null}
        </section>
        {createError ? <div className="pos-create-message is-error">{createError}</div> : null}
        <button type="button" className="pos-checkout-button" disabled={!cart.length || creatingOrder || isQrWaiting || !paymentConfirmed} onClick={onCreateOrder}>
          {creatingOrder ? "Đang tạo đơn..." : "Tạo đơn takeaway"}
        </button>
      </div>
    </aside>
  );
}

