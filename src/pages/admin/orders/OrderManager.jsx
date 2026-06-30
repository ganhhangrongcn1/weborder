import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "../../../utils/format.js";
import { getOrderItemOptionLabels } from "../../../utils/orderItemDisplay.js";
import { getCustomerKey } from "../../../services/storageService.js";
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
  new: { label: "Đơn mới", className: "admin-order-status-new" },
  doing: { label: "Đang làm", className: "admin-order-status-doing" },
  delivering: { label: "Đang giao", className: "admin-order-status-delivering" },
  done: { label: "Hoàn thành", className: "admin-order-status-done" }
};
const ORDER_PAGE_SIZE = 25;

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
  const rawStatus = toAdminStatus(order.status);
  return getFulfillmentType(order) === "pickup" && rawStatus === "delivering" ? "done" : rawStatus;
}

function isActiveOperationalStatus(status) {
  return ["new", "doing", "delivering"].includes(String(status || "").toLowerCase());
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
  return <span className={`admin-order-status-badge ${getStatusClass(status)}`}>{getStatusLabel(status)}</span>;
}

function hasClaimedPartnerPoints() {
  return false;
}

function getUnifiedPointStatusText(order = {}, estimatedPoints = 0) {
  if (isBlockedPointStatus(order)) return "Không tích điểm";
  return estimatedPoints > 0 ? `Dự kiến +${estimatedPoints.toLocaleString("vi-VN")} điểm` : "Không có điểm";
}

