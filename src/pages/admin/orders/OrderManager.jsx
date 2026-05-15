import { useMemo, useState } from "react";
import { formatMoney } from "../../../utils/format.js";
import { getCustomerKey } from "../../../services/storageService.js";
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

function getOrderId(order) {
  return order.id || order.orderCode;
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

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getRegisteredCustomer(order, registeredCustomersByPhone) {
  const phone = getCustomerKey(order.customerPhone || order.phone || order.customerPhoneKey);
  return phone ? registeredCustomersByPhone?.[phone] || null : null;
}

function hasOrderNameMismatch(order, registeredCustomersByPhone) {
  const registered = getRegisteredCustomer(order, registeredCustomersByPhone);
  const registeredName = registered?.name || "";
  const orderName = order.orderCustomerName || order.customerName || "";
  return Boolean(registeredName && orderName && normalizeName(registeredName) !== normalizeName(orderName));
}

function normalizeBranchKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ganh\s*hang\s*rong/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function getOrderBranchCandidates(order) {
  return [
    order.deliveryBranchId,
    order.pickupBranchId,
    order.branchId,
    order.deliveryBranchName,
    order.pickupBranchName,
    order.branchName
  ].flatMap((value) => {
    const raw = String(value || "").trim();
    const normalized = normalizeBranchKey(raw);
    return [raw, normalized].filter(Boolean);
  });
}

function getBranchFilterValue(branch, index) {
  return String(branch?.id || branch?.name || `branch-${index}`);
}

function buildBranchOptions(branches = []) {
  return (branches || [])
    .map((branch, index) => {
      const label = String(branch?.name || "").trim();
      if (!label) return null;
      return {
        value: getBranchFilterValue(branch, index),
        label,
        aliases: [getBranchFilterValue(branch, index), branch?.id, branch?.name, branch?.address].flatMap((value) => {
          const raw = String(value || "").trim();
          const normalized = normalizeBranchKey(raw);
          return [raw, normalized].filter(Boolean);
        })
      };
    })
    .filter(Boolean);
}

function matchOrderBranch(order, branchOption) {
  if (!branchOption) return true;
  const candidates = getOrderBranchCandidates(order);
  return branchOption.aliases.some((alias) => candidates.includes(alias));
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

function OrderStatusBadge({ status }) {
  return <span className={`admin-order-status-badge ${getStatusClass(status)}`}>{getStatusLabel(status)}</span>;
}

function FulfillmentBadge({ type }) {
  const isPickup = type === "pickup";
  return (
    <span className={`admin-order-type-badge ${isPickup ? "is-pickup" : "is-delivery"}`}>
      {isPickup ? "Tại quầy" : "Ship"}
    </span>
  );
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
  fulfillmentFilter,
  setFulfillmentFilter,
  branchFilter,
  setBranchFilter,
  branchOptions,
  paymentFilter,
  setPaymentFilter,
  onReset
}) {
  return (
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
  );
}

function OrderStatusSelect({ order, status, updateOrderStatus }) {
  const orderId = getOrderId(order);
  const fulfillmentType = getFulfillmentType(order);

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
          const branchName = getOrderBranchName(order);
          const waitingMinutes = getWaitingMinutes(order.createdAt);
          const isActive = String(activeOrderId) === String(orderId);
          const nameMismatch = hasOrderNameMismatch(order, registeredCustomersByPhone);
          const settlement = getSettlement(order);

          return (
            <article
              key={orderId}
              className={`admin-order-row ${isActive ? "is-selected" : ""}`}
              onClick={() => onSelectOrder(order)}
            >
              <div className="admin-order-cell admin-order-code-cell">
                <strong>{order.orderCode || order.id}</strong>
                <small>{waitingMinutes} phút</small>
              </div>
              <div className="admin-order-cell">
                <strong>{order.customerName || "Khách lẻ"}</strong>
                <small>{order.customerPhone || order.phone || "--"}</small>
                {nameMismatch ? <span className="admin-order-name-mismatch-badge">Tên đặt khác tên tài khoản</span> : null}
              </div>
              <div className="admin-order-cell">
                <FulfillmentBadge type={fulfillmentType} />
                {branchName ? <small className="admin-order-branch-name">{branchName}</small> : null}
                <small>{String(order.paymentMethod || "COD").toUpperCase()}</small>
              </div>
              <div className="admin-order-cell">
                <span>{formatOrderTime(order.createdAt)}</span>
              </div>
              <div className="admin-order-cell">
                <OrderStatusBadge status={status} />
              </div>
              <div className="admin-order-cell admin-order-money">
                <strong>{formatMoney(Number(settlement?.netRevenue || 0))}</strong>
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
  const registeredCustomer = getRegisteredCustomer(order, registeredCustomersByPhone);
  const orderCustomerName = order.orderCustomerName || order.customerName || "";
  const nameMismatch = hasOrderNameMismatch(order, registeredCustomersByPhone);
  const addressText = fulfillmentType === "pickup"
    ? [order.branchName || order.pickupBranchName, order.branchAddress || order.pickupBranchAddress].filter(Boolean).join(" - ")
    : order.deliveryAddress;
  const note = order.note || order.customerNote || order.orderNote || "";

  return (
    <aside className={`admin-order-detail-panel ${isOpen ? "is-open" : ""}`}>
      <div className="admin-order-detail-head">
        <div>
          <span>Chi tiết đơn hàng</span>
          <h3>{order.orderCode || order.id}</h3>
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
            <FulfillmentBadge type={fulfillmentType} />
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
          {nameMismatch ? (
            <div className="admin-order-detail-row">
              <span>Lưu ý</span>
              <strong><span className="admin-order-name-mismatch-badge">Tên đặt khác tên tài khoản</span></strong>
            </div>
          ) : null}
        </section>

        <section className="admin-order-detail-card">
          <h4>Danh sách món</h4>
          <div className="admin-order-item-list">
            {items.map((item, index) => {
              const lineTotal = Number(item.lineTotal || (item.unitTotal || item.price || 0) * (item.quantity || 1));
              const options = [item.spice, ...(item.toppings || []).map((topping) => `${topping.name}${topping.quantity ? ` x${topping.quantity}` : ""}`), item.note ? `Ghi chú: ${item.note}` : ""].filter(Boolean);
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
            {shippingSupport > 0 ? <div className="discount"><span>GHR hỗ trợ ship</span><strong>-{formatMoney(shippingSupport)}</strong></div> : null}
            {promoDiscount > 0 ? <div className="discount"><span>Mã giảm giá {order.promoCode || ""}</span><strong>-{formatMoney(promoDiscount)}</strong></div> : null}
            {pointsDiscount > 0 ? <div className="discount"><span>Dùng điểm thưởng</span><strong>-{formatMoney(pointsDiscount)}</strong></div> : null}
            <div className="grand"><span>Tổng cộng</span><strong>{formatMoney(totalValue)}</strong></div>
          </div>
        </section>

        {fulfillmentType === "delivery" ? (
          <section className="admin-order-detail-card admin-order-settlement-card">
            <h4>Đối soát shipper</h4>
            <div className="admin-order-total-lines">
              <div><span>Khách trả khi nhận</span><strong>{formatMoney(settlement.customerNeedPayWhenReceive)}</strong></div>
              <div><span>Khách trả phí ship</span><strong>{formatMoney(settlement.shippingFeeCustomer)}</strong></div>
              <div><span>Quán hỗ trợ ship</span><strong>{formatMoney(settlement.shippingSupport)}</strong></div>
              <div className="grand"><span>Shipper nộp lại quán</span><strong>{formatMoney(settlement.shipperPayBackStore)}</strong></div>
            </div>
          </section>
        ) : null}

        {note ? (
          <section className="admin-order-detail-card">
            <h4>Ghi chú</h4>
            <p className="admin-order-note">{note}</p>
          </section>
        ) : null}

        {fulfillmentType === "delivery" ? (
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
        <OrderQuickActions order={order} status={status} updateOrderStatus={updateOrderStatus} />
      </div>
    </aside>
  );
}

export default function OrderManager({ ordersSnapshot, updateOrderStatus, branches = [], registeredCustomersByPhone = {} }) {
  const [activeOrderId, setActiveOrderId] = useState("");
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const branchOptions = useMemo(() => buildBranchOptions(branches), [branches]);
  const selectedBranchOption = useMemo(
    () => branchOptions.find((branch) => branch.value === branchFilter) || null,
    [branchOptions, branchFilter]
  );

  const searchedOrders = useMemo(() => (ordersSnapshot || []).filter((order) => {
    const key = keyword.trim().toLowerCase();
    const orderCode = String(order.orderCode || order.id || "").toLowerCase();
    const customerName = String(`${order.customerName || ""} ${order.orderCustomerName || ""}`).toLowerCase();
    const customerPhone = String(`${order.customerPhone || ""} ${order.phone || ""} ${order.customerPhoneKey || ""}`).toLowerCase();
    const normalizedSearchPhone = getCustomerKey(key);
    const fulfillmentType = getFulfillmentType(order);
    const paymentMethod = String(order.paymentMethod || "COD").toUpperCase();
    const matchKeyword = !key || orderCode.includes(key) || customerName.includes(key) || customerPhone.includes(key) || (normalizedSearchPhone && customerPhone.includes(normalizedSearchPhone));
    const matchFulfillment = fulfillmentFilter === "all" || fulfillmentFilter === fulfillmentType;
    const matchBranch = branchFilter === "all" || matchOrderBranch(order, selectedBranchOption);
    const matchPayment = paymentFilter === "all" || (paymentFilter === "cod" ? paymentMethod.includes("COD") : !paymentMethod.includes("COD"));
    return matchKeyword && matchFulfillment && matchBranch && matchPayment;
  }), [ordersSnapshot, keyword, fulfillmentFilter, branchFilter, selectedBranchOption, paymentFilter]);

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
    (ordersSnapshot || []).forEach((order) => {
      result[getOrderId(order)] = buildShipperInfoText(order, formatMoney);
    });
    return result;
  }, [ordersSnapshot]);

  const activeOrder = useMemo(() => {
    if (!visibleOrders.length) return null;
    return visibleOrders.find((order) => String(getOrderId(order)) === String(activeOrderId)) || visibleOrders[0];
  }, [visibleOrders, activeOrderId]);

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
    setBranchFilter("all");
    setPaymentFilter("all");
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
          fulfillmentFilter={fulfillmentFilter}
          setFulfillmentFilter={setFulfillmentFilter}
          branchFilter={branchFilter}
          setBranchFilter={setBranchFilter}
          branchOptions={branchOptions}
          paymentFilter={paymentFilter}
          setPaymentFilter={setPaymentFilter}
          onReset={resetFilters}
        />
        <OrderList
          orders={visibleOrders}
          activeOrderId={activeOrder ? getOrderId(activeOrder) : activeOrderId}
          onSelectOrder={handleSelectOrder}
          updateOrderStatus={updateOrderStatus}
          registeredCustomersByPhone={registeredCustomersByPhone}
        />
      </section>

      <OrderDetailPanel
        order={activeOrder}
        updateOrderStatus={updateOrderStatus}
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
