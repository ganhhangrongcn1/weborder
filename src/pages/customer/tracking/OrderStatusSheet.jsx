import { Fragment } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import OrderJourneyTimeline from "../../../components/customer/OrderJourneyTimeline.jsx";
import { CustomerButton } from "../../../components/customer/CustomerUI.jsx";
import { formatMoney } from "../../../utils/format.js";
import { getOrderItemOptionLabels } from "../../../utils/orderItemDisplay.js";
import { getCanonicalOrderBranchName, getOrderSourceBadge } from "../../../services/partnerOrderService.js";
import { getCustomerOrderJourney } from "../../../services/customerOrderStatusService.js";
import { isPrepaidPickupOrder, isQrOrderPaid } from "../../../services/qrPaymentService.js";
import CustomerOrderActionPanel from "../../../components/customer/CustomerOrderActionPanel.jsx";

const DISTANCE_FORMATTER = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});
const PAYMENT_METHOD_LABELS = {
  cash: "Tiền mặt",
  cod: "Tiền mặt khi nhận món",
  bankqr: "Chuyển khoản QR",
  qr: "Chuyển khoản QR",
  sepay: "Chuyển khoản QR",
  momo: "Ví MoMo",
  counter: "Thanh toán tại quầy"
};

function getPaymentMethodLabel(value = "") {
  const rawValue = String(value || "COD").trim();
  const normalizedValue = rawValue.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return PAYMENT_METHOD_LABELS[normalizedValue] || rawValue;
}

function formatDistance(value) {
  const distance = Number(value || 0);
  if (!Number.isFinite(distance) || distance <= 0) return "Chưa rõ";
  return `${DISTANCE_FORMATTER.format(distance)} km`;
}

