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

const RANGE_FILTERS = [
  { id: "shift", label: "Ca này" },
  { id: "today", label: "Hôm nay" },
  { id: "all", label: "Tất cả ngày" }
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
  if (method === "bank_qr") return "Chuyển khoản";
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

function formatDiscount(value = 0) {
  const amount = Number(value || 0);
  if (!amount) return "0đ";
  return `-${formatMoney(Math.abs(amount))}`;
}

function getLoyaltyUsageSummary(order = {}) {
  const metadata = getObject(order.metadata);
  const pointsDiscountAmount = Number(
    order.pointsDiscountAmount ||
    order.pointsDiscount ||
    metadata.pointsDiscountAmount ||
    metadata.pointsDiscount ||
    0
  );
  const promoSource = toText(order.promoSource || metadata.promoSource).toLowerCase();
  const promoVoucherId = toText(order.promoVoucherId || metadata.promoVoucherId);
  const promoCode = toText(order.promoCode || metadata.promoCode);
  const labels = [];

  if (pointsDiscountAmount > 0) {
    labels.push(`Dùng ${formatMoney(pointsDiscountAmount)} điểm`);
  }

  if (promoSource === "loyalty" && (promoVoucherId || promoCode)) {
    labels.push("Voucher loyalty");
  }

  return labels;
}

function getRangeMatched(value, rangeFilter, activeShiftId) {
  if (rangeFilter === "all") return true;
  if (rangeFilter === "today") return isToday(value);
  if (rangeFilter === "shift") return Boolean(activeShiftId);
  return true;
}

function OrderDetailModal({
  order,
  cancellingOrderId,
  reprintingOrderId,
  onClose,
  onCancelOrder,
  onReprintOrder
}) {
  if (!order) return null;

  const orderId = toText(order.id || order.orderCode);
  const metadata = getObject(order.metadata);
  const items = Array.isArray(order.items) ? order.items : [];
  const allowCancel = canCancelPosOrder(order);
  const cashierName = toText(metadata.cashierName || metadata.shift?.cashierName);
  const orderNote = toText(order.note || order.orderNote || metadata.orderNote || metadata.note);
  const promoDiscount = Number(order.promoDiscount || metadata.promoDiscount || 0);
  const pointsDiscountAmount = Number(
    order.pointsDiscountAmount ||
    order.pointsDiscount ||
    metadata.pointsDiscountAmount ||
    metadata.pointsDiscount ||
    0
  );
  const paymentReference = toText(order.paymentReference || metadata.paymentReference || metadata.payment_reference);
  const paidAt = toText(order.paidAt || metadata.paidAt || metadata.paid_at);
  const loyaltyLabels = getLoyaltyUsageSummary(order);

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

        <div className="pos-order-detail-finance">
          <div><span>Tạm tính</span><strong>{formatMoney(order.subtotal || 0)}</strong></div>
          <div><span>Voucher</span><strong>{formatDiscount(promoDiscount)}</strong></div>
          <div><span>Dùng điểm</span><strong>{formatDiscount(pointsDiscountAmount)}</strong></div>
          <div><span>Nội dung CK</span><strong>{paymentReference || "--"}</strong></div>
          <div><span>Đã thu lúc</span><strong>{paidAt ? formatOrderTime(paidAt) : "--"}</strong></div>
          <div><span>Ghi chú đơn</span><strong>{orderNote || "--"}</strong></div>
        </div>

        {loyaltyLabels.length ? (
          <div className="pos-order-detail-tags">
            {loyaltyLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        ) : null}

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

        <div className="pos-order-detail-actions">
          <button
            type="button"
            className="pos-order-detail-reprint"
            disabled={reprintingOrderId === orderId}
            onClick={() => onReprintOrder?.(order)}
          >
            {reprintingOrderId === orderId ? "Đang gửi in..." : "In lại bill"}
          </button>

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
        </div>
      </section>
    </div>
  );
}

export default function PosRecentOrdersPanel({
  orders,
  paymentSessions = [],
  offlineOrders = [],
  loading,
  paymentSessionsLoading = false,
  offlineOrdersSyncing = false,
  error,
  paymentSessionsError = "",
  actionMessage = "",
  actionMessageType = "",
  cancellingOrderId,
  reprintingOrderId = "",
  activePaymentSessionId = "",
  activeShiftId = "",
  cancellingPaymentSessionId = "",
  onRefresh,
  onCancelOrder,
  onReprintOrder,
  onOpenPaymentSession,
  onCancelPaymentSession,
  onSyncOfflineOrders
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("shift");
  const [selectedOrderId, setSelectedOrderId] = useState("");

  const filteredOrders = useMemo(() => (Array.isArray(orders) ? orders : []).filter((order) => {
    if (rangeFilter === "today" && !isToday(order.createdAt)) return false;
    if (rangeFilter === "shift" && activeShiftId && toText(order.posShiftId) !== toText(activeShiftId)) return false;
    return statusFilter === "all" || getOrderStatusGroup(order) === statusFilter;
  }), [activeShiftId, orders, rangeFilter, statusFilter]);

  const filteredPaymentSessions = useMemo(
    () => (Array.isArray(paymentSessions) ? paymentSessions : []).filter((session) => {
      if (rangeFilter === "today" && !isToday(session.createdAt)) return false;
      if (rangeFilter === "shift" && activeShiftId && toText(session.posShiftId) !== toText(activeShiftId)) return false;
      const status = toText(session.status).toLowerCase();
      const group = ["draft", "pending_payment"].includes(status)
        ? "pending_payment"
        : "processing";
      return statusFilter === "all" || statusFilter === group;
    }),
    [activeShiftId, paymentSessions, rangeFilter, statusFilter]
  );

  const pendingPaymentCount = useMemo(
    () => (Array.isArray(paymentSessions) ? paymentSessions : []).filter((session) => (
      ["draft", "pending_payment"].includes(toText(session.status).toLowerCase())
    )).length,
    [paymentSessions]
  );
  const pendingOfflineOrders = useMemo(
    () => (Array.isArray(offlineOrders) ? offlineOrders : []).filter((order) => toText(order.id || order.orderCode)),
    [offlineOrders]
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
          <select value={rangeFilter} onChange={(event) => setRangeFilter(event.target.value)} aria-label="Lọc phạm vi">
            {RANGE_FILTERS.map((filter) => (
              <option key={filter.id} value={filter.id}>{filter.label}</option>
            ))}
          </select>
          <button type="button" onClick={onRefresh} disabled={loading || paymentSessionsLoading}>
            {loading || paymentSessionsLoading ? "Đang tải..." : "Tải lại"}
          </button>
        </div>
      </div>

      {actionMessage ? <div className={`pos-create-message ${actionMessageType === "success" ? "is-success" : "is-error"}`}>{actionMessage}</div> : null}
      {error ? <div className="pos-create-message is-error">{error}</div> : null}
      {paymentSessionsError ? <div className="pos-create-message is-error">{paymentSessionsError}</div> : null}

      {pendingOfflineOrders.length ? (
        <section className="pos-offline-sync-panel">
          <header>
            <div>
              <span>Đơn chờ đồng bộ</span>
              <strong>{pendingOfflineOrders.length} đơn đang lưu trên máy</strong>
            </div>
            <button type="button" disabled={offlineOrdersSyncing || typeof onSyncOfflineOrders !== "function"} onClick={onSyncOfflineOrders}>
              {offlineOrdersSyncing ? "Đang đồng bộ..." : "Đồng bộ lại"}
            </button>
          </header>
          <div className="pos-offline-sync-list">
            {pendingOfflineOrders.slice(0, 4).map((order) => {
              const metadata = getObject(order.metadata);
              const orderId = toText(order.id || order.orderCode);
              const syncError = toText(order.syncError || metadata.syncError);
              const attempts = Number(order.syncAttemptCount || metadata.syncAttemptCount || 0);
              return (
                <article key={orderId}>
                  <div>
                    <strong>{getOrderCode(order)}</strong>
                    <span>{formatOrderTime(order.createdAt)} · {formatMoney(getOrderTotal(order))}</span>
                  </div>
                  <em>{attempts > 0 ? `${attempts} lần thử` : "Chưa thử lại"}</em>
                  {syncError ? <small>{syncError}</small> : null}
                </article>
              );
            })}
          </div>
          {pendingOfflineOrders.length > 4 ? <p>+{pendingOfflineOrders.length - 4} đơn khác đang chờ đồng bộ.</p> : null}
        </section>
      ) : null}

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
          const loyaltyLabels = getLoyaltyUsageSummary(order);
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
              {loyaltyLabels.length ? (
                <div className="pos-recent-order-tags">
                  {loyaltyLabels.map((label) => (
                    <span key={`${orderId}-${label}`}>{label}</span>
                  ))}
                </div>
              ) : null}
            </button>
          );
        }) : filteredPaymentSessions.length ? null : (
          <div className="pos-cart-empty">
            <strong>Không có đơn phù hợp.</strong>
            <span>Thử đổi trạng thái hoặc phạm vi lọc.</span>
          </div>
        )}
      </div>

      <OrderDetailModal
        order={selectedOrder}
        cancellingOrderId={cancellingOrderId}
        reprintingOrderId={reprintingOrderId}
        onClose={() => setSelectedOrderId("")}
        onCancelOrder={onCancelOrder}
        onReprintOrder={onReprintOrder}
      />
    </div>
  );
}
