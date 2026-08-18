import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  Copy,
  MapPin,
  Note,
  Package,
  Receipt,
  Tag,
  Truck,
  User,
  Wallet,
  WarningCircle,
  X
} from "@phosphor-icons/react";
import { formatMoney } from "../../../utils/format.js";
import { getOrderItemOptionLabels } from "../../../utils/orderItemDisplay.js";
import { getCustomerKey } from "../../../services/storageService.js";
import { getCustomerOrderDisplayStatus } from "../../../services/customerOrderStatusService.js";
import { buildAdminOrderFeed, readPartnerOrdersForAdmin } from "../../../services/adminOrderFeedService.js";
import { resolveSalesChannelKey } from "../../../services/partnerOrderService.js";
import {
  branchOptionMatchesOrder,
  buildBranchFilterOptions
} from "../../../services/branchIdentityService.js";
import { calculateOrderPoints, getLoyaltyRuleConfig } from "../../../services/loyaltyService.js";
import { buildVietnamDateRange } from "../../../utils/adminDateRange.js";
import { AdminPagination } from "../ui/index.js";
import {
  toAdminStatus,
  formatOrderTime,
  getWaitingMinutes,
  getSettlement,
  buildShipperInfoText
} from "./orderManager.utils.js";

const STATUS_META = {
  all: { label: "Tất cả", className: "admin-order-status-all" },
  awaiting_payment: { label: "Chờ thanh toán", className: "admin-order-status-awaiting-payment" },
  payment_expired: { label: "Đã hết hạn thanh toán", className: "admin-order-status-payment-expired" },
  new: { label: "Đơn mới", className: "admin-order-status-new" },
  doing: { label: "Đang làm", className: "admin-order-status-doing" },
  delivering: { label: "Đang giao", className: "admin-order-status-delivering" },
  done: { label: "Hoàn thành", className: "admin-order-status-done" }
};
STATUS_META.cancelled = { label: "Đã hủy", className: "admin-order-status-cancelled" };
const ORDER_PAGE_SIZE = 8;

function getOrderId(order) {
  return order.id || order.orderCode;
}

function getDisplayOrderCode(order) {
  return String(order?.displayOrderCode || order?.orderCode || order?.id || "");
}

function getFulfillmentType(order) {
  return String(order.fulfillmentType || "").toLowerCase() === "pickup" ? "pickup" : "delivery";
}

function getOrderBranchName(order) {
  return [
    order.deliveryBranchName,
    order.pickupBranchName,
    order.branchName
  ].map((value) => String(value || "").trim()).find(Boolean) || "";
}

function getShortBranchName(branchName = "") {
  const text = String(branchName || "").trim();
  if (!text) return "";
  const parts = text
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : text;
}

function isReadOnlyPartnerOrder(order) {
  return String(order?.sourceType || "").toLowerCase() === "partner";
}
function getOrderSourceMeta(order) {
  const source = resolveSalesChannelKey(order);
  if (source === "grabfood") {
    return {
      label: "Grab",
      className: "is-grab"
    };
  }
  if (source === "shopeefood") {
    return {
      label: "Shopee",
      className: "is-shopee"
    };
  }
  if (source === "xanhngon") {
    return {
      label: "Xanh Ngon",
      className: "is-xanhngon"
    };
  }
  if (source === "pos") {
    return {
      label: "POS",
      className: "is-pos"
    };
  }
  if (source === "qr_counter") {
    return {
      label: "QR tại quầy",
      className: "is-qr-counter"
    };
  }
  if (source === "unknown") {
    return {
      label: "Chưa rõ",
      className: "is-unknown"
    };
  }
  if (source === "other") {
    return {
      label: "Khác",
      className: "is-other"
    };
  }
  return {
    label: "Website",
    className: "is-website"
  };
}

function getFulfillmentMeta(order) {
  const fulfillmentType = getFulfillmentType(order);
  if (fulfillmentType === "pickup") {
    return {
      label: "Tự lấy",
      className: "is-pickup"
    };
  }
  return {
    label: "Giao hàng",
    className: "is-delivery"
  };
}

function getRegisteredCustomer(order, registeredCustomersByPhone) {
  const phone = getCustomerKey(order.customerPhone || order.phone || order.customerPhoneKey);
  return phone ? registeredCustomersByPhone?.[phone] || null : null;
}

function buildBranchOptions(branches = []) {
  return buildBranchFilterOptions(branches);
}

function matchOrderBranch(order, branchOption) {
  return branchOptionMatchesOrder(order, branchOption);
}

function getDisplayStatus(order) {
  const customerStatus = getCustomerOrderDisplayStatus(order);
  if (customerStatus.key === "cancelled") {
    return customerStatus.paymentExpired ? "payment_expired" : "cancelled";
  }
  if (isOrderAwaitingPayment(order)) return "awaiting_payment";
  const rawStatus = toAdminStatus(order.status);
  return getFulfillmentType(order) === "pickup" && rawStatus === "delivering" ? "done" : rawStatus;
}

function getPaymentState(order = {}) {
  const metadata = order?.metadata && typeof order.metadata === "object" ? order.metadata : {};
  const method = String(order.paymentMethod || metadata.paymentMethod || "COD").trim().toLowerCase();
  const paymentStatus = String(
    order.paymentStatus || metadata.paymentStatus || metadata.payment_status || ""
  ).trim().toLowerCase();
  const paidAt = order.paidAt || metadata.paidAt || metadata.paid_at;
  const isPrepaid = ["momo", "bank_qr"].includes(method);
  const isExplicitlyUnpaid = [
    "unpaid", "pending", "pending_payment", "waiting_payment",
    "failed", "expired", "cancelled", "canceled"
  ].includes(paymentStatus);
  const isPaid = !isExplicitlyUnpaid && Boolean(
    paidAt || paymentStatus === "paid" || paymentStatus === "converted" ||
    order.isPaid === true || method === "foodapp"
  );

  return { isPrepaid, isPaid };
}

function isOrderAwaitingPayment(order = {}) {
  const status = String(order.status || "").trim().toLowerCase();
  const kitchenStatus = String(order.kitchenStatus || order.kitchen_status || "").trim().toLowerCase();
  const payment = getPaymentState(order);
  return payment.isPrepaid && !payment.isPaid && (
    status === "pending_payment" || kitchenStatus === "waiting_payment"
  );
}

function getPaymentStateLabel(order = {}) {
  const payment = getPaymentState(order);
  if (payment.isPaid) return "Đã thanh toán";
  if (payment.isPrepaid) return "Chưa thanh toán";
  return "Thu khi nhận";
}

function isActiveOperationalStatus(status) {
  return ["new", "doing", "delivering"].includes(String(status || "").toLowerCase());
}

function getOrderTimelineText(status, waitingMinutes) {
  if (status === "payment_expired") return "Hết hạn thanh toán";
  if (status === "awaiting_payment") return "Chờ thanh toán";
  if (isActiveOperationalStatus(status)) {
    return `${waitingMinutes > 15 ? "Trễ" : "Chờ"} ${waitingMinutes} phút`;
  }
  if (status === "done") return "Đã hoàn tất";
  return "Đã hủy";
}

function getStatusLabel(status) {
  return STATUS_META[status]?.label || STATUS_META.doing.label;
}

function getStatusClass(status) {
  return STATUS_META[status]?.className || STATUS_META.doing.className;
}

function isBlockedPointStatus(order = {}) {
  const status = String(order?.pointStatus || order?.point_status || "").trim().toLowerCase();
  return ["rejected", "expired", "cancelled", "canceled"].includes(status);
}

