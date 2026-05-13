import { formatMoney } from "../../../utils/format.js";

export default function AdminOrderDetailModal({ order, onClose }) {
  const items = order.items || [];
  const subtotalValue = Number(order.subtotal ?? items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
  const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0);
  const totalValue = Number(order.totalAmount || order.total || 0);
  const isPickupOrder = String(order.fulfillmentType || "").toLowerCase() === "pickup";

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <section className="admin-product-modal" onClick={(event) => event.stopPropagation()}>
        <div className="admin-product-modal-head">
          <div>
            <h2>Chi tiết đơn {order.orderCode || order.id}</h2>
            <p>{order.customerName || "Khách"} • {order.customerPhone || order.phone || "--"}</p>
          </div>
          <button onClick={onClose}>X</button>
        </div>

        <div className="admin-product-form">
          <label>
            Tổng tiền
            <input value={formatMoney(totalValue)} readOnly />
          </label>
          <label>
            Thời gian
            <input value={order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "--"} readOnly />
          </label>
          <label className="wide">
            Địa chỉ
            <input value={order.deliveryAddress || order.branchAddress || "--"} readOnly />
          </label>

          <div className="admin-option-section">
            <div className="admin-option-head">
              <h3>Món trong đơn</h3>
            </div>
            {items.map((item, index) => (
              <div key={`${item.id || item.name}-${index}`} className="admin-option-group">
                <div className="admin-option-group-row">
                  <strong>{item.name}</strong>
                  <span>x{item.quantity || 1}</span>
                  <span>{formatMoney(Number(item.lineTotal || 0))}</span>
                </div>
                {(item.toppings || []).length > 0 && (
                  <div className="admin-option-item-row">
                    <small>
                      {(item.toppings || [])
                        .map((topping) => `${topping.name}${topping.quantity ? ` x${topping.quantity}` : ""}`)
                        .join(", ")}
                    </small>
                  </div>
                )}
              </div>
            ))}
            <div className="admin-option-group">
              <div className="admin-option-group-row">
                <strong>Tạm tính món</strong>
                <span>{formatMoney(subtotalValue)}</span>
              </div>
              <div className="admin-option-group-row">
                <strong>Phí giao hàng</strong>
                <span>{isPickupOrder ? "0đ (Tự đến lấy)" : formatMoney(shippingFee)}</span>
              </div>
              <div className="admin-option-group-row">
                <strong>Thành tiền</strong>
                <span>{formatMoney(totalValue)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-modal-actions">
          <span />
          <button className="admin-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </section>
    </div>
  );
}
