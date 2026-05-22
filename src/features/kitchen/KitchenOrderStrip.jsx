import {
  getKitchenOrderKey,
  getKitchenOrderTimeValue,
  isKitchenOrderDone
} from "./kitchenOrderGrouping.js";
import { getKitchenPlatformTone } from "./kitchenPlatformTheme.js";

function formatWaitingMinutes(timeValue = 0) {
  if (!timeValue || !Number.isFinite(timeValue)) return "Chưa có giờ";
  const minutes = Math.max(0, Math.floor((Date.now() - timeValue) / 60000));
  return `Chờ ${minutes}'`;
}

function SmallBadge({ children, tone }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        background: tone?.background || "#f1f5f9",
        color: tone?.color || "#334155",
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 900,
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}

function OrderStripItem({ active, hasActiveOrder, order, onClick }) {
  const orderKey = getKitchenOrderKey(order);
  const done = isKitchenOrderDone(order);
  const status = String(order.kitchenStatus || "").toLowerCase();
  const statusLabel = status === "cancelled" ? "Đã hủy" : order.displayStatus || "Đã xong";
  const pendingItems = (order.items || []).filter((item) => item.status !== "done").length;
  const tone = getKitchenPlatformTone(order.platform);

  return (
    <button
      type="button"
      onClick={() => onClick?.(active ? "" : orderKey)}
      style={{
        flex: "0 0 138px",
        textAlign: "left",
        border: active ? `2px solid ${tone.color}` : `1px solid ${done ? "#cbd5e1" : tone.color}`,
        background: active ? tone.background : done ? "#f8fafc" : tone.soft,
        borderRadius: 8,
        padding: "8px 10px",
        display: "grid",
        gap: 6,
        cursor: "pointer",
        opacity: hasActiveOrder && !active ? 0.55 : done ? 0.9 : 1,
        filter: hasActiveOrder && !active ? "saturate(0.7)" : "none",
        minHeight: 62,
        scrollSnapAlign: "start",
        boxShadow: active ? `0 6px 16px ${tone.color}2e` : "none"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <strong
          style={{
            color: "#111827",
            fontSize: 13,
            lineHeight: 1.1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {order.displayOrderCode || order.orderCode || "Chưa có mã"}
        </strong>
        <SmallBadge tone={{ background: "#ffffff", color: tone.color }}>{order.platform || "Khác"}</SmallBadge>
      </div>
      <div style={{ display: "grid", gap: 2, color: "#334155", fontSize: 12, lineHeight: 1.2 }}>
        <span>{formatWaitingMinutes(getKitchenOrderTimeValue(order))}</span>
        <span>{done || pendingItems === 0 ? statusLabel : `${pendingItems} món chờ`}</span>
      </div>
    </button>
  );
}

export default function KitchenOrderStrip({
  activeOrderKey = "",
  orders = [],
  onSelectOrder
}) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        borderRadius: 8,
        padding: "8px 12px 7px",
        minWidth: 0,
        overflow: "hidden",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: 5,
          scrollSnapType: "x proximity"
        }}
      >
        {orders.length ? (
          orders.map((order) => {
            const orderKey = getKitchenOrderKey(order);
            return (
              <OrderStripItem
                key={orderKey}
                active={activeOrderKey === orderKey}
                hasActiveOrder={Boolean(activeOrderKey)}
                order={order}
                onClick={onSelectOrder}
              />
            );
          })
        ) : (
          <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, padding: 12, color: "#64748b" }}>
            Chưa có đơn phù hợp.
          </div>
        )}
      </div>
    </section>
  );
}
