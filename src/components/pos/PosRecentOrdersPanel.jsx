import { useMemo, useState } from "react";
import { canCancelPosOrder } from "../../services/posService.js";
import PosPendingPaymentsPanel from "./PosPendingPaymentsPanel.jsx";
import { formatMoney, getOrderCode, getOrderTotal, toText } from "./posHelpers.js";

const STATUS_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "pending_payment", label: "Chờ thanh toán" },
  { id: "processing", label: "Đang xử lý" },
  { id: "completed", label: "Hoàn tất" },
  { id: "cancelled", label: "Đã hủy" }
];

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getOrderStatusGroup(order = {}) {
  const metadata = getObject(order.metadata);
  const status = toText(order.status || order.orderStatus || metadata.status).toLowerCase();
  const kitchenStatus = toText(
    order.kitchenStatus ||
    order.kitchen_status ||
    metadata.kitchenStatus ||
    metadata.kitchen_status
  ).toLowerCase();
  const paymentStatus = toText(order.paymentStatus || metadata.paymentStatus || metadata.payment_status).toLowerCase();

  if (["cancelled", "canceled", "cancel"].includes(status) ||
    ["cancelled", "canceled", "cancel"].includes(kitchenStatus)) return "cancelled";
  if (["done", "completed", "complete"].includes(status) ||
    ["done", "completed", "complete"].includes(kitchenStatus)) return "completed";
  if (status === "pending_payment" || paymentStatus === "pending") return "pending_payment";
  return "processing";
}

function getOrderHistoryStatusLabel(order = {}) {
  const statusGroup = getOrderStatusGroup(order);
  if (statusGroup === "completed") return "Hoàn tất";
  if (statusGroup === "cancelled") return "Đã hủy";
  if (statusGroup === "pending_payment") return "Chờ thanh toán";
  return "Đang xử lý";
}

function getPaymentLabel(order = {}) {
  const metadata = getObject(order.metadata);
  const method = toText(order.paymentMethod || metadata.paymentMethod).toLowerCase();
  if (method === "bank_qr") return "QR chuyển khoản";
  if (method === "cash") return "Tiền mặt";
  return "Chưa xác định";
}

function getPaymentStatusLabel(order = {}) {
  const metadata = getObject(order.metadata);
  const status = toText(order.paymentStatus || metadata.paymentStatus || metadata.payment_status).toLowerCase();
  if (status === "paid") return "Đã thanh toán";
  if (status === "pending") return "Chờ thanh toán";
  return "Chưa thanh toán";
}

