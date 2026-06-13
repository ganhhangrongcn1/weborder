import { canCancelPosOrder } from "../../services/posService.js";
import { formatMoney, getOrderCode, getOrderStatusLabel, getOrderTotal, toText } from "./posHelpers.js";

export default function PosRecentOrdersPanel({ orders, loading, error, cancellingOrderId, onRefresh, onCancelOrder }) {
  return (
    <section className="pos-workspace-panel">
      <div className="pos-workspace-actions">
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Đang tải..." : "Tải lại"}
        </button>
      </div>
      {error ? <div className="pos-create-message is-error">{error}</div> : null}
      <div className="pos-recent-orders-list pos-recent-orders-list--embedded">
        {orders.length ? orders.map((order) => {
          const orderId = toText(order.id || order.orderCode);
          return (
            <article key={orderId} className="pos-recent-order-card">
              <div className="pos-recent-order-main">
                <div className="pos-recent-order-title-row">
                  <strong>{getOrderCode(order)}</strong>
                  <em className={`pos-order-status pos-order-status--${toText(order.status).toLowerCase()}`}>{getOrderStatusLabel(order.status)}</em>
                </div>
                <div className="pos-recent-order-meta">
                  <span>{order.pagerNumber ? `Thẻ ${order.pagerNumber}` : "Chưa có thẻ rung"}</span>
                  <span>{order.customerName || "Khách lẻ"}</span>
                  {order.customerPhone ? <span>{order.customerPhone}</span> : null}
                  <span>{formatMoney(getOrderTotal(order))}</span>
                </div>
                <div className="pos-recent-order-submeta">
                  <span>{new Date(order.createdAt || Date.now()).toLocaleString("vi-VN")}</span>
                  <span>{Array.isArray(order.items) ? order.items.length : 0} món</span>
                </div>
                <div className="pos-recent-order-detail">
                  {(Array.isArray(order.items) ? order.items : []).map((item, index) => (
                    <div key={`${orderId}-${index}`} className="pos-recent-order-item">
                      <strong>{item.name}</strong>
                      <span>x{item.quantity || 1}</span>
                      <em>{formatMoney(item.lineTotal || item.price)}</em>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pos-recent-order-actions">
                <button type="button" className="is-ghost" disabled={!canCancelPosOrder(order) || cancellingOrderId === orderId} onClick={() => onCancelOrder(order)}>
                  {cancellingOrderId === orderId ? "Đang hủy..." : "Hủy đơn"}
                </button>
              </div>
            </article>
          );
        }) : (
          <div className="pos-cart-empty">
            <strong>Chưa có đơn gần đây.</strong>
          </div>
        )}
      </div>
    </section>
  );
}