export default function OrderStatusSheet({
  order,
  formatOrderTime,
  branches = [],
  canViewFullOrderCode,
  maskOrderCode,
  initialShowDetails = false,
  canReorder = false,
  onReorder,
  onContinuePayment,
  onCancelUnpaid,
  isCancelling = false,
  cancelMessage = "",
  onClose
}) {
  const [showDetails, setShowDetails] = useState(initialShowDetails);
  const orderItems = order.items || [];
  const subtotalValue = Number(order.subtotal ?? orderItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
  const originalShippingFee = Number(order.originalShippingFee ?? order.shippingFee ?? order.deliveryFee ?? 0);
  const shippingSupportDiscount = Number(order.shippingSupportDiscount || 0);
  const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0);
  const promoDiscount = Number(order.promoDiscount || 0);
  const pointsDiscount = Number(order.pointsDiscount || 0);
  const totalValue = Number(order.totalAmount || order.total || 0);
  const netReceivedValue = Number(order.netReceivedAmount || order.loyaltyEligibleAmount || 0);
  const isPickupOrder = order.fulfillmentType === "pickup";
  const isPartnerOrder = order.sourceType === "partner";
  const journey = getCustomerOrderJourney(order);
  const isPrepaidOrder = isPrepaidPickupOrder(order);
  const isPaidOrder = isPrepaidOrder && isQrOrderPaid(order);
  const isAwaitingPayment = isPrepaidOrder && journey.statusKey === "awaiting_payment";
  const sourceBadge = getOrderSourceBadge(order);
  const branchName = getCanonicalOrderBranchName(order, branches);
  const displayOrderCode = isPartnerOrder
    ? order.displayOrderCode || order.orderCode || "FoodApp"
    : canViewFullOrderCode
      ? order.displayOrderCode || order.orderCode
      : maskOrderCode(order.displayOrderCode || order.orderCode);
  const sheet = (
    <CustomerBottomSheet
      ariaLabel="Trạng thái đơn hàng"
      onClose={onClose}
      backdropClassName="order-status-sheet-backdrop"
      className="promo-sheet order-status-sheet"
      showHeader={false}
    >
      <div className="order-status-sheet__header flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="customer-caption">{formatOrderTime(order.createdAt)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="customer-modal-title min-w-0 truncate text-brown">{displayOrderCode}</h2>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[11px] font-black ${sourceBadge.className}`}>
              {sourceBadge.label}
            </span>
          </div>
          <p className="mt-1 customer-body">{orderItems.length} món · {formatMoney(order.totalAmount || 0)}</p>
          {!isPartnerOrder ? <p className="mt-2 text-sm font-bold text-brown/75">{journey.title}</p> : null}
        </div>
        <button type="button" onClick={onClose} className="customer-icon-button shrink-0" aria-label="Đóng">
          ×
        </button>
      </div>

      {!isPartnerOrder ? (
        <div className="mt-5">
          <OrderJourneyTimeline order={order} compact />
        </div>
      ) : null}

      {!showDetails ? (
        <button type="button" className="order-journey-detail-trigger" onClick={() => setShowDetails(true)}>
          <span><Icon name="eye" size={17} /></span>
          <span>
            <strong>Xem chi tiết đơn</strong>
            <small>Món đã chọn, địa chỉ và thanh toán</small>
          </span>
          <i aria-hidden="true">›</i>
        </button>
      ) : (
        <>
      <div className="order-detail-box">
        <div className="order-detail-head">
          <h3>Chi tiết đơn</h3>
          <div className="order-detail-head__actions">
            <span>{orderItems.length} món</span>
            <button type="button" onClick={() => setShowDetails(false)}>
              <Icon name="back" size={14} />
              Thu gọn
            </button>
          </div>
        </div>

        <div className="order-info-grid">
          <div>
            <span>Hình thức</span>
            <strong>{isPickupOrder ? "Tự đến lấy" : "Giao tận nơi"}</strong>
          </div>
          <div>
            <span>Thanh toán</span>
            <strong>{getPaymentMethodLabel(order.paymentMethod || order.payment_method)}</strong>
          </div>

          {isPickupOrder ? (
            <Fragment>
              <div className="wide">
                <span>Chi nhánh lấy</span>
                <strong>{branchName || "Gánh Hàng Rong"}</strong>
                <small>{order.branchAddress}</small>
              </div>
              <div className="wide">
                <span>Giờ lấy</span>
                <strong>{order.pickupTimeText || "Sớm nhất"}</strong>
              </div>
            </Fragment>
          ) : (
            <Fragment>
              <div className="wide">
                <span>Người nhận</span>
                <strong>{order.customerName || "Khách"} - {order.customerPhone || order.phone || ""}</strong>
              </div>
              <div className="wide">
                <span>Địa chỉ</span>
                <strong>{canViewFullOrderCode ? order.deliveryAddress || "Chưa có địa chỉ" : "Địa chỉ đã được ẩn"}</strong>
              </div>
              <div>
                <span>Khoảng cách</span>
                <strong>{formatDistance(order.distanceKm)}</strong>
              </div>
            </Fragment>
          )}
        </div>

        <div className="order-detail-list">
          {orderItems.map((item, index) => {
            const options = getOrderItemOptionLabels(item);
            const lineTotal = item.lineTotal || (item.unitTotal || item.price || 0) * (item.quantity || 1);
            return (
              <div key={item.cartId || `${order.orderCode}-${item.id || "item"}-${item.name || "name"}-${index}`} className="order-detail-item">
                <div>
                  <strong>{item.name}</strong>
                  <span>x{item.quantity || 1}</span>
                  {options.length > 0 && <p>{options.join(" · ")}</p>}
                </div>
                <em>{formatMoney(lineTotal)}</em>
              </div>
            );
          })}
        </div>

        <div className="order-detail-total">
          <span>Tạm tính</span>
          <strong>{formatMoney(subtotalValue)}</strong>
        </div>

        {!isPickupOrder && (
          <div className="order-detail-total compact">
            <span>Phí giao hàng{order.distanceKm ? ` (${formatDistance(order.distanceKm)})` : ""}</span>
            <strong>
              {shippingSupportDiscount > 0 ? (
                <Fragment>
                  <s>{formatMoney(originalShippingFee)}</s> {formatMoney(shippingFee)}
                </Fragment>
              ) : (
                formatMoney(shippingFee)
              )}
            </strong>
          </div>
        )}

        {shippingSupportDiscount > 0 && (
          <div className="order-detail-total discount">
            <span>GHR hỗ trợ phí ship</span>
            <strong>-{formatMoney(shippingSupportDiscount)}</strong>
          </div>
        )}

        {promoDiscount > 0 && (
          <div className="order-detail-total discount">
            <span>Mã giảm giá {order.promoCode || ""}</span>
            <strong>-{formatMoney(promoDiscount)}</strong>
          </div>
        )}

        {pointsDiscount > 0 && (
          <div className="order-detail-total discount">
            <span>Dùng điểm thưởng</span>
            <strong>-{formatMoney(pointsDiscount)}</strong>
          </div>
        )}

        <div className="order-detail-total grand">
          <span>Tổng thanh toán</span>
          <strong>{formatMoney(totalValue)}</strong>
        </div>

        {isPartnerOrder && netReceivedValue > 0 ? (
          <div className="order-detail-total compact">
            <span>Thực nhận tính điểm</span>
            <strong>{formatMoney(netReceivedValue)}</strong>
          </div>
        ) : null}
      </div>

      <button type="button" className="order-detail-collapse-footer" onClick={() => setShowDetails(false)}>
        <Icon name="back" size={15} />
        Thu gọn chi tiết
      </button>

      {canReorder && orderItems.length > 0 && typeof onReorder === "function" ? (
        <div className="order-detail-actions">
          <CustomerButton full icon="cart" onClick={onReorder}>
            Đặt lại đơn này
          </CustomerButton>
          <p>Giá và tình trạng món sẽ được cập nhật theo menu hiện tại.</p>
        </div>
      ) : null}
        </>
      )}

      {isAwaitingPayment ? (
        <CustomerOrderActionPanel
          onContinuePayment={onContinuePayment}
          onCancel={onCancelUnpaid}
          isCancelling={isCancelling}
          message={cancelMessage}
        />
      ) : isPaidOrder ? (
        <CustomerOrderActionPanel mode="paid" />
      ) : null}
    </CustomerBottomSheet>
  );

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.querySelector(".customer-shell") || document.body);
}
