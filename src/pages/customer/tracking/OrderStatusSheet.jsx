import { Fragment } from "react";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { CustomerCard } from "../../../components/customer/CustomerUI.jsx";
import { formatMoney } from "../../../utils/format.js";
import { getOrderItemOptionLabels } from "../../../utils/orderItemDisplay.js";
import { getCanonicalOrderBranchName, getOrderSourceBadge } from "../../../services/partnerOrderService.js";

export default function OrderStatusSheet({
  order,
  step,
  formatOrderTime,
  branches = [],
  canViewFullOrderCode,
  maskOrderCode,
  onClose
}) {
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
  const sourceBadge = getOrderSourceBadge(order);
  const branchName = getCanonicalOrderBranchName(order, branches);
  const displayOrderCode = isPartnerOrder
    ? order.displayOrderCode || order.orderCode || "FoodApp"
    : canViewFullOrderCode ? order.orderCode : maskOrderCode(order.orderCode);
  const deliveryStep = {
    title: "Đang giao",
    text: "Đơn đang được giao đến bạn, vui lòng để ý điện thoại nhé."
  };
  const steps = [
    {
      title: "Đã xác nhận",
      text: "Quán đã nhận thông tin đơn hàng của bạn."
    },
    {
      title: "Đang làm",
      text: "Bếp đang chuẩn bị món, bạn chờ một chút nhé."
    },
    ...(!isPickupOrder ? [deliveryStep] : []),
    {
      title: "Hoàn thành",
      text: "Đơn hàng đã hoàn tất."
    }
  ];

  return (
    <CustomerBottomSheet
      ariaLabel="Trạng thái đơn hàng"
      onClose={onClose}
      className="promo-sheet"
      showHeader={false}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="customer-caption">{formatOrderTime(order.createdAt)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate customer-title-lg">{displayOrderCode}</h2>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[11px] font-black ${sourceBadge.className}`}>
              {sourceBadge.label}
            </span>
          </div>
          <p className="mt-1 customer-body">{orderItems.length} món · {formatMoney(order.totalAmount || 0)}</p>
        </div>
        <button type="button" onClick={onClose} className="customer-icon-button shrink-0" aria-label="Đóng">
          ×
        </button>
      </div>

      <CustomerCard className="mt-5 space-y-4">
        {steps.map((item, index) => {
          const active = index <= step;
          const current = index === step;
          return (
            <div key={item.title} className="flex items-start gap-3">
              <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-sm font-black ${active ? "bg-orange-600 text-white" : "bg-cream text-brown/35"}`}>
                {active ? "✓" : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-brown">{item.title}</strong>
                  {current && <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black uppercase text-orange-600">Hiện tại</span>}
                </div>
                <p className="mt-1 text-xs leading-5 text-brown/55">{item.text}</p>
              </div>
            </div>
          );
        })}
      </CustomerCard>

      <div className="order-detail-box">
        <div className="order-detail-head">
          <h3>Chi tiết đơn</h3>
          <span>{orderItems.length} món</span>
        </div>

        <div className="order-info-grid">
          <div>
            <span>Hình thức</span>
            <strong>{isPickupOrder ? "Tự đến lấy" : "Giao tận nơi"}</strong>
          </div>
          <div>
            <span>Thanh toán</span>
            <strong>{order.paymentMethod || "COD"}</strong>
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
                <strong>{order.distanceKm ? `${Number(order.distanceKm).toFixed(1)}km` : "Chưa rõ"}</strong>
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
            <span>Phí giao hàng{order.distanceKm ? ` (${Number(order.distanceKm).toFixed(1)}km)` : ""}</span>
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
    </CustomerBottomSheet>
  );
}