function getPointStatusText(order = {}, estimatedPoints = 0) {
  if (!isReadOnlyPartnerOrder(order)) {
    return estimatedPoints > 0 ? `Dự kiến +${estimatedPoints.toLocaleString("vi-VN")} điểm` : "Không có điểm";
  }
  if (hasClaimedPartnerPoints(order)) {
    return estimatedPoints > 0 ? `Đã cộng +${estimatedPoints.toLocaleString("vi-VN")} điểm` : "Đã cộng điểm";
  }
  return estimatedPoints > 0 ? `Chưa cộng điểm (+${estimatedPoints.toLocaleString("vi-VN")} điểm dự kiến)` : "Chưa cộng điểm";
}

function OrderStatusBadge({ status }) {
  const StatusIcon = ["done"].includes(status)
    ? CheckCircle
    : ["cancelled", "payment_expired"].includes(status)
      ? WarningCircle
      : Clock;
  return (
    <span className={`admin-order-status-badge ${getStatusClass(status)}`}>
      <StatusIcon size={13} weight="bold" aria-hidden="true" />
      {getStatusLabel(status)}
    </span>
  );
}

function getLatePaymentReview(order = {}) {
  const metadata = order?.metadata && typeof order.metadata === "object" ? order.metadata : order;
  const latePayment = metadata?.latePayment && typeof metadata.latePayment === "object"
    ? metadata.latePayment
    : null;
  const refundStatus = String(metadata?.refundStatus || metadata?.refund_status || "").toLowerCase();
  if (!latePayment && refundStatus !== "manual_review") return null;
  return {
    amount: Number(latePayment?.amount || order?.paymentAmount || order?.totalAmount || 0),
    provider: String(latePayment?.provider || order?.paymentMethod || "").toUpperCase()
  };
}

function CancelOrderButton({ order, status, updateOrderStatus, compact = false }) {
  if (isReadOnlyPartnerOrder(order) || status === "cancelled") return null;

  const orderId = getOrderId(order);
  const orderCode = getDisplayOrderCode(order);

  const handleCancelOrder = (event) => {
    event?.stopPropagation?.();
    const warningText = status === "done"
      ? `Đơn ${orderCode} đang ở trạng thái hoàn thành. Anh/chị vẫn muốn hủy đơn này?`
      : `Anh/chị có chắc muốn hủy đơn ${orderCode} không?`;
    if (!window.confirm(warningText)) return;
    updateOrderStatus(orderId, "cancelled");
  };

  return (
    <button
      type="button"
      className={`admin-order-cancel-btn${compact ? " is-compact" : ""}`}
      onClick={handleCancelOrder}
    >
      Hủy đơn
    </button>
  );
}

function hasClaimedPartnerPoints() {
  return false;
}

function getUnifiedPointStatusText(order = {}, estimatedPoints = 0) {
  const status = String(order?.pointStatus || order?.point_status || "").trim().toLowerCase();
  if (status === "expired") return "Đã hết hạn tích điểm";
  if (status === "claimed") {
    return estimatedPoints > 0 ? `Đã tích +${estimatedPoints.toLocaleString("vi-VN")} điểm` : "Đã tích điểm";
  }
  if (isBlockedPointStatus(order)) return "Không tích điểm";
  return estimatedPoints > 0 ? `Dự kiến +${estimatedPoints.toLocaleString("vi-VN")} điểm` : "Không có điểm";
}

function OrderStatsCards({ stats, activeFilter, onSelect }) {
  const cards = [
    { key: "total", label: "Tổng đơn", value: stats.total, hint: "Theo bộ lọc hiện tại", tone: "orange", icon: "∑" },
    { key: "new", label: "Đơn mới", value: stats.new, hint: "Chờ xử lý", tone: "amber", icon: "+" },
    { key: "doing", label: "Đang vận hành", value: stats.doing + stats.delivering, hint: "Đang làm / đang giao", tone: "blue", icon: "↻" },
    { key: "done", label: "Hoàn thành", value: stats.done, hint: "Đã xử lý xong", tone: "green", icon: "✓" },
    { key: "overdue", label: "Quá 15 phút", value: stats.overdue, hint: "Cần ưu tiên kiểm tra", tone: stats.overdue > 0 ? "red" : "slate", icon: "!" }
  ];

  return (
    <div className="admin-order-stats-grid">
      {cards.map((card) => (
        <button
          type="button"
          key={card.key}
          className={`admin-order-stat-card tone-${card.tone}${activeFilter === card.key ? " is-active" : ""}`}
          aria-pressed={activeFilter === card.key}
          onClick={() => onSelect(card.key)}
        >
          <span className="admin-order-stat-icon" aria-hidden="true">{card.icon}</span>
          <div>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </div>
        </button>
      ))}
    </div>
  );
}

function OrderHealthAlerts({ health }) {
  const alerts = [
    health.missingSource > 0
      ? `${health.missingSource} đơn chưa xác định nguồn`
      : "",
    health.missingBranch > 0
      ? `${health.missingBranch} đơn thiếu chi nhánh`
      : "",
    health.missingItems > 0
      ? `${health.missingItems} đơn thiếu món`
      : "",
    health.localPending > 0
      ? `${health.localPending} đơn POS đang chờ đồng bộ`
      : ""
  ].filter(Boolean);

  if (!alerts.length) return null;

  return (
    <div className="admin-order-health-banner is-warning">
      <strong>Cần kiểm tra dữ liệu</strong>
      <div>
        {alerts.map((alert) => (
          <span key={alert}>{alert}</span>
        ))}
      </div>
    </div>
  );
}

function OrderFilterBar({
  keyword,
  setKeyword,
  sourceFilter,
  setSourceFilter,
  fulfillmentFilter,
  setFulfillmentFilter,
  paymentFilter,
  setPaymentFilter,
  onReset
}) {
  return (
    <div className="admin-order-filter-bar">
        <label className="admin-order-search">
          <span className="admin-order-filter-label">Tìm đơn</span>
          <span className="admin-order-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            name="order-search"
            aria-label="Tìm theo mã đơn, tên khách hoặc số điện thoại"
            autoComplete="off"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Mã đơn, tên khách, số điện thoại…"
          />
        </label>
        <label className="admin-order-filter-field">
          <span className="admin-order-filter-label">Nguồn đơn</span>
          <select aria-label="Lọc theo nguồn đơn" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="website">Website</option>
            <option value="pos">POS / Mua tại quầy</option>
            <option value="qr_counter">QR tại quầy</option>
            <option value="grabfood">Grab</option>
            <option value="shopeefood">Shopee</option>
            <option value="xanhngon">Xanh Ngon</option>
            <option value="unknown">Chưa xác định</option>
            <option value="other">Khác</option>
          </select>
        </label>
        <button type="button" className="admin-order-filter-reset" onClick={onReset}>Xóa lọc</button>
        <details className="admin-order-more-filters">
          <summary>Bộ lọc thêm</summary>
          <div>
            <label className="admin-order-filter-field">
              <span className="admin-order-filter-label">Hình thức</span>
              <select aria-label="Lọc theo hình thức nhận hàng" value={fulfillmentFilter} onChange={(event) => setFulfillmentFilter(event.target.value)}>
                <option value="all">Tất cả</option>
                <option value="delivery">Giao hàng</option>
                <option value="pickup">Tự đến lấy</option>
              </select>
            </label>
            <label className="admin-order-filter-field">
              <span className="admin-order-filter-label">Thanh toán</span>
              <select aria-label="Lọc theo thanh toán" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                <option value="all">Tất cả</option>
                <option value="cod">COD</option>
                <option value="paid">Đã trả trước</option>
              </select>
            </label>
          </div>
        </details>
    </div>
  );
}