function OrderStatsCards({ stats }) {
  const cards = [
    { key: "total", label: "Tổng đơn", value: stats.total, hint: "Theo bộ lọc hiện tại", tone: "orange", icon: "🧾" },
    { key: "new", label: "Đơn mới", value: stats.new, hint: "Chờ xử lý", tone: "amber", icon: "⏱" },
    { key: "doing", label: "Đang vận hành", value: stats.doing + stats.delivering, hint: "Đang làm / đang giao", tone: "blue", icon: "👨‍🍳" },
    { key: "done", label: "Hoàn thành", value: stats.done, hint: "Đã xử lý xong", tone: "green", icon: "✓" },
    { key: "overdue", label: "Quá 15 phút", value: stats.overdue, hint: "Cần ưu tiên kiểm tra", tone: stats.overdue > 0 ? "red" : "slate", icon: "!" }
  ];

  return (
    <div className="admin-order-stats-grid">
      {cards.map((card) => (
        <article key={card.key} className={`admin-order-stat-card tone-${card.tone}`}>
          <span className="admin-order-stat-icon">{card.icon}</span>
          <div>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </div>
        </article>
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
  onApplyQuickFilter,
  onReset,
  statusFilter
}) {
  const isQuickActive = (preset) => {
    if (preset === "all") {
      return !keyword && statusFilter === "all" && sourceFilter === "all" && fulfillmentFilter === "all" && paymentFilter === "all";
    }
    if (preset === "new") return statusFilter === "new";
    if (preset === "doing") return statusFilter === "doing";
    if (preset === "grab") return sourceFilter === "grabfood";
    if (preset === "shopee") return sourceFilter === "shopeefood";
    if (preset === "pos") return sourceFilter === "pos";
    if (preset === "website") return sourceFilter === "website";
    return false;
  };
  return (
    <>
      <div className="admin-order-filter-bar">
        <label className="admin-order-search">
          <span>🔎</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm mã đơn, tên khách, số điện thoại..."
          />
        </label>
        <select value={fulfillmentFilter} onChange={(event) => setFulfillmentFilter(event.target.value)}>
          <option value="all">Tất cả hình thức</option>
          <option value="delivery">Giao hàng</option>
          <option value="pickup">Tự đến lấy</option>
        </select>
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
          <option value="all">Tất cả nguồn</option>
          <option value="website">Website</option>
          <option value="pos">POS / Mua tại quầy</option>
          <option value="qr_counter">QR tại quầy</option>
          <option value="grabfood">Grab</option>
          <option value="shopeefood">Shopee</option>
          <option value="xanhngon">Xanh Ngon</option>
          <option value="unknown">Chưa xác định</option>
          <option value="other">Khác</option>
        </select>
        <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
          <option value="all">Tất cả thanh toán</option>
          <option value="cod">COD</option>
          <option value="paid">Đã trả trước</option>
        </select>
        <button type="button" className="admin-order-filter-reset" onClick={onReset}>Xóa lọc</button>
      </div>
      <div className="admin-order-quick-filters">
        <button type="button" className={isQuickActive("all") ? "is-active" : ""} onClick={() => onApplyQuickFilter("all")}>Tất cả</button>
        <button type="button" className={isQuickActive("new") ? "is-active" : ""} onClick={() => onApplyQuickFilter("new")}>Đơn mới</button>
        <button type="button" className={isQuickActive("doing") ? "is-active" : ""} onClick={() => onApplyQuickFilter("doing")}>Đang làm</button>
        <button type="button" className={isQuickActive("grab") ? "is-active" : ""} onClick={() => onApplyQuickFilter("grab")}>Grab</button>
        <button type="button" className={isQuickActive("shopee") ? "is-active" : ""} onClick={() => onApplyQuickFilter("shopee")}>Shopee</button>
        <button type="button" className={isQuickActive("pos") ? "is-active" : ""} onClick={() => onApplyQuickFilter("pos")}>POS</button>
        <button type="button" className={isQuickActive("website") ? "is-active" : ""} onClick={() => onApplyQuickFilter("website")}>Website</button>
      </div>
    </>
  );
}

function OrderStatusSelect({ order, status, updateOrderStatus }) {
  const orderId = getOrderId(order);
  const fulfillmentType = getFulfillmentType(order);
  const isPartnerOrder = isReadOnlyPartnerOrder(order);

  if (isPartnerOrder) {
    return <span className="admin-order-status-readonly">Đồng bộ NexPOS</span>;
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
  if (isPartnerOrder) return null;
  const quickActions = fulfillmentType === "delivery"
    ? [
        { value: "new", label: "Mới" },
        { value: "doing", label: "Làm" },
        { value: "delivering", label: "Giao" },
        { value: "done", label: "Xong" }
      ]
    : [
        { value: "new", label: "Mới" },
        { value: "doing", label: "Làm" },
        { value: "done", label: "Xong" }
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
        <span>Thực nhận</span>
        <span>Cập nhật</span>
      </div>
      <div className="admin-order-table-body">
        {orders.map((order) => {
          const orderId = getOrderId(order);
          const status = getDisplayStatus(order);
          const fulfillmentType = getFulfillmentType(order);
          const waitingMinutes = getWaitingMinutes(order.createdAt);
          const isActive = String(activeOrderId) === String(orderId);
          const settlement = getSettlement(order);
          const sourceMeta = getOrderSourceMeta(order);
          const partnerNetRevenue = Number(order.realReceived || order.netReceived || order.grossReceived || 0);
          const netRevenue = partnerNetRevenue > 0 ? partnerNetRevenue : Number(settlement?.netRevenue || 0);
          const branchName = getOrderBranchName(order);
          const shortBranchName = getShortBranchName(branchName);
          const fulfillmentMeta = getFulfillmentMeta(order);

          return (
            <article
              key={orderId}
              className={`admin-order-row ${isActive ? "is-selected" : ""}`}
              onClick={() => onSelectOrder(order)}
            >
              <div className="admin-order-cell admin-order-code-cell">
                <strong>{getDisplayOrderCode(order)}</strong>
                <small>{waitingMinutes} phút</small>
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
                <strong>{formatMoney(netRevenue)}</strong>
                <small>Tổng thu khách: {formatMoney(Number(order.totalAmount || order.total || 0))}</small>
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
            <strong>{String(order.paymentMethod || "COD").toUpperCase()}</strong>
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
  const partnerGrossReceived = Number(order.grossReceived || 0);
  const partnerNetReceived = Number(order.netReceivedAmount || order.realReceived || order.netReceived || 0);
  const partnerFeeDeduction = Math.max(0, partnerGrossReceived - partnerNetReceived);
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
  const netReceived = isPartnerOrder
    ? Number(partnerNetReceived || order.realReceived || order.netReceived || 0)
    : Number(settlement.netRevenue || 0);
  const highlightedReceived = netReceived > 0 ? netReceived : Math.max(totalValue - shippingFee, 0);

  return (
    <aside className={`admin-order-detail-panel ${isOpen ? "is-open" : ""}`}>
      <div className="admin-order-detail-head admin-order-detail-head-v2">
        <div className="admin-order-detail-title-block">
          <span>Chi tiết đơn hàng</span>
          <h3>{getDisplayOrderCode(order)}</h3>
          <small>{formatOrderTime(order.createdAt)}</small>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết đơn">×</button>
      </div>

      <div className="admin-order-detail-scroll">
        <section className="admin-order-detail-summary-card">
          <div className="admin-order-detail-status-line">
            <OrderStatusBadge status={status} />
            <span className={`admin-order-type-badge ${sourceMeta.className}`}>{sourceMeta.label}</span>
            <span className={`admin-order-type-badge ${fulfillmentMeta.className}`}>{fulfillmentMeta.label}</span>
          </div>

          {branchName ? (
            <div className="admin-order-detail-branch">
              <span>Chi nhánh xử lý</span>
              <strong>{branchName}</strong>
            </div>
          ) : null}

          <div className="admin-order-detail-summary-grid">
            <div>
              <span>Thanh toán</span>
              <strong>{String(order.paymentMethod || "COD").toUpperCase()}</strong>
            </div>
            <div>
              <span>Món</span>
              <strong>{totalItemQuantity}</strong>
            </div>
            <div>
              <span>Tổng thu khách</span>
              <strong>{formatMoney(totalValue)}</strong>
            </div>
          </div>
        </section>

        <section className="admin-order-detail-card admin-order-customer-card">
          <div className="admin-order-detail-section-head">
            <h4>Khách hàng</h4>
          </div>
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

        <section className="admin-order-detail-card admin-order-items-card">
          <div className="admin-order-detail-section-head">
            <h4>Danh sách món</h4>
            <span>{items.length} món • {totalItemQuantity} phần</span>
          </div>
          <div className="admin-order-item-list">
            {items.map((item, index) => {
              const lineTotal = Number(item.lineTotal || (item.unitTotal || item.price || 0) * (item.quantity || 1));
              const options = getOrderItemOptionLabels(item, { includeQuantity: true });
              return (
                <div key={`${item.id || item.name}-${index}`} className="admin-order-detail-item">
                  <div>
                    <strong>{item.name}</strong>
                    {options.length ? <small>{options.join(" • ")}</small> : null}
                  </div>
                  <span>x{item.quantity || 1}</span>
                  <em>{formatMoney(lineTotal)}</em>
                </div>
              );
            })}
          </div>
        </section>

        <section className="admin-order-detail-card admin-order-payment-card">
          <div className="admin-order-payment-highlight">
            <span>{isPartnerOrder ? "Quán thực nhận" : "Doanh thu thực nhận"}</span>
            <strong>{formatMoney(highlightedReceived)}</strong>
          </div>
          <div className="admin-order-detail-section-head">
            <h4>Thanh toán</h4>
          </div>
          <div className="admin-order-total-lines">
            <div><span>Tạm tính</span><strong>{formatMoney(subtotalValue)}</strong></div>
            <div><span>Phí giao hàng</span><strong>{fulfillmentType === "pickup" ? "0đ (Tự lấy)" : formatMoney(shippingFee)}</strong></div>
            {coFundPromotion > 0 ? <div className="discount"><span>Đồng tài trợ</span><strong>-{formatMoney(coFundPromotion)}</strong></div> : null}
            {appPromotion > 0 ? <div className="discount"><span>Khuyến mãi app</span><strong>-{formatMoney(appPromotion)}</strong></div> : null}
            {shippingSupport > 0 ? <div className="discount"><span>GHR hỗ trợ ship</span><strong>-{formatMoney(shippingSupport)}</strong></div> : null}
            {promoDiscount > 0 ? <div className="discount"><span>Mã giảm giá {order.promoCode || ""}</span><strong>-{formatMoney(promoDiscount)}</strong></div> : null}
            {pointsDiscount > 0 ? <div className="discount"><span>Dùng điểm thưởng</span><strong>-{formatMoney(pointsDiscount)}</strong></div> : null}
            <div className="grand"><span>Tổng thu khách</span><strong>{formatMoney(totalValue)}</strong></div>
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
              <h4>Đối soát shipper</h4>
            </div>
            <div className="admin-order-total-lines">
              <div><span>Khách trả khi nhận</span><strong>{formatMoney(settlement.customerNeedPayWhenReceive || totalValue)}</strong></div>
              <div><span>Khách trả phí ship</span><strong>{formatMoney(settlement.shippingFeeCustomer)}</strong></div>
              <div><span>Quán hỗ trợ ship</span><strong>{formatMoney(settlement.shippingSupport)}</strong></div>
              <div className="grand"><span>Shipper nộp lại quán</span><strong>{formatMoney(settlement.shipperPayBackStore)}</strong></div>
            </div>
          </section>
        ) : null}

        {(partnerGrossReceived > 0 || partnerFeeDeduction > 0) ? (
          <section className="admin-order-detail-card admin-order-settlement-card">
            <div className="admin-order-detail-section-head">
              <h4>Đối soát FoodApp</h4>
            </div>
            <div className="admin-order-total-lines">
              {partnerGrossReceived > 0 ? <div><span>Doanh thu trước phí</span><strong>{formatMoney(partnerGrossReceived)}</strong></div> : null}
              {partnerFeeDeduction > 0 ? <div className="discount"><span>Khấu trừ FoodApp</span><strong>-{formatMoney(partnerFeeDeduction)}</strong></div> : null}
            </div>
          </section>
        ) : null}

        {note ? (
          <section className="admin-order-detail-card">
            <div className="admin-order-detail-section-head">
              <h4>Ghi chú</h4>
            </div>
            <p className="admin-order-note">{note}</p>
          </section>
        ) : null}

        {shouldShowShipperSection ? (
          <section className="admin-order-detail-card">
            <div className="admin-order-detail-section-head">
              <h4>Thông tin gửi shipper</h4>
            </div>
            <button type="button" className="admin-order-copy-btn" onClick={() => onCopyShipper(orderId)}>
              {copied ? "Đã copy" : "Copy info shipper"}
            </button>
            <textarea readOnly value={shipperText || ""} />
          </section>
        ) : null}
      </div>

      <div className="admin-order-detail-actions">
        {isPartnerOrder ? (
          <span className="admin-order-partner-sync-note">Theo trạng thái NexPOS</span>
        ) : (
          <OrderStatusSelect order={order} status={status} updateOrderStatus={updateOrderStatus} />
        )}
      </div>
    </aside>
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
  const snapshotHasPartnerOrders = useMemo(
    () => (ordersSnapshot || []).some((order) => order?.sourceType === "partner"),
    [ordersSnapshot]
  );

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
    const matchPayment = paymentFilter === "all" || (paymentFilter === "cod" ? paymentMethod.includes("COD") : !paymentMethod.includes("COD"));
    return matchKeyword && matchFulfillment && matchBranch && matchSource && matchPayment;
  }), [adminOrderFeed, keyword, fulfillmentFilter, branchFilter, selectedBranchOption, sourceFilter, paymentFilter]);

  const statusCounts = useMemo(() => searchedOrders.reduce((counts, order) => {
    const status = getDisplayStatus(order);
    counts.all += 1;
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, { all: 0, new: 0, doing: 0, delivering: 0, done: 0 }), [searchedOrders]);

  const visibleOrders = useMemo(() => {
    if (statusFilter === "all") return searchedOrders;
    return searchedOrders.filter((order) => getDisplayStatus(order) === statusFilter);
  }, [searchedOrders, statusFilter]);
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
    const deliveryCount = searchedOrders.filter((order) => getFulfillmentType(order) === "delivery").length;
    const pickupCount = searchedOrders.length - deliveryCount;
    return {
      total: searchedOrders.length,
      new: statusCounts.new,
      doing: statusCounts.doing,
      delivering: statusCounts.delivering,
      done: statusCounts.done,
      overdue,
      deliveryCount,
      pickupCount
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

  const applyQuickFilter = (preset) => {
    if (preset === "all") {
      resetFilters();
      return;
    }
    if (preset === "new") {
      setStatusFilter("new");
      setSourceFilter("all");
      return;
    }
    if (preset === "doing") {
      setStatusFilter("doing");
      setSourceFilter("all");
      return;
    }
    if (preset === "grab") {
      setSourceFilter("grabfood");
      setStatusFilter("all");
      return;
    }
    if (preset === "shopee") {
      setSourceFilter("shopeefood");
      setStatusFilter("all");
      return;
    }
    if (preset === "pos") {
      setSourceFilter("pos");
      setStatusFilter("all");
      return;
    }
    if (preset === "website") {
      setSourceFilter("website");
      setStatusFilter("all");
      return;
    }
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

        <OrderStatsCards stats={orderStats} />
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
          onApplyQuickFilter={applyQuickFilter}
          onReset={resetFilters}
          statusFilter={statusFilter}
        />
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

      <OrderDetailPanelV2
        order={activeOrder}
        updateOrderStatus={safeUpdateOrderStatus}
        shipperText={activeOrder ? shipperInfoByOrderId[getOrderId(activeOrder)] : ""}
        copied={activeOrder ? copiedOrderId === getOrderId(activeOrder) : false}
        onCopyShipper={copyShipperInfo}
        onClose={() => setDetailPanelOpen(false)}
        isOpen={detailPanelOpen}
        registeredCustomersByPhone={registeredCustomersByPhone}
      />
    </div>
  );
}
