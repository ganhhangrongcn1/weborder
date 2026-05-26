import { groupKitchenItemsFromOrders } from "./kitchenOrderGrouping.js";
import { parseKitchenOptionLabel } from "./kitchenOptionDisplay.js";
import { getKitchenPlatformTone } from "./kitchenPlatformTheme.js";

function formatWaitingMinutes(timeValue = 0) {
  if (!timeValue || !Number.isFinite(timeValue)) return "Chưa có giờ";
  const minutes = Math.max(0, Math.floor((Date.now() - timeValue) / 60000));
  return `${minutes} phút`;
}

function SmallBadge({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: "1px solid #cbd5e1",
        borderRadius: 999,
        background: "#ffffff",
        color: "#334155",
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}

function OrderCodeBadge({ order }) {
  const tone = getKitchenPlatformTone(order.platform);

  return (
    <span
      title={order.code}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 58,
        maxWidth: 82,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        borderRadius: 7,
        padding: "4px 7px",
        fontSize: 11,
        fontWeight: 950,
        lineHeight: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }}
    >
      {order.code}
    </span>
  );
}

function OptionBadge({ label }) {
  const parsedOption = parseKitchenOptionLabel(label);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: parsedOption.group ? "flex-start" : "center",
        flexDirection: parsedOption.group ? "column" : "row",
        gap: parsedOption.group ? 2 : 0,
        border: "1px solid #cbd5e1",
        borderRadius: 999,
        background: "#ffffff",
        color: "#334155",
        padding: parsedOption.group ? "5px 9px 6px" : "4px 8px",
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1.12,
        whiteSpace: "nowrap"
      }}
    >
      {parsedOption.group ? (
        <>
          <span style={{ color: "#64748b", fontSize: 10, fontWeight: 750 }}>
            {parsedOption.group}
          </span>
          <strong style={{ color: "#111827", fontSize: 12, fontWeight: 950 }}>
            {parsedOption.value || label}
          </strong>
        </>
      ) : (
        label
      )}
    </span>
  );
}

function NoteBadge({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        background: "#f97316",
        color: "#ffffff",
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 950,
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}

function StatBox({ label, tone = "#111827", value }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 10,
        padding: "10px 8px",
        textAlign: "center",
        minWidth: 0
      }}
    >
      <strong style={{ display: "block", color: tone, fontSize: 14, lineHeight: 1 }}>
        {value}
      </strong>
      <span style={{ display: "block", marginTop: 4, color: "#64748b", fontSize: 11 }}>
        {label}
      </span>
    </div>
  );
}

function normalizeNoteKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

function mergeVisibleNotes(notes = []) {
  const map = new Map();

  notes.forEach((note) => {
    const key = `${note.orderKey || ""}-${normalizeNoteKey(note.text)}`;
    const current = map.get(key);

    if (!current) {
      map.set(key, {
        ...note,
        itemIndexes: note.itemIndexes?.length ? note.itemIndexes : [note.itemIndex]
      });
      return;
    }

    current.itemIndexes = [
      ...new Set([
        ...current.itemIndexes,
        ...(note.itemIndexes?.length ? note.itemIndexes : [note.itemIndex])
      ])
    ].sort((first, second) => first - second);
  });

  return Array.from(map.values());
}