function OrderStatusSelect({ order, status, updateOrderStatus }) {
  const orderId = getOrderId(order);
  const fulfillmentType = getFulfillmentType(order);
  const isPartnerOrder = isReadOnlyPartnerOrder(order);

  if (isPartnerOrder) {
    return <span className="admin-order-status-readonly">Đồng bộ NexPOS</span>;
  }

  if (status === "awaiting_payment") {
    return <span className="admin-order-status-readonly is-awaiting-payment">Chờ thanh toán</span>;
  }

  if (status === "payment_expired") {
    return <span className="admin-order-status-readonly is-payment-expired">Đã hết hạn</span>;
  }

  if (status === "cancelled") {
    return <span className="admin-order-status-readonly is-cancelled">Đã hủy</span>;
  }

  if (status === "done") {
    return (
      <span className="admin-order-status-readonly is-done">
        {fulfillmentType === "pickup" ? "Đã làm xong" : "Hoàn thành"}
      </span>
    );
  }

  return (
    <select
      value={status}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => updateOrderStatus(orderId, event.target.value)}
      className="admin-order-status-select"
    >
      <option value="new">Đơn mới</option>
      <option value="doing">Đang làm</option>
      {fulfillmentType === "delivery" ? <option value="delivering">Đang giao</option> : null}
      <option value="done">{fulfillmentType === "pickup" ? "Đã làm xong" : "Hoàn thành"}</option>
    </select>
  );
}