function maskPhone(value = "") {
  const phone = toText(value);
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

function formatOrderTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function isToday(value) {
  const date = new Date(value || 0);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function getItemOptions(item = {}) {
  return Array.from(new Set([
    ...(Array.isArray(item.options) ? item.options : []),
    ...(Array.isArray(item.toppings) ? item.toppings.map((entry) => entry?.name || entry?.label || entry?.value) : [])
  ].map(toText).filter(Boolean)));
}

function OrderDetailModal({ order, cancellingOrderId, onClose, onCancelOrder }) {
  if (!order) return null;

  const orderId = toText(order.id || order.orderCode);
  const metadata = getObject(order.metadata);
  const items = Array.isArray(order.items) ? order.items : [];
  const allowCancel = canCancelPosOrder(order);
  const cashierName = toText(metadata.cashierName || metadata.shift?.cashierName);

  return (
    <div className="pos-modal-layer" role="presentation">
      <button type="button" className="pos-modal-backdrop" aria-label="Đóng chi tiết đơn" onClick={onClose} />
      <section className="pos-recent-order-detail-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span>Chi tiết đơn</span>
            <strong>{getOrderCode(order)}</strong>
          </div>
          <button type="button" onClick={onClose}>Đóng</button>
        </header>

        <div className="pos-order-detail-summary">
          <div><span>Trạng thái</span><strong>{getOrderHistoryStatusLabel(order)}</strong></div>
          <div><span>Thời gian</span><strong>{formatOrderTime(order.createdAt)}</strong></div>
          <div><span>Thẻ rung</span><strong>{order.pagerNumber ? `Thẻ ${order.pagerNumber}` : "Không có"}</strong></div>
          <div><span>Tổng tiền</span><strong>{formatMoney(getOrderTotal(order))}</strong></div>
          <div><span>Thanh toán</span><strong>{getPaymentLabel(order)}</strong></div>
          <div><span>Xác nhận</span><strong>{getPaymentStatusLabel(order)}</strong></div>
        </div>

        <div className="pos-order-detail-customer">
          <strong>{order.customerName || "Khách vãng lai"}</strong>
          {order.customerPhone ? <span>{order.customerPhone}</span> : <span>Không có SĐT</span>}
          {cashierName ? <small>Thu ngân: {cashierName}</small> : null}
        </div>

        <div className="pos-recent-order-item-list">
          {items.map((item, index) => {
            const options = getItemOptions(item);
            return (
              <div key={`${orderId}-${index}`} className="pos-recent-order-item-row">
                <div className="pos-recent-order-item-head">
                  <strong>{item.name}</strong>
                  <span>x{item.quantity || 1} · {formatMoney(item.lineTotal || item.price)}</span>
                </div>
                {options.length ? (
                  <div className="pos-recent-order-item-tags">
                    {options.map((option) => <small key={option}>{option}</small>)}
                  </div>
                ) : null}
                {item.note ? <em>{item.note}</em> : null}
              </div>
            );
          })}
        </div>

        {allowCancel ? (
          <button
            type="button"
            className="pos-order-detail-cancel"
            disabled={cancellingOrderId === orderId}
            onClick={() => onCancelOrder(order)}
          >
            {cancellingOrderId === orderId ? "Đang hủy..." : "Hủy đơn"}
          </button>
        ) : null}
      </section>
    </div>
  );
}

export default function PosRecentOrdersPanel({
  orders,
  paymentSessions = [],
  loading,
  paymentSessionsLoading = false,
  error,
  paymentSessionsError = "",
  cancellingOrderId,
  activePaymentSessionId = "",
  cancellingPaymentSessionId = "",
  onRefresh,
  onCancelOrder,
  onOpenPaymentSession,
  onCancelPaymentSession
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");
  const [selectedOrderId, setSelectedOrderId] = useState("");

  const filteredOrders = useMemo(() => (Array.isArray(orders) ? orders : []).filter((order) => {
    if (dateFilter === "today" && !isToday(order.createdAt)) return false;
    return statusFilter === "all" || getOrderStatusGroup(order) === statusFilter;
  }), [dateFilter, orders, statusFilter]);
  const filteredPaymentSessions = useMemo(
    () => (Array.isArray(paymentSessions) ? paymentSessions : []).filter((session) => {
      if (dateFilter === "today" && !isToday(session.createdAt)) return false;
      const status = toText(session.status).toLowerCase();
      const group = ["draft", "pending_payment"].includes(status)
        ? "pending_payment"
        : "processing";
      return statusFilter === "all" || statusFilter === group;
    }),
    [dateFilter, paymentSessions, statusFilter]
  );
  const pendingPaymentCount = useMemo(
    () => (Array.isArray(paymentSessions) ? paymentSessions : []).filter((session) => (
      ["draft", "pending_payment"].includes(toText(session.status).toLowerCase())
    )).length,
    [paymentSessions]
  );
  const selectedOrder = useMemo(
    () => (Array.isArray(orders) ? orders : []).find((order) => toText(order.id || order.orderCode) === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  return (
    <div className="pos-order-history-panel">
      <div className="pos-order-history-toolbar">
        <div className="pos-order-history-filters" role="tablist" aria-label="Lọc trạng thái đơn">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={statusFilter === filter.id ? "is-active" : ""}
              onClick={() => setStatusFilter(filter.id)}
            >
              {filter.id === "pending_payment" && pendingPaymentCount > 0
                ? `${filter.label} (${pendingPaymentCount})`
                : filter.label}
            </button>
          ))}
        </div>
        <div className="pos-order-history-actions">
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Lọc ngày">
            <option value="today">Hôm nay</option>
            <option value="all">Tất cả ngày</option>
          </select>
          <button type="button" onClick={onRefresh} disabled={loading || paymentSessionsLoading}>
            {loading || paymentSessionsLoading ? "Đang tải..." : "Tải lại"}
          </button>
        </div>
      </div>

      {error ? <div className="pos-create-message is-error">{error}</div> : null}
      {paymentSessionsError ? <div className="pos-create-message is-error">{paymentSessionsError}</div> : null}

      <div className="pos-recent-orders-list pos-recent-orders-list--embedded">
        {filteredPaymentSessions.length ? (
          <PosPendingPaymentsPanel
            embedded
            sessions={filteredPaymentSessions}
            activeSessionId={activePaymentSessionId}
            cancellingSessionId={cancellingPaymentSessionId}
            onOpen={onOpenPaymentSession}
            onCancel={onCancelPaymentSession}
          />
        ) : null}

        {filteredOrders.length ? filteredOrders.map((order) => {
          const orderId = toText(order.id || order.orderCode);
          const items = Array.isArray(order.items) ? order.items : [];
          const firstItem = items[0];
          const statusGroup = getOrderStatusGroup(order);
          return (
            <button key={orderId} type="button" className="pos-recent-order-card" onClick={() => setSelectedOrderId(orderId)}>
              <div className="pos-recent-order-title-row">
                <strong>{getOrderCode(order)}</strong>
                <span className="pos-recent-order-total">{formatMoney(getOrderTotal(order))}</span>
                <em className={`pos-order-status pos-order-status--${statusGroup}`}>{getOrderHistoryStatusLabel(order)}</em>
              </div>
              <div className="pos-recent-order-meta">
                <span>{formatOrderTime(order.createdAt)}</span>
                <span>{order.pagerNumber ? `Thẻ ${order.pagerNumber}` : "Không có thẻ"}</span>
                <span>{order.customerName || "Khách vãng lai"}</span>
                {order.customerPhone ? <span>{maskPhone(order.customerPhone)}</span> : null}
                <span>{items.length} món</span>
                <span>{getPaymentLabel(order)}</span>
                <span className={`pos-payment-state is-${getPaymentStatusLabel(order) === "Đã thanh toán" ? "paid" : "pending"}`}>
                  {getPaymentStatusLabel(order)}
                </span>
              </div>
              {firstItem ? (
                <div className="pos-recent-order-preview">
                  <strong>{firstItem.name} ×{firstItem.quantity || 1}</strong>
                  {items.length > 1 ? <span>+{items.length - 1} món khác</span> : null}
                </div>
              ) : null}
            </button>
          );
        }) : filteredPaymentSessions.length ? null : (
          <div className="pos-cart-empty">
            <strong>Không có đơn phù hợp.</strong>
            <span>Thử đổi trạng thái hoặc phạm vi ngày.</span>
          </div>
        )}
      </div>

      <OrderDetailModal
        order={selectedOrder}
        cancellingOrderId={cancellingOrderId}
        onClose={() => setSelectedOrderId("")}
        onCancelOrder={onCancelOrder}
      />
    </div>
  );
}
