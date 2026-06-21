import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "../../../utils/format.js";
import { getOrderItemOptionLabels } from "../../../utils/orderItemDisplay.js";
import { getCustomerKey } from "../../../services/storageService.js";
import { buildAdminOrderFeed, readPartnerOrdersForAdmin } from "../../../services/adminOrderFeedService.js";
import { resolveOrderSourceKey } from "../../../services/partnerOrderService.js";
import {
  branchOptionMatchesOrder,
  buildBranchFilterOptions
} from "../../../services/branchIdentityService.js";
import { calculateOrderPoints, getLoyaltyRuleConfig } from "../../../services/loyaltyService.js";
import { buildVietnamDateRange } from "../../../utils/adminDateRange.js";
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

function isReadOnlyPartnerOrder(order) {
  return String(order?.sourceType || "").toLowerCase() === "partner";
}
function getOrderSourceMeta(order) {
  const source = resolveOrderSourceKey(order);
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
  if (source === "pickup") {
    return {
      label: "Tự Lấy",
      className: "is-pickup"
    };
  }
  if (source === "qr_counter") {
    return {
      label: "QR tại quầy",
      className: "is-qr-counter"
    };
  }
  return {
    label: "Website",
    className: "is-website"
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

function OrderTabs({ activeStatus, statusCounts, onChange }) {
  const tabs = ["all", "new", "doing", "delivering", "done"].filter((status) => status === "all" || statusCounts[status] > 0);

  return (
    <div className="admin-order-tabs" role="tablist" aria-label="Lọc trạng thái đơn">
      {tabs.map((status) => (
        <button
          key={status}
          type="button"
          className={activeStatus === status ? "active" : ""}
          onClick={() => onChange(status)}
        >
          {getStatusLabel(status)}
          <span>{statusCounts[status] || 0}</span>
        </button>
      ))}
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
  branchFilter,
  setBranchFilter,
  branchOptions,
  paymentFilter,
  setPaymentFilter,
  onApplyQuickFilter,
  onReset
}) {
  const quickBranches = branchOptions.slice(0, 3);
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
          <option value="pickup">Tự Lấy</option>
          <option value="qr_counter">QR Tại Quầy</option>
          <option value="grabfood">Grab</option>
          <option value="shopeefood">Shopee</option>
          <option value="xanhngon">Xanh Ngon</option>
        </select>
        {branchOptions.length ? (
          <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
            <option value="all">Tất cả chi nhánh</option>
            {branchOptions.map((branch) => (
              <option key={branch.value} value={branch.value}>{branch.label}</option>
            ))}
          </select>
        ) : null}
        <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
          <option value="all">Tất cả thanh toán</option>
          <option value="cod">COD</option>
          <option value="paid">Đã trả trước</option>
        </select>
        <button type="button" onClick={onReset}>Xóa lọc</button>
      </div>
      <div className="admin-order-quick-filters">
        <button type="button" onClick={() => onApplyQuickFilter("all")}>Tất cả</button>
        <button type="button" onClick={() => onApplyQuickFilter("new")}>Đơn mới</button>
        <button type="button" onClick={() => onApplyQuickFilter("doing")}>Đang làm</button>
        <button type="button" onClick={() => onApplyQuickFilter("grab")}>Grab</button>
        <button type="button" onClick={() => onApplyQuickFilter("shopee")}>Shopee</button>
        <button type="button" onClick={() => onApplyQuickFilter("website")}>Website</button>
        {quickBranches.map((branch) => (
          <button key={branch.value} type="button" onClick={() => onApplyQuickFilter("branch", branch.value)}>
            {branch.label}
          </button>
        ))}
      </div>
    </>
  );
}

function OrderStatusSelect({ order, status, updateOrderStatus }) {
  return <span className="admin-order-status-readonly">Chi nhánh xử lý</span>;

  const orderId = getOrderId(order);
  const fulfillmentType = getFulfillmentType(order);
  const isPartnerOrder = isReadOnlyPartnerOrder(order);

  if (isPartnerOrder) {
    return <span className="admin-order-status-readonly">Đồng bộ NexPOS</span>;
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
        <span>Hình thức</span>
        <span>Thời gian</span>
        <span>Trạng thái</span>
        <span>Thực nhận</span>
        <span>Thao tác</span>
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
                {branchName ? <small className="admin-order-branch-name" title={branchName}>{branchName}</small> : null}
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
  const sourceKey = resolveOrderSourceKey(order);
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
  const partnerNetReceived = Number(order.realReceived || order.netReceived || 0);
  const pointsBaseAmount = Number(order.pointsBaseAmount || Math.max(totalValue - shippingFee, 0));
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

export default function OrderManager({
  ordersSnapshot,
  updateOrderStatus,
  branches = [],
  registeredCustomersByPhone = {},
  ordersDateFrom = "",
  ordersDateTo = ""
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
    const source = resolveOrderSourceKey(order);
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
    const overdue = searchedOrders.filter((order) => getWaitingMinutes(order.createdAt) > 15).length;
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
    setBranchFilter("all");
    setPaymentFilter("all");
  };

  const applyQuickFilter = (preset, branchValue = "all") => {
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
    if (preset === "website") {
      setSourceFilter("website");
      setStatusFilter("all");
      return;
    }
    if (preset === "branch") {
      setBranchFilter(branchValue);
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

        <OrderTabs activeStatus={statusFilter} statusCounts={statusCounts} onChange={setStatusFilter} />
        <OrderStatsCards stats={orderStats} />
        <OrderFilterBar
          keyword={keyword}
          setKeyword={setKeyword}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          fulfillmentFilter={fulfillmentFilter}
          setFulfillmentFilter={setFulfillmentFilter}
          branchFilter={branchFilter}
          setBranchFilter={setBranchFilter}
          branchOptions={branchOptions}
          paymentFilter={paymentFilter}
          setPaymentFilter={setPaymentFilter}
          onApplyQuickFilter={applyQuickFilter}
          onReset={resetFilters}
        />
        <OrderList
          orders={pagedOrders}
          activeOrderId={activeOrder ? getOrderId(activeOrder) : activeOrderId}
          onSelectOrder={handleSelectOrder}
          updateOrderStatus={safeUpdateOrderStatus}
          registeredCustomersByPhone={registeredCustomersByPhone}
        />
        {visibleOrders.length > ORDER_PAGE_SIZE ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 4px 0",
              color: "#64748b",
              fontSize: 13,
              fontWeight: 800
            }}
          >
            <span>
              Hiển thị {pagedOrders.length} / {visibleOrders.length} đơn · Trang {safeCurrentPage}/{totalPages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                style={{
                  border: "1px solid #d7deea",
                  background: "#ffffff",
                  color: "#334155",
                  borderRadius: 10,
                  padding: "9px 13px",
                  fontWeight: 900,
                  cursor: safeCurrentPage <= 1 ? "not-allowed" : "pointer",
                  opacity: safeCurrentPage <= 1 ? 0.55 : 1
                }}
              >
                Trước
              </button>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                style={{
                  border: "1px solid #f97316",
                  background: "#fff7ed",
                  color: "#c2410c",
                  borderRadius: 10,
                  padding: "9px 13px",
                  fontWeight: 900,
                  cursor: safeCurrentPage >= totalPages ? "not-allowed" : "pointer",
                  opacity: safeCurrentPage >= totalPages ? 0.55 : 1
                }}
              >
                Tiếp
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <OrderDetailPanel
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