function OrderQuickActions({ order, status, updateOrderStatus }) {
  const orderId = getOrderId(order);
  const fulfillmentType = getFulfillmentType(order);
  const isPartnerOrder = isReadOnlyPartnerOrder(order);
  if (isPartnerOrder || ["awaiting_payment", "payment_expired"].includes(status)) return null;
  const quickActions = fulfillmentType === "delivery"
    ? [
        { value: "new", label: "Mới" },
        { value: "doing", label: "Làm" },
        { value: "delivering", label: "Giao" },
        { value: "done", label: "Xong" },
        { value: "cancelled", label: "Hủy" }
      ]
    : [
        { value: "new", label: "Mới" },
        { value: "doing", label: "Làm" },
        { value: "done", label: "Xong" },
        { value: "cancelled", label: "Hủy" }
      ];

  return (
    <div className="admin-order-quick-actions">
      {quickActions.map((action) => (
        <button
          key={action.value}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            updateOrderStatus(orderId, action.value);
          }}
          className={status === action.value ? "active" : ""}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function OrderList({
  orders,
  activeOrderId,
  onSelectOrder,
  updateOrderStatus,
  registeredCustomersByPhone
}) {
  if (!orders.length) {
    return (
      <div className="admin-order-empty">
        <strong>Chưa có đơn phù hợp</strong>
        <span>Thử đổi từ khóa tìm kiếm hoặc bộ lọc hiện tại.</span>
      </div>
    );
  }

  return (
    <div className="admin-order-table-card">
      <div className="admin-order-table-head">
        <span>Mã đơn</span>
        <span>Khách hàng</span>
        <span>Nguồn / Hình thức / CN</span>
        <span>Thời gian</span>
        <span>Trạng thái</span>
        <span>Thanh toán</span>
        <span>Cập nhật</span>
      </div>
      <div className="admin-order-table-body">
        {orders.map((order) => {
          const orderId = getOrderId(order);
          const status = getDisplayStatus(order);
          const fulfillmentType = getFulfillmentType(order);
          const waitingMinutes = getWaitingMinutes(order.createdAt);
          const isActiveOrder = isActiveOperationalStatus(status);
          const isOverdue = isActiveOrder && waitingMinutes > 15;
          const isActive = String(activeOrderId) === String(orderId);
          const settlement = getSettlement(order);
          const sourceMeta = getOrderSourceMeta(order);
          const totalPayment = Number(order.totalAmount || order.total || settlement?.customerTotal || 0);
          const paymentMethod = String(order.paymentMethod || "COD").toUpperCase();
          const paymentStateLabel = getPaymentStateLabel(order);
          const branchName = getOrderBranchName(order);
          const shortBranchName = getShortBranchName(branchName);
          const fulfillmentMeta = getFulfillmentMeta(order);
          const latePaymentReview = getLatePaymentReview(order);

          return (
            <article
              key={orderId}
              className={`admin-order-row${isActive ? " is-selected" : ""}${isOverdue ? " is-overdue" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`Mở chi tiết đơn ${getDisplayOrderCode(order)}`}
              aria-pressed={isActive}
              onClick={() => onSelectOrder(order)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectOrder(order);
                }
              }}
            >
              <div className="admin-order-cell admin-order-code-cell">
                <strong>{getDisplayOrderCode(order)}</strong>
                <small className={`${isOverdue ? "is-overdue" : ""}${status === "payment_expired" ? " is-payment-expired" : ""}`.trim()}>
                  {getOrderTimelineText(status, waitingMinutes)}
                </small>
                {latePaymentReview ? <small className="font-black text-red-600">Tiền đến sau khi hủy</small> : null}
              </div>
              <div className="admin-order-cell">
                <strong>{order.customerName || "Khách lẻ"}</strong>
                <small>{order.customerPhone || order.phone || "--"}</small>
              </div>
              <div className="admin-order-cell">
                <small className={`admin-order-type-badge ${sourceMeta.className}`}>{sourceMeta.label}</small>
                <small className={`admin-order-type-badge ${fulfillmentMeta.className}`}>{fulfillmentMeta.label}</small>
                {branchName ? <small className="admin-order-branch-name" title={branchName}>{shortBranchName}</small> : null}
              </div>
              <div className="admin-order-cell">
                <span>{formatOrderTime(order.createdAt)}</span>
              </div>
              <div className="admin-order-cell">
                <OrderStatusBadge status={status} />
              </div>
              <div className="admin-order-cell admin-order-money">
                <strong>{formatMoney(totalPayment)}</strong>
                <small>{paymentMethod} · {paymentStateLabel}</small>
              </div>
              <div className="admin-order-cell admin-order-row-actions">
                <OrderStatusSelect order={order} status={status} updateOrderStatus={updateOrderStatus} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function OrderDetailPanel({
  order,
  updateOrderStatus,
  shipperText,
  copied,
  onCopyShipper,
  onClose,
  isOpen,
  registeredCustomersByPhone
}) {
  if (!order) {
    return (
      <aside className="admin-order-detail-panel is-empty">
        <strong>Chọn một đơn để xem chi tiết</strong>
        <span>Thông tin đơn, món và thao tác sẽ hiển thị ở đây.</span>
      </aside>
    );
  }

  const items = order.items || [];
  const orderId = getOrderId(order);
  const status = getDisplayStatus(order);
  const fulfillmentType = getFulfillmentType(order);
  const subtotalValue = Number(order.subtotal ?? items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
  const shippingFee = fulfillmentType === "pickup" ? 0 : Number(order.shippingFee ?? order.deliveryFee ?? 0);
  const shippingSupport = fulfillmentType === "pickup" ? 0 : Number(order.shippingSupportDiscount || 0);
  const promoDiscount = Number(order.promoDiscount || 0);
  const pointsDiscount = Number(order.pointsDiscount || 0);
  const totalValue = Number(order.totalAmount || order.total || 0);
  const settlement = getSettlement(order);
  const branchName = getOrderBranchName(order);
  const sourceMeta = getOrderSourceMeta(order);
  const sourceKey = resolveSalesChannelKey(order);
  const isPartnerOrder = String(order?.sourceType || "").toLowerCase() === "partner";
  const registeredCustomer = getRegisteredCustomer(order, registeredCustomersByPhone);
  const orderCustomerName = order.orderCustomerName || order.customerName || "";
  const addressText = fulfillmentType === "pickup"
    ? [order.branchName || order.pickupBranchName, order.branchAddress || order.pickupBranchAddress].filter(Boolean).join(" - ")
    : order.deliveryAddress;
  const note = order.note || order.customerNote || order.orderNote || "";
  const totalPromotion = Number(order.totalPromotion || order.discountAmount || promoDiscount || 0);
  const coFundPromotion = Number(order.coFundPromotion || 0);
  const appPromotion = Math.max(totalPromotion - coFundPromotion, 0);
  const otherPartnerPromotion = Number(order.otherPromotion || Math.max(totalPromotion - coFundPromotion, 0));
  const partnerGrossReceived = Number(order.grossReceived || 0);
  const partnerNetReceived = Number(order.netReceivedAmount || order.realReceived || order.netReceived || 0);
  const pointsBaseAmount = Number(
    isPartnerOrder
      ? order.loyaltyEligibleAmount || order.netReceivedAmount || 0
      : order.pointsBaseAmount || Math.max(totalValue - shippingFee, 0)
  );
  const loyaltyRule = getLoyaltyRuleConfig();
  const estimatedPoints = Math.max(0, calculateOrderPoints(pointsBaseAmount, loyaltyRule));
  const pointStatusText = getUnifiedPointStatusText(order, estimatedPoints);
  const shouldShowShipperSection = fulfillmentType === "delivery" && !isPartnerOrder && sourceKey === "website";

  return (
    <aside className={`admin-order-detail-panel ${isOpen ? "is-open" : ""}`}>
      <div className="admin-order-detail-head">
        <div>
          <span>Chi tiết đơn hàng</span>
          <h3>{getDisplayOrderCode(order)}</h3>
          <small>{formatOrderTime(order.createdAt)}</small>
        </div>
        <button type="button" onClick={onClose}>×</button>
      </div>

      <div className="admin-order-detail-scroll">
        <section className="admin-order-detail-card">
          <div className="admin-order-detail-row">
            <span>Trạng thái</span>
            <OrderStatusBadge status={status} />
          </div>
          <div className="admin-order-detail-row">
            <span>Hình thức</span>
            <strong>{fulfillmentType === "pickup" ? "Tự đến lấy" : "Giao hàng"}</strong>
          </div>
          <div className="admin-order-detail-row">
            <span>Nguồn đơn</span>
            <strong>{sourceMeta.label}</strong>
          </div>
          {branchName ? (
            <div className="admin-order-detail-row">
              <span>Chi nhánh xử lý</span>
              <strong>{branchName}</strong>
            </div>
          ) : null}
          <div className="admin-order-detail-row">
            <span>Thanh toán</span>
            <strong>{String(order.paymentMethod || "COD").toUpperCase()} · {getPaymentStateLabel(order)}</strong>
          </div>
          <div className="admin-order-detail-row">
            <span>Tích điểm</span>
            <strong>{pointStatusText}</strong>
          </div>
        </section>

        <section className="admin-order-detail-card">
          <h4>Thông tin khách hàng</h4>
          <div className="admin-order-customer-box">
            <strong>{orderCustomerName || "Khách lẻ"}</strong>
            <span>{order.customerPhone || order.phone || "--"}</span>
            {addressText ? <small>{addressText}</small> : null}
          </div>
          {registeredCustomer ? (
            <div className="admin-order-detail-row">
              <span>Tài khoản</span>
              <strong>{registeredCustomer.name || registeredCustomer.phone}</strong>
            </div>
          ) : null}
        </section>

        <section className="admin-order-detail-card">
          <h4>Danh sách món</h4>
          <div className="admin-order-item-list">
            {items.map((item, index) => {
              const lineTotal = Number(item.lineTotal || (item.unitTotal || item.price || 0) * (item.quantity || 1));
              const options = getOrderItemOptionLabels(item, { includeQuantity: true });
              return (
                <div key={`${item.id || item.name}-${index}`} className="admin-order-detail-item">
                  <div>
                    <strong>{item.name}</strong>
                    {options.length ? <small>{options.join(" · ")}</small> : null}
                  </div>
                  <span>x{item.quantity || 1}</span>
                  <em>{formatMoney(lineTotal)}</em>
                </div>
              );
            })}
          </div>
        </section>

        <section className="admin-order-detail-card">
          <h4>Thanh toán</h4>
          <div className="admin-order-total-lines">
            <div><span>Tạm tính</span><strong>{formatMoney(subtotalValue)}</strong></div>
            <div><span>Phí giao hàng</span><strong>{fulfillmentType === "pickup" ? "0đ (Tự đến lấy)" : formatMoney(shippingFee)}</strong></div>
            {coFundPromotion > 0 ? <div className="discount"><span>Đồng tài trợ</span><strong>-{formatMoney(coFundPromotion)}</strong></div> : null}
            {appPromotion > 0 ? <div className="discount"><span>Khuyến mãi app</span><strong>-{formatMoney(appPromotion)}</strong></div> : null}
            {shippingSupport > 0 ? <div className="discount"><span>GHR hỗ trợ ship</span><strong>-{formatMoney(shippingSupport)}</strong></div> : null}
            {promoDiscount > 0 ? <div className="discount"><span>Mã giảm giá {order.promoCode || ""}</span><strong>-{formatMoney(promoDiscount)}</strong></div> : null}
            {pointsDiscount > 0 ? <div className="discount"><span>Dùng điểm thưởng</span><strong>-{formatMoney(pointsDiscount)}</strong></div> : null}
            <div className="grand"><span>Tổng cộng</span><strong>{formatMoney(totalValue)}</strong></div>
            <div><span>Giá trị tính điểm loyalty</span><strong>{formatMoney(pointsBaseAmount)}</strong></div>
            {isPartnerOrder && order.loyaltyHoldReason ? (
              <div><span>Trạng thái loyalty</span><strong>Chờ dữ liệu thực nhận</strong></div>
            ) : null}
            {!isPartnerOrder || hasClaimedPartnerPoints(order) ? (
              <div>
                <span>{isPartnerOrder ? "Điểm đã cộng" : "Điểm dự kiến"}</span>
                <strong>+{estimatedPoints.toLocaleString("vi-VN")} điểm</strong>
              </div>
            ) : null}
          </div>
        </section>

        {shouldShowShipperSection ? (
          <section className="admin-order-detail-card admin-order-settlement-card">
            <h4>Đối soát shipper</h4>
            <div className="admin-order-total-lines">
              <div><span>Khách trả khi nhận</span><strong>{formatMoney(settlement.customerNeedPayWhenReceive || totalValue)}</strong></div>
              <div><span>Khách trả phí ship</span><strong>{formatMoney(settlement.shippingFeeCustomer)}</strong></div>
              <div><span>Quán hỗ trợ ship</span><strong>{formatMoney(settlement.shippingSupport)}</strong></div>
              <div className="grand"><span>Shipper nộp lại quán</span><strong>{formatMoney(settlement.shipperPayBackStore)}</strong></div>
            </div>
          </section>
        ) : null}

        {(partnerGrossReceived > 0 || partnerNetReceived > 0) ? (
          <section className="admin-order-detail-card admin-order-settlement-card">
            <h4>Đối soát FoodApp</h4>
            <div className="admin-order-total-lines">
              {partnerGrossReceived > 0 ? <div><span>Doanh thu trước phí</span><strong>{formatMoney(partnerGrossReceived)}</strong></div> : null}
              {partnerNetReceived > 0 ? <div className="grand"><span>Quán thực nhận</span><strong>{formatMoney(partnerNetReceived)}</strong></div> : null}
            </div>
          </section>
        ) : null}

        {note ? (
          <section className="admin-order-detail-card">
            <h4>Ghi chú</h4>
            <p className="admin-order-note">{note}</p>
          </section>
        ) : null}

        {shouldShowShipperSection ? (
          <section className="admin-order-detail-card">
            <h4>Thông tin gửi shipper</h4>
            <button type="button" className="admin-order-copy-btn" onClick={() => onCopyShipper(orderId)}>
              {copied ? "Đã copy" : "Copy info shipper"}
            </button>
            <textarea readOnly value={shipperText || ""} />
          </section>
        ) : null}
      </div>

      <div className="admin-order-detail-actions">
        <OrderStatusSelect order={order} status={status} updateOrderStatus={updateOrderStatus} />
      </div>
    </aside>
  );
}

function OrderDetailPanelV2({
  order,
  updateOrderStatus,
  shipperText,
  copied,
  onCopyShipper,
  onClose,
  isOpen,
  registeredCustomersByPhone
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!order) {
    return (
      <aside className="admin-order-detail-panel is-empty">
        <strong>Chọn một đơn để xem chi tiết</strong>
        <span>Thông tin đơn, món và thao tác sẽ hiển thị ở đây.</span>
      </aside>
    );
  }

  const items = order.items || [];
  const orderId = getOrderId(order);
  const status = getDisplayStatus(order);
  const fulfillmentType = getFulfillmentType(order);
  const subtotalValue = Number(order.subtotal ?? items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
  const shippingFee = fulfillmentType === "pickup" ? 0 : Number(order.shippingFee ?? order.deliveryFee ?? 0);
  const shippingSupport = fulfillmentType === "pickup" ? 0 : Number(order.shippingSupportDiscount || 0);
  const promoDiscount = Number(order.promoDiscount || 0);
  const pointsDiscount = Number(order.pointsDiscount || 0);
  const totalValue = Number(order.totalAmount || order.total || 0);
  const settlement = getSettlement(order);
  const branchName = getOrderBranchName(order);
  const sourceMeta = getOrderSourceMeta(order);
  const fulfillmentMeta = getFulfillmentMeta(order);
  const sourceKey = resolveSalesChannelKey(order);
  const isPartnerOrder = String(order?.sourceType || "").toLowerCase() === "partner";
  const registeredCustomer = getRegisteredCustomer(order, registeredCustomersByPhone);
  const orderCustomerName = order.orderCustomerName || order.customerName || "";
  const addressText = fulfillmentType === "pickup"
    ? [order.branchName || order.pickupBranchName, order.branchAddress || order.pickupBranchAddress].filter(Boolean).join(" - ")
    : order.deliveryAddress;
  const note = order.note || order.customerNote || order.orderNote || "";
  const totalPromotion = Number(order.totalPromotion || order.discountAmount || promoDiscount || 0);
  const coFundPromotion = Number(order.coFundPromotion || 0);
  const appPromotion = Math.max(totalPromotion - coFundPromotion, 0);
  const otherPartnerPromotion = Number(order.otherPromotion || Math.max(totalPromotion - coFundPromotion, 0));
  const partnerPromotions = (Array.isArray(order.promotions) ? order.promotions : []).filter((promotion) => {
    const key = String(promotion?.key || "");
    return Boolean(promotion?.code) && !key.startsWith("item:") && key !== "finance:total_promotion";
  });
  const partnerNetReceived = Number(order.netReceivedAmount || order.realReceived || order.netReceived || 0);
  const partnerFinanceData = order.financeData && typeof order.financeData === "object"
    ? order.financeData
    : {};
  const partnerServiceFee = Math.abs(Number(partnerFinanceData.commission || 0));
  const partnerWithholdingTax = Math.abs(Number(partnerFinanceData.tax || 0));
  const partnerVatTax = partnerWithholdingTax * (2 / 3);
  const partnerPersonalIncomeTax = partnerWithholdingTax - partnerVatTax;
  const partnerTransactionFee = Math.abs(Number(partnerFinanceData.transaction_fee || 0));
  const partnerOtherFee = Math.abs(Number(partnerFinanceData.other_fee || 0));
  const partnerAdjustmentFee = Number(partnerFinanceData.adjustment_fee || 0);
  const partnerAdditionalIncome = Math.abs(Number(partnerFinanceData.additional_income || 0));
  const hasPartnerFeeBreakdown = [
    partnerServiceFee,
    partnerWithholdingTax,
    partnerTransactionFee,
    partnerOtherFee,
    Math.abs(partnerAdjustmentFee),
    partnerAdditionalIncome
  ].some((value) => value > 0);
  const partnerPlatformDeduction = partnerNetReceived > 0
    ? Math.max(totalValue - partnerNetReceived, 0)
    : 0;
  const formatRate = (value, base) => {
    const safeValue = Number(value || 0);
    const safeBase = Number(base || 0);
    if (safeBase <= 0) return "";
    return `${(safeValue / safeBase * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
  };
  const pointsBaseAmount = Number(
    isPartnerOrder
      ? order.loyaltyEligibleAmount || order.netReceivedAmount || 0
      : order.pointsBaseAmount || Math.max(totalValue - shippingFee, 0)
  );
  const loyaltyRule = getLoyaltyRuleConfig();
  const estimatedPoints = Math.max(0, calculateOrderPoints(pointsBaseAmount, loyaltyRule));
  const pointStatusText = getUnifiedPointStatusText(order, estimatedPoints);
  const shouldShowShipperSection = fulfillmentType === "delivery" && !isPartnerOrder && sourceKey === "website";
  const totalItemQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const latePaymentReview = getLatePaymentReview(order);
  const waitingMinutes = getWaitingMinutes(order.createdAt);
  const isActiveOrder = isActiveOperationalStatus(status);

  return (
    <div className={`admin-order-detail-backdrop ${isOpen ? "is-open" : ""}`} onMouseDown={onClose}>
    <aside
      className={`admin-order-detail-panel ${isOpen ? "is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-order-detail-title"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="admin-order-detail-head admin-order-detail-head-v2">
        <span className="admin-order-detail-title-icon" aria-hidden="true"><Receipt size={23} weight="duotone" /></span>
        <div className="admin-order-detail-title-block">
          <span>Chi tiết đơn hàng</span>
          <h3 id="admin-order-detail-title">{getDisplayOrderCode(order)}</h3>
          <small>{formatOrderTime(order.createdAt)}</small>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết đơn"><X size={19} weight="bold" /></button>
      </div>

      <div className="admin-order-detail-scroll">
        {latePaymentReview ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <strong className="block text-sm font-black">Cần xử lý hoàn tiền thủ công</strong>
            <p className="mt-1 text-xs font-bold leading-5">
              Đơn đã hủy nhưng hệ thống nhận thêm {formatMoney(latePaymentReview.amount)} qua {latePaymentReview.provider || "thanh toán QR"}. Không gửi đơn vào bếp.
            </p>
          </section>
        ) : null}
        <section className="admin-order-detail-summary-card">
          <div className="admin-order-detail-section-label">
            <Receipt size={16} weight="duotone" /> Thông tin đơn
          </div>
          <div className="admin-order-detail-status-line">
            <OrderStatusBadge status={status} />
            <span className={`admin-order-type-badge ${sourceMeta.className}`}>{sourceMeta.label}</span>
            <span className={`admin-order-type-badge ${fulfillmentMeta.className}`}>{fulfillmentMeta.label}</span>
            {isActiveOrder ? (
              <span className={`admin-order-waiting-badge${waitingMinutes > 15 ? " is-late" : ""}`}>
                Chờ {waitingMinutes} phút
              </span>
            ) : null}
          </div>

          <div className="admin-order-info-grid">
            <div><span>Mã đơn</span><strong>{getDisplayOrderCode(order)}</strong></div>
            <div><span>Thời gian tạo</span><strong>{formatOrderTime(order.createdAt)}</strong></div>
            <div><span>Chi nhánh xử lý</span><strong>{branchName || "—"}</strong></div>
            <div><span>Nguồn / Loại</span><strong>{sourceMeta.label} · {fulfillmentMeta.label}</strong></div>
            <div><span>Thanh toán</span><strong>{getPaymentStateLabel(order)}</strong></div>
            <div><span>Phương thức</span><strong>{String(order.paymentMethod || "COD").toUpperCase()}</strong></div>
            <div><span>Số lượng món</span><strong>{totalItemQuantity} phần</strong></div>
            <div className="is-total"><span>Tổng thu khách</span><strong>{formatMoney(totalValue)}</strong></div>
          </div>
        </section>

        <section className="admin-order-detail-card admin-order-customer-card">
          <div className="admin-order-detail-section-head">
            <h4><User size={17} weight="duotone" /> Khách hàng</h4>
          </div>
          <div className="admin-order-customer-box">
            <div><span>Khách hàng</span><strong>{orderCustomerName || "Khách lẻ"}</strong></div>
            <div><span>Số điện thoại</span><strong>{order.customerPhone || order.phone || "—"}</strong></div>
            <div className="is-address"><span>Địa chỉ / Nhận món</span><strong>{addressText || "—"}</strong></div>
          </div>
          {registeredCustomer ? (
            <div className="admin-order-detail-row">
              <span>Tài khoản</span>
              <strong>{registeredCustomer.name || registeredCustomer.phone}</strong>
            </div>
          ) : null}
        </section>

        <section className="admin-order-detail-card admin-order-items-card">
          <div className="admin-order-detail-section-head">
            <h4><Package size={17} weight="duotone" /> Danh sách món</h4>
            <span>{items.length} món • {totalItemQuantity} phần</span>
          </div>
          <div className="admin-order-item-list">
            <div className="admin-order-item-table-head" aria-hidden="true">
              <span>Món</span><span>SL</span><span>Đơn giá</span><span>Giảm giá</span><span>Thành tiền</span>
            </div>
            {items.map((item, index) => {
              const quantity = Number(item.quantity || 1);
              const lineTotal = Number(item.lineTotal || (item.unitTotal || item.price || 0) * quantity);
              const originalUnitPrice = Number(item.originalUnitPrice || item.unitTotal || item.price || 0);
              const originalLineTotal = originalUnitPrice * quantity;
              const itemDiscount = Math.max(
                Number(item.itemDiscountAmount || 0),
                originalLineTotal > lineTotal ? originalLineTotal - lineTotal : 0
              );
              const options = getOrderItemOptionLabels(item, { includeQuantity: true });
              return (
                <div key={`${item.id || item.name}-${index}`} className="admin-order-detail-item">
                  <div>
                    <strong>{item.name}</strong>
                    {options.length ? <small>{options.join(" • ")}</small> : null}
                  </div>
                  <span>{quantity}</span>
                  <em className="admin-order-item-unit-price">{formatMoney(originalUnitPrice)}</em>
                  <em className={`admin-order-item-discount-value${itemDiscount > 0 ? " has-discount" : ""}`}>
                    {itemDiscount > 0 ? `-${formatMoney(itemDiscount)}` : "—"}
                  </em>
                  <em className="admin-order-item-line-total">{formatMoney(lineTotal)}</em>
                </div>
              );
            })}
          </div>
        </section>

        <section className="admin-order-detail-card admin-order-payment-card">
          <div className="admin-order-payment-highlight">
            <span>{isPartnerOrder && partnerNetReceived > 0 ? "Thực tế quán thu về" : "Khách thanh toán"}</span>
            <strong>{formatMoney(isPartnerOrder && partnerNetReceived > 0 ? partnerNetReceived : totalValue)}</strong>
          </div>
          <div className="admin-order-detail-section-head">
            <h4><Wallet size={17} weight="duotone" /> {isPartnerOrder ? "Dòng tiền đơn hàng" : "Thanh toán"}</h4>
          </div>
          {isPartnerOrder ? (
            <div className="admin-order-financial-flow">
              <div>
                <span><i>1</i> Giá trị món ban đầu <small className="admin-order-tax-rate">100%</small></span>
                <strong>{formatMoney(subtotalValue)}</strong>
              </div>
              {coFundPromotion > 0 ? (
                <div className="is-discount">
                  <span><i>2a</i> Grab đồng tài trợ <small className="admin-order-tax-rate">{formatRate(coFundPromotion, subtotalValue)}</small></span>
                  <strong>-{formatMoney(coFundPromotion)}</strong>
                </div>
              ) : null}
              {otherPartnerPromotion > 0 ? (
                <div className="is-discount">
                  <span>
                    <i>{coFundPromotion > 0 ? "2b" : "2"}</i>
                    <b className="admin-order-financial-label">
                      <span>Giảm giá món / ưu đãi khác <small className="admin-order-tax-rate">{formatRate(otherPartnerPromotion, subtotalValue)}</small></span>
                      {partnerPromotions.length ? (
                        <span className="admin-order-promotion-badges">
                          {partnerPromotions.map((promotion) => (
                            <span className="admin-order-promotion-badge" key={`${promotion.key}-${promotion.code}-${promotion.amount}`}>
                              <Tag size={11} weight="duotone" />
                              <b>{promotion.name || "Khuyến mãi đối tác"}</b>
                              <code>{promotion.code}</code>
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </b>
                  </span>
                  <strong>-{formatMoney(otherPartnerPromotion)}</strong>
                </div>
              ) : null}
              {totalPromotion > 0 && coFundPromotion <= 0 && otherPartnerPromotion <= 0 ? (
                <div className="is-discount">
                  <span><i>2</i> Tổng khuyến mãi <small className="admin-order-tax-rate">{formatRate(totalPromotion, subtotalValue)}</small></span>
                  <strong>-{formatMoney(totalPromotion)}</strong>
                </div>
              ) : null}
              <div className="is-customer-total">
                <span><i>3</i> Khách thanh toán <small className="admin-order-tax-rate">{formatRate(totalValue, subtotalValue)}</small></span>
                <strong>{formatMoney(totalValue)}</strong>
              </div>
              {partnerNetReceived > 0 ? (
                <>
                  {hasPartnerFeeBreakdown ? (
                    <>
                      {partnerServiceFee > 0 ? (
                        <div className="is-fee">
                          <span>
                            <i>4a</i>
                            <b className="admin-order-financial-label">
                              <span>Phí dịch vụ GrabFood <small className="admin-order-tax-rate">{formatRate(partnerServiceFee, totalValue)}</small></span>
                            </b>
                          </span>
                          <strong>-{formatMoney(partnerServiceFee)}</strong>
                        </div>
                      ) : null}
                      {partnerVatTax > 0 ? (
                        <div className="is-fee">
                          <span><i>4b</i> Thuế GTGT khấu trừ <small className="admin-order-tax-rate">3%</small></span>
                          <strong>-{formatMoney(partnerVatTax)}</strong>
                        </div>
                      ) : null}
                      {partnerPersonalIncomeTax > 0 ? (
                        <div className="is-fee">
                          <span><i>4c</i> Thuế TNCN khấu trừ <small className="admin-order-tax-rate">1,5%</small></span>
                          <strong>-{formatMoney(partnerPersonalIncomeTax)}</strong>
                        </div>
                      ) : null}
                      {partnerTransactionFee > 0 ? (
                        <div className="is-fee">
                          <span><i>4d</i> Phí giao dịch</span>
                          <strong>-{formatMoney(partnerTransactionFee)}</strong>
                        </div>
                      ) : null}
                      {partnerOtherFee > 0 ? (
                        <div className="is-fee">
                          <span><i>4e</i> Phí khác</span>
                          <strong>-{formatMoney(partnerOtherFee)}</strong>
                        </div>
                      ) : null}
                      {partnerAdjustmentFee !== 0 ? (
                        <div className={partnerAdjustmentFee > 0 ? "is-fee" : "is-income"}>
                          <span><i>4f</i> Điều chỉnh đối soát</span>
                          <strong>{partnerAdjustmentFee > 0 ? "-" : "+"}{formatMoney(Math.abs(partnerAdjustmentFee))}</strong>
                        </div>
                      ) : null}
                      {partnerAdditionalIncome > 0 ? (
                        <div className="is-income">
                          <span><i>4g</i> Thu nhập bổ sung</span>
                          <strong>+{formatMoney(partnerAdditionalIncome)}</strong>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="is-fee">
                      <span><i>4</i> Tổng phí và thuế chờ chi tiết</span>
                      <strong>-{formatMoney(partnerPlatformDeduction)}</strong>
                    </div>
                  )}
                  <div className="is-net">
                    <span><i>5</i> Quán thực nhận <small className="admin-order-tax-rate">{formatRate(partnerNetReceived, totalValue)}</small></span>
                    <strong>{formatMoney(partnerNetReceived)}</strong>
                  </div>
                </>
              ) : (
                <p className="admin-order-financial-pending">
                  Chưa có dữ liệu tiền thực nhận từ đối tác.
                </p>
              )}
            </div>
          ) : <div className="admin-order-total-lines">
            <div><span>Tạm tính</span><strong>{formatMoney(subtotalValue)}</strong></div>
            <div><span>Phí giao hàng</span><strong>{fulfillmentType === "pickup" ? "0đ (Tự lấy)" : formatMoney(shippingFee)}</strong></div>
            {!isPartnerOrder && coFundPromotion > 0 ? <div className="discount"><span>Đồng tài trợ</span><strong>-{formatMoney(coFundPromotion)}</strong></div> : null}
            {!isPartnerOrder && appPromotion > 0 ? <div className="discount"><span>Khuyến mãi app</span><strong>-{formatMoney(appPromotion)}</strong></div> : null}
            {shippingSupport > 0 ? <div className="discount"><span>GHR hỗ trợ ship</span><strong>-{formatMoney(shippingSupport)}</strong></div> : null}
            {promoDiscount > 0 ? <div className="discount"><span>Mã giảm giá {order.promoCode || ""}</span><strong>-{formatMoney(promoDiscount)}</strong></div> : null}
            {pointsDiscount > 0 ? <div className="discount"><span>Dùng điểm thưởng</span><strong>-{formatMoney(pointsDiscount)}</strong></div> : null}
            <div className="grand"><span>Tổng thu khách</span><strong>{formatMoney(totalValue)}</strong></div>
          </div>}
          <div className="admin-order-total-lines admin-order-loyalty-lines">
            <div><span>Giá trị tính điểm loyalty</span><strong>{formatMoney(pointsBaseAmount)}</strong></div>
            <div><span>Tích điểm</span><strong>{pointStatusText}</strong></div>
            {isPartnerOrder && order.loyaltyHoldReason ? (
              <div><span>Trạng thái loyalty</span><strong>Chờ dữ liệu thực nhận</strong></div>
            ) : null}
            {!isPartnerOrder || hasClaimedPartnerPoints(order) ? (
              <div>
                <span>{isPartnerOrder ? "Điểm đã cộng" : "Điểm dự kiến"}</span>
                <strong>+{estimatedPoints.toLocaleString("vi-VN")} điểm</strong>
              </div>
            ) : null}
          </div>
        </section>

        {shouldShowShipperSection ? (
          <section className="admin-order-detail-card admin-order-settlement-card">
            <div className="admin-order-detail-section-head">
              <h4><Truck size={17} weight="duotone" /> Đối soát shipper</h4>
            </div>
            <div className="admin-order-total-lines">
              <div><span>Khách trả khi nhận</span><strong>{formatMoney(settlement.customerNeedPayWhenReceive || totalValue)}</strong></div>
              <div><span>Khách trả phí ship</span><strong>{formatMoney(settlement.shippingFeeCustomer)}</strong></div>
              <div><span>Quán hỗ trợ ship</span><strong>{formatMoney(settlement.shippingSupport)}</strong></div>
              <div className="grand"><span>Shipper nộp lại quán</span><strong>{formatMoney(settlement.shipperPayBackStore)}</strong></div>
            </div>
          </section>
        ) : null}

        {note ? (
          <section className="admin-order-detail-card">
            <div className="admin-order-detail-section-head">
              <h4><Note size={17} weight="duotone" /> Ghi chú</h4>
            </div>
            <p className="admin-order-note">{note}</p>
          </section>
        ) : null}

        {shouldShowShipperSection ? (
          <section className="admin-order-detail-card">
            <div className="admin-order-detail-section-head">
              <h4><MapPin size={17} weight="duotone" /> Thông tin gửi shipper</h4>
            </div>
            <button type="button" className="admin-order-copy-btn" onClick={() => onCopyShipper(orderId)}>
              <Copy size={16} weight="bold" /> {copied ? "Đã sao chép" : "Sao chép thông tin shipper"}
            </button>
            <textarea readOnly value={shipperText || ""} />
          </section>
        ) : null}
      </div>

      <div className="admin-order-detail-actions">
        {isPartnerOrder ? (
          <span className="admin-order-partner-sync-note">Theo trạng thái NexPOS</span>
        ) : (
          <div className="admin-order-detail-action-row">
            <OrderStatusSelect order={order} status={status} updateOrderStatus={updateOrderStatus} />
            <CancelOrderButton order={order} status={status} updateOrderStatus={updateOrderStatus} />
          </div>
        )}
      </div>
    </aside>
    </div>
  );
}

export default function OrderManager({
  ordersSnapshot,
  updateOrderStatus,
  branches = [],
  registeredCustomersByPhone = {},
  ordersDateFrom = "",
  ordersDateTo = "",
  selectedBranchFilter = "all"
}) {
  const [partnerOrders, setPartnerOrders] = useState([]);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [activeOrderId, setActiveOrderId] = useState("");
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusClock, setStatusClock] = useState(() => Date.now());
  const snapshotHasPartnerOrders = useMemo(
    () => (ordersSnapshot || []).some((order) => order?.sourceType === "partner"),
    [ordersSnapshot]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setStatusClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    if (snapshotHasPartnerOrders) {
      setPartnerOrders([]);
      return () => {
        disposed = true;
      };
    }
    async function loadPartnerFeed() {
      const dateRange = buildVietnamDateRange(ordersDateFrom, ordersDateTo);
      const nextPartnerOrders = await readPartnerOrdersForAdmin(dateRange);
      if (!disposed) {
        setPartnerOrders(Array.isArray(nextPartnerOrders) ? nextPartnerOrders : []);
      }
    }
    loadPartnerFeed();
    return () => {
      disposed = true;
    };
  }, [ordersDateFrom, ordersDateTo, snapshotHasPartnerOrders]);

  const adminOrderFeed = useMemo(
    () => buildAdminOrderFeed(ordersSnapshot || [], partnerOrders || []),
    [ordersSnapshot, partnerOrders]
  );

  const branchOptions = useMemo(() => buildBranchOptions(branches), [branches]);

  useEffect(() => {
    setBranchFilter(selectedBranchFilter || "all");
  }, [selectedBranchFilter]);
  const selectedBranchOption = useMemo(
    () => branchOptions.find((branch) => branch.value === branchFilter) || null,
    [branchOptions, branchFilter]
  );

  const searchedOrders = useMemo(() => (adminOrderFeed || []).filter((order) => {
    const key = keyword.trim().toLowerCase();
    const orderCode = String(order.displayOrderCode || order.orderCode || order.id || "").toLowerCase();
    const customerName = String(`${order.customerName || ""} ${order.orderCustomerName || ""}`).toLowerCase();
    const customerPhone = String(`${order.customerPhone || ""} ${order.phone || ""} ${order.customerPhoneKey || ""}`).toLowerCase();
    const normalizedSearchPhone = getCustomerKey(key);
    const fulfillmentType = getFulfillmentType(order);
    const paymentMethod = String(order.paymentMethod || "COD").toUpperCase();
    const source = resolveSalesChannelKey(order);
    const matchKeyword = !key || orderCode.includes(key) || customerName.includes(key) || customerPhone.includes(key) || (normalizedSearchPhone && customerPhone.includes(normalizedSearchPhone));
    const matchFulfillment = fulfillmentFilter === "all" || fulfillmentFilter === fulfillmentType;
    const matchBranch = branchFilter === "all" || matchOrderBranch(order, selectedBranchOption);
    const matchSource = sourceFilter === "all" || sourceFilter === source;
    const matchPayment = paymentFilter === "all" || (
      paymentFilter === "cod"
        ? paymentMethod.includes("COD") || paymentMethod === "CASH"
        : getPaymentState(order).isPaid
    );
    return matchKeyword && matchFulfillment && matchBranch && matchSource && matchPayment;
  }), [adminOrderFeed, keyword, fulfillmentFilter, branchFilter, selectedBranchOption, sourceFilter, paymentFilter]);

  const statusCounts = useMemo(() => searchedOrders.reduce((counts, order) => {
    const status = getDisplayStatus(order);
    counts.all += 1;
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, { all: 0, awaiting_payment: 0, payment_expired: 0, new: 0, doing: 0, delivering: 0, done: 0, cancelled: 0 }), [searchedOrders, statusClock]);

  const visibleOrders = useMemo(() => {
    if (statusFilter === "all") return searchedOrders;
    if (statusFilter === "overdue") {
      return searchedOrders.filter((order) => (
        isActiveOperationalStatus(getDisplayStatus(order)) && getWaitingMinutes(order.createdAt) > 15
      ));
    }
    if (statusFilter === "doing") {
      return searchedOrders.filter((order) => ["doing", "delivering"].includes(getDisplayStatus(order)));
    }
    return searchedOrders.filter((order) => getDisplayStatus(order) === statusFilter);
  }, [searchedOrders, statusFilter, statusClock]);
  const totalPages = Math.max(1, Math.ceil(visibleOrders.length / ORDER_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedOrders = useMemo(() => {
    const start = (safeCurrentPage - 1) * ORDER_PAGE_SIZE;
    return visibleOrders.slice(start, start + ORDER_PAGE_SIZE);
  }, [safeCurrentPage, visibleOrders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, statusFilter, fulfillmentFilter, sourceFilter, branchFilter, paymentFilter, ordersDateFrom, ordersDateTo]);

  const orderStats = useMemo(() => {
    const overdue = searchedOrders.filter((order) => (
      isActiveOperationalStatus(getDisplayStatus(order)) && getWaitingMinutes(order.createdAt) > 15
    )).length;
    return {
      total: searchedOrders.length,
      new: statusCounts.new,
      doing: statusCounts.doing,
      delivering: statusCounts.delivering,
      done: statusCounts.done,
      overdue
    };
  }, [searchedOrders, statusCounts]);

  const dataHealth = useMemo(() => searchedOrders.reduce((health, order) => {
    const source = resolveSalesChannelKey(order);
    const branchName = getOrderBranchName(order);
    const hasBranch = Boolean(
      branchName ||
        order.branchId ||
        order.branchUuid ||
        order.pickupBranchId ||
        order.pickupBranchUuid ||
        order.deliveryBranchId ||
        order.deliveryBranchUuid
    );
    const items = Array.isArray(order.items) ? order.items : [];
    const metadata = order.metadata && typeof order.metadata === "object" ? order.metadata : {};
    const syncStatus = String(order.syncStatus || metadata.syncStatus || "").toLowerCase();

    if (source === "unknown" || source === "other") health.missingSource += 1;
    if (!hasBranch) health.missingBranch += 1;
    if (!items.length) health.missingItems += 1;
    if (syncStatus === "pending_sync") health.localPending += 1;

    return health;
  }, {
    missingSource: 0,
    missingBranch: 0,
    missingItems: 0,
    localPending: 0
  }), [searchedOrders]);

  const shipperInfoByOrderId = useMemo(() => {
    const result = {};
    (adminOrderFeed || []).forEach((order) => {
      result[getOrderId(order)] = buildShipperInfoText(order, formatMoney);
    });
    return result;
  }, [adminOrderFeed]);

  const activeOrder = useMemo(() => {
    if (!visibleOrders.length) return null;
    return visibleOrders.find((order) => String(getOrderId(order)) === String(activeOrderId)) || visibleOrders[0];
  }, [visibleOrders, activeOrderId]);

  const safeUpdateOrderStatus = (orderId, nextStatus) => {
    const targetOrder = adminOrderFeed.find((order) => String(getOrderId(order)) === String(orderId));
    if (isReadOnlyPartnerOrder(targetOrder)) return;
    updateOrderStatus(orderId, nextStatus);
  };

  const handleSelectOrder = (order) => {
    setActiveOrderId(getOrderId(order));
    setDetailPanelOpen(true);
  };

  const copyShipperInfo = async (orderId) => {
    const text = shipperInfoByOrderId[orderId];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOrderId(orderId);
      setTimeout(() => {
        setCopiedOrderId((current) => (current === orderId ? "" : current));
      }, 1500);
    } catch (error) {
      console.error(error);
      alert("Không thể copy tự động. Bạn vui lòng copy thủ công trong thẻ thông tin shipper.");
    }
  };

  const resetFilters = () => {
    setKeyword("");
    setStatusFilter("all");
    setFulfillmentFilter("all");
    setSourceFilter("all");
    setPaymentFilter("all");
  };

  const applyStatFilter = (key) => {
    setStatusFilter(key === "total" ? "all" : key);
  };

  return (
    <div className="admin-orders-dashboard">
      <section className="admin-orders-main">
        <header className="admin-orders-hero">
          <div>
            <p>Vận hành nhà hàng</p>
            <h2>Đơn hàng</h2>
            <span>Quản lý đơn mới, đơn đang làm và đơn đã hoàn thành.</span>
          </div>
          <div className="admin-orders-hero-meta">
            <strong>{orderStats.total}</strong>
            <span>đơn trong bộ lọc</span>
          </div>
        </header>

        <OrderStatsCards
          stats={orderStats}
          activeFilter={statusFilter === "all" ? "total" : statusFilter}
          onSelect={applyStatFilter}
        />
        <OrderHealthAlerts health={dataHealth} />
        <OrderFilterBar
          keyword={keyword}
          setKeyword={setKeyword}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          fulfillmentFilter={fulfillmentFilter}
          setFulfillmentFilter={setFulfillmentFilter}
          paymentFilter={paymentFilter}
          setPaymentFilter={setPaymentFilter}
          onReset={resetFilters}
        />
      </section>

      <div className="admin-orders-workspace">
        <section className="admin-orders-list-column">
        <div className="admin-order-results-summary" aria-live="polite">
          <span>
            <strong>{visibleOrders.length}</strong> đơn phù hợp
          </span>
          <span>Chọn một đơn để xem món, thanh toán và cập nhật trạng thái</span>
        </div>
        <OrderList
          orders={pagedOrders}
          activeOrderId={activeOrder ? getOrderId(activeOrder) : activeOrderId}
          onSelectOrder={handleSelectOrder}
          updateOrderStatus={safeUpdateOrderStatus}
          registeredCustomersByPhone={registeredCustomersByPhone}
        />
        {visibleOrders.length > ORDER_PAGE_SIZE ? (
          <div className="admin-order-pagination-row">
            <span>
              Hiển thị {pagedOrders.length} / {visibleOrders.length} đơn · Trang {safeCurrentPage}/{totalPages}
            </span>
            <AdminPagination page={safeCurrentPage} totalPages={totalPages} onChange={setCurrentPage} />
          </div>
        ) : null}
        </section>

        {activeOrder && detailPanelOpen ? (
          <OrderDetailPanelV2
            order={activeOrder}
            updateOrderStatus={safeUpdateOrderStatus}
            shipperText={shipperInfoByOrderId[getOrderId(activeOrder)] || ""}
            copied={copiedOrderId === getOrderId(activeOrder)}
            onCopyShipper={copyShipperInfo}
            onClose={() => setDetailPanelOpen(false)}
            isOpen={detailPanelOpen}
            registeredCustomersByPhone={registeredCustomersByPhone}
          />
        ) : null}
      </div>
    </div>
  );
}