function DishGroupButton({ active, activeOrderKey, group, onClick }) {
  const hasSelectedOrder = Boolean(activeOrderKey);
  const hasActiveOrder = Boolean(activeOrderKey && group.orders.some((order) => order.key === activeOrderKey));
  const activeNotes = activeOrderKey
    ? group.notes.filter((note) => note.orderKey === activeOrderKey)
    : [];
  const visibleNotes = mergeVisibleNotes(
    activeNotes.length ? activeNotes : activeOrderKey ? [] : group.notes.slice(0, 2)
  );
  const optionCounts = group.options.reduce((acc, option) => {
    acc[option] = (acc[option] || 0) + 1;
    return acc;
  }, {});
  const recipeOptions = Array.isArray(group.recipeOptions) ? group.recipeOptions : [];
  const relatedOrders = Array.isArray(group.orders) ? group.orders : [];
  const selectedOrderQuantity = hasSelectedOrder ? group.activeOrderPendingQuantity : group.totalQuantity;
  const otherOrdersQuantity = hasSelectedOrder ? group.otherOrdersPendingQuantity : group.pendingQuantity;
  const helperText = hasSelectedOrder
    ? hasActiveOrder
      ? `Đơn đang chọn có ${group.activeOrderPendingQuantity} phần món này.`
      : "Món này không thuộc đơn đang chọn."
    : "Hiển thị tổng số phần của món này trong bếp.";

  return (
    <button
      type="button"
      onClick={() => onClick?.(group.key)}
      style={{
        width: "100%",
        textAlign: "left",
        border: active ? "2px solid #111827" : hasActiveOrder ? "2px solid #8b5cf6" : "1px solid #dbe3ef",
        background: active ? "#eef2ff" : hasActiveOrder ? "#f5f3ff" : "#f8fafc",
        borderRadius: 14,
        padding: 12,
        display: "grid",
        gap: 10,
        cursor: "pointer",
        boxShadow: active ? "0 10px 24px rgba(15, 23, 42, 0.10)" : hasActiveOrder ? "0 10px 24px rgba(139, 92, 246, 0.12)" : "none"
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 58px", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", color: "#000000", fontSize: 17, lineHeight: 1.2 }}>
            {group.name}
          </strong>
          <span
            style={{
              display: "inline-flex",
              marginTop: 7,
              background: "#e8eef6",
              color: "#0f172a",
              borderRadius: 999,
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: 900
            }}
          >
            Chờ lâu nhất: {formatWaitingMinutes(group.oldestPendingTimeValue)}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#000000", fontSize: 31, fontWeight: 950, lineHeight: 0.95 }}>
            {group.pendingQuantity}
          </div>
          <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.05 }}>
            cần làm
          </div>
        </div>
      </div>

      {recipeOptions.length ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {recipeOptions.map((option) => (
            <OptionBadge key={`${group.key}-${option.label}`} label={option.label} />
          ))}
        </div>
      ) : Object.keys(optionCounts).length ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(optionCounts)
            .sort((first, second) => second[1] - first[1])
            .slice(0, 6)
            .map(([option]) => (
              <OptionBadge key={`${group.key}-${option}`} label={option} />
            ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        <StatBox label={hasSelectedOrder ? "Trong đơn này" : "Tổng SL"} value={selectedOrderQuantity} />
        <StatBox label={hasSelectedOrder ? "Đơn khác" : "Chưa xong"} tone="#d97706" value={otherOrdersQuantity} />
        <StatBox
          label={hasSelectedOrder ? "Tổng cần làm" : "Đã xong"}
          tone="#047857"
          value={hasSelectedOrder ? group.pendingQuantity : group.doneQuantity}
        />
      </div>

      <div
        style={{
          color: hasActiveOrder ? "#4f46e5" : "#64748b",
          fontSize: 12,
          fontWeight: hasActiveOrder ? 800 : 600
        }}
      >
        {helperText}
      </div>

      {visibleNotes.length ? (
        <div
          style={{
            border: activeNotes.length ? "1px solid #f59e0b" : "1px solid #fde68a",
            background: activeNotes.length ? "#fef3c7" : "#fffbeb",
            color: "#92400e",
            borderRadius: 10,
            padding: activeNotes.length ? 10 : 8,
            display: "grid",
            gap: 7,
            fontSize: 12,
            opacity: activeNotes.length ? 1 : 0.42,
            filter: activeNotes.length ? "none" : "saturate(0.65)",
            boxShadow: activeNotes.length ? "0 8px 18px rgba(245, 158, 11, 0.18)" : "none"
          }}
        >
          <strong style={{ color: "#92400e", fontSize: 12 }}>
            {activeNotes.length ? "Ghi chú liên quan" : "Có ghi chú"}
          </strong>
          {visibleNotes.map((note) => (
            <div
              key={`${group.key}-${note.orderKey}-${note.itemIndex}-${note.text}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                border: activeNotes.length ? "1px solid #f59e0b" : "0",
                background: activeNotes.length ? "#fde68a" : "transparent",
                borderRadius: 8,
                padding: activeNotes.length ? "7px 8px" : 0
              }}
            >
              <NoteBadge>{note.orderCode}</NoteBadge>
              <SmallBadge>
                {(note.itemIndexes || [note.itemIndex]).map((itemIndex) => `#${itemIndex}`).join(" · ")}
              </SmallBadge>
              <span style={{ color: "#92400e", fontWeight: 700 }}>{note.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 8,
          alignItems: "end"
        }}
      >
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {active ? "Đang highlight các đơn chứa món này" : "Bấm để highlight các đơn chứa món này"}
        </div>
        {relatedOrders.length ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 5,
              flexWrap: "wrap",
              maxWidth: 250
            }}
          >
            {relatedOrders.slice(0, 8).map((order) => (
              <OrderCodeBadge key={`${group.key}-${order.key}-${order.itemIndex}`} order={order} />
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export default function KitchenDishSummaryPanel({
  activeDishKey = "",
  activeOrderKey = "",
  orders = [],
  onSelectDish
}) {
  const groups = groupKitchenItemsFromOrders(orders, activeOrderKey);

  return (
    <aside
      style={{
        display: "grid",
        alignContent: "start",
        position: "sticky",
        top: 8,
        height: "100%",
        minHeight: 0,
        overflow: "hidden"
      }}
    >
      <section
        style={{
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: 18,
          padding: 14,
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
          gap: 12,
          minHeight: 0,
          height: "100%"
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: "#000000", fontSize: 23, lineHeight: 1.15 }}>
            Tổng hợp món đang làm
          </h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
            Gom món giống nhau để bếp dễ làm theo lô.
          </p>
        </div>
        <div style={{ display: "grid", gap: 10, overflow: "auto", minHeight: 0, paddingRight: 4 }}>
          {groups.length ? (
            groups.map((group) => (
              <DishGroupButton
                key={group.key}
                active={activeDishKey === group.key}
                activeOrderKey={activeOrderKey}
                group={group}
                onClick={onSelectDish}
              />
            ))
          ) : (
            <div style={{ border: "1px dashed #cbd5e1", borderRadius: 12, padding: 14, color: "#64748b" }}>
              Chưa có món nào cần làm.
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
