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
        borderRadius: 6,
        background: "#ffffff",
        color: "#334155",
        padding: "3px 6px",
        fontSize: 10,
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
        minWidth: 0,
        maxWidth: 82,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        borderRadius: 6,
        padding: "3px 6px",
        fontSize: 10,
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
        borderRadius: 6,
        background: "#ffffff",
        color: "#334155",
        padding: parsedOption.group ? "4px 7px 5px" : "3px 6px",
        fontSize: 10,
        fontWeight: 800,
        lineHeight: 1.12,
        whiteSpace: "nowrap"
      }}
    >
      {parsedOption.group ? (
        <>
          <span style={{ color: "#64748b", fontSize: 9, fontWeight: 750 }}>
            {parsedOption.group}
          </span>
          <strong style={{ color: "#111827", fontSize: 11, fontWeight: 950 }}>
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
        borderRadius: 6,
        background: "#f97316",
        color: "#ffffff",
        padding: "3px 6px",
        fontSize: 10,
        fontWeight: 950,
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}

function InlineStat({ label, tone = "#111827", value }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 3,
        color: "#64748b",
        fontSize: 10,
        whiteSpace: "nowrap"
      }}
    >
      <strong style={{ color: tone, fontSize: 12, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </strong>
      {label}
    </span>
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
    activeNotes.length ? activeNotes : activeOrderKey ? [] : group.notes
  );
  const optionCounts = group.options.reduce((acc, option) => {
    acc[option] = (acc[option] || 0) + 1;
    return acc;
  }, {});
  const recipeOptions = Array.isArray(group.recipeOptions) ? group.recipeOptions : [];
  const relatedOrders = Array.isArray(group.orders) ? group.orders : [];
  const selectedOrderQuantity = hasSelectedOrder ? group.activeOrderPendingQuantity : group.totalQuantity;
  const otherOrdersQuantity = hasSelectedOrder ? group.otherOrdersPendingQuantity : group.pendingQuantity;
  return (
    <button
      type="button"
      onClick={() => onClick?.(group.key)}
      style={{
        width: "100%",
        textAlign: "left",
        border: hasActiveOrder ? "2px solid #8b5cf6" : "1px solid #dbe3ef",
        background: hasActiveOrder ? "#f5f3ff" : "#f8fafc",
        borderRadius: 10,
        padding: 8,
        display: "grid",
        gap: 5,
        cursor: "pointer",
        boxShadow: hasActiveOrder ? "0 6px 16px rgba(139, 92, 246, 0.11)" : "none"
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", color: "#111827", fontSize: 13, lineHeight: 1.18 }}>
            {group.name}
          </strong>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#111827", fontSize: 22, fontWeight: 950, lineHeight: 0.95, fontVariantNumeric: "tabular-nums" }}>
            {group.pendingQuantity}
          </div>
          <div style={{ color: "#64748b", fontSize: 10, lineHeight: 1.05 }}>
            cần
          </div>
        </div>
      </div>

      {recipeOptions.length ? (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {recipeOptions.map((option) => (
            <OptionBadge key={`${group.key}-${option.label}`} label={option.label} />
          ))}
        </div>
      ) : Object.keys(optionCounts).length ? (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {Object.entries(optionCounts)
            .sort((first, second) => second[1] - first[1])
            .slice(0, 6)
            .map(([option]) => (
              <OptionBadge key={`${group.key}-${option}`} label={option} />
            ))}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px 8px",
          flexWrap: "wrap",
          borderTop: "1px solid #e5e7eb",
          paddingTop: 5
        }}
      >
        <SmallBadge>Chờ {formatWaitingMinutes(group.oldestPendingTimeValue)}</SmallBadge>
        <InlineStat label={hasSelectedOrder ? "đơn này" : "tổng"} value={selectedOrderQuantity} />
        <InlineStat label={hasSelectedOrder ? "đơn khác" : "chờ"} tone="#d97706" value={otherOrdersQuantity} />
        <InlineStat
          label={hasSelectedOrder ? "Cần làm" : "Xong"}
          tone="#047857"
          value={hasSelectedOrder ? group.pendingQuantity : group.doneQuantity}
        />
      </div>

      {visibleNotes.length ? (
        <div
          style={{
            border: activeNotes.length ? "1px solid #f59e0b" : "1px solid #fde68a",
            background: activeNotes.length ? "#fef3c7" : "#fffbeb",
            color: "#92400e",
            borderRadius: 7,
            padding: 7,
            display: "grid",
            gap: 5,
            fontSize: 11,
            boxShadow: activeNotes.length ? "0 5px 12px rgba(245, 158, 11, 0.12)" : "none"
          }}
        >
          <strong style={{ color: "#92400e", fontSize: 10 }}>
            Ghi chú
          </strong>
          {visibleNotes.map((note) => (
            <div
              key={`${group.key}-${note.orderKey}-${note.itemIndex}-${note.text}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 5,
                flexWrap: "wrap",
                borderTop: "1px solid rgba(217, 119, 6, 0.18)",
                paddingTop: 5
              }}
            >
              <NoteBadge>{note.orderCode}</NoteBadge>
              <SmallBadge>
                {(note.itemIndexes || [note.itemIndex]).map((itemIndex) => `#${itemIndex}`).join(" · ")}
              </SmallBadge>
              <span style={{ color: "#78350f", fontWeight: 750, lineHeight: 1.35, flex: "1 1 100%" }}>
                {note.text}
              </span>
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
        <div style={{ color: hasActiveOrder ? "#4f46e5" : "#64748b", fontSize: 12, fontWeight: hasActiveOrder ? 800 : 600 }}>
          {hasActiveOrder ? "Đơn đang chọn" : ""}
        </div>
        {relatedOrders.length ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 5,
              flexWrap: "wrap",
              maxWidth: 220
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
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gridTemplateRows: "minmax(0, 1fr)",
          minHeight: 0,
          height: "100%"
        }}
      >
        <div style={{ display: "grid", gap: 7, overflow: "auto", minHeight: 0, paddingRight: 2 }}>
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
