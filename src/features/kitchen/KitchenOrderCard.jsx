import { useEffect, useMemo, useState } from "react";
import { getKitchenRecipeOptions, parseKitchenOptionLabel } from "./kitchenOptionDisplay.js";
import { getKitchenOrderTimeValue } from "./kitchenOrderGrouping.js";
import { getNextKitchenOrderAction } from "../../services/kitchenOrderService.js";
import { getKitchenOrderTheme, getKitchenPlatformTone } from "./kitchenPlatformTheme.js";

const UNIT_PROGRESS_STORAGE_KEY = "ghr:kitchen-unit-progress:v1";
const TOPPING_PROGRESS_STORAGE_KEY = "ghr:kitchen-topping-progress:v1";

function readProgress(storageKey) {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function saveProgress(storageKey, progress = {}) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // Local progress is a convenience only. Supabase remains the source of truth.
  }
}

function getItemQuantity(item = {}) {
  const quantity = Number(item.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
}

function getPaidToppings(item = {}) {
  return getKitchenRecipeOptions(item.options).filter((option) => option.group === "Ngon Hơn Khi Ăn Cùng" && option.value);
}

function formatTime(value = "") {
  if (!value) return "Chưa có giờ";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có giờ";

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatWaitingMinutes(order = {}) {
  const timeValue = getKitchenOrderTimeValue(order);
  if (!timeValue || !Number.isFinite(timeValue)) return "Chưa có giờ";
  const minutes = Math.max(0, Math.floor((Date.now() - timeValue) / 60000));
  return `Chờ ${minutes} phút`;
}

function getStatusTone(status = "") {
  if (["done", "ready"].includes(status)) {
    return { background: "#f1f5f9", border: "#cbd5e1", color: "#334155" };
  }

  if (status === "cancelled") {
    return { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" };
  }

  if (status === "preorder") {
    return { background: "#fff7ed", border: "#fdba74", color: "#c2410c" };
  }

  return { background: "#111827", border: "#111827", color: "#ffffff" };
}

function getActionButtonTone(actionType = "", fallbackColor = "#111827") {
  if (actionType === "handoff_shipper") {
    return {
      background: "#2563eb",
      border: "#2563eb",
      shadow: "rgba(37, 99, 235, 0.28)"
    };
  }

  if (actionType === "pickup_completed" || actionType === "delivery_completed") {
    return {
      background: "#16a34a",
      border: "#16a34a",
      shadow: "rgba(22, 163, 74, 0.28)"
    };
  }

  return {
    background: fallbackColor,
    border: fallbackColor,
    shadow: `${fallbackColor}33`
  };
}

function Badge({ children, tone }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        borderRadius: 999,
        padding: "5px 9px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}

function OptionChip({ children, optionLabel = "" }) {
  const parsedOption = optionLabel ? parseKitchenOptionLabel(optionLabel) : null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: parsedOption?.group ? "flex-start" : "center",
        flexDirection: parsedOption?.group ? "column" : "row",
        gap: parsedOption?.group ? 2 : 0,
        border: "1px solid #cbd5e1",
        background: "#f8fafc",
        color: "#475569",
        borderRadius: 999,
        padding: parsedOption?.group ? "5px 9px 6px" : "5px 8px",
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1.15
      }}
    >
      {parsedOption?.group ? (
        <>
          <span style={{ color: "#64748b", fontSize: 10, fontWeight: 750 }}>
            {parsedOption.group}
          </span>
          <strong style={{ color: "#111827", fontSize: 12, fontWeight: 950 }}>
            {parsedOption.value || children}
          </strong>
        </>
      ) : (
        children
      )}
    </span>
  );
}

function ProgressBoxes({ doneItems, totalItems, accent }) {
  const total = Math.max(0, Number(totalItems) || 0);
  const done = Math.min(total, Math.max(0, Number(doneItems) || 0));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {Array.from({ length: Math.min(total, 8) }).map((_, index) => {
        const filled = index < done;
        return (
          <span
            key={`progress-${index}`}
            style={{
              width: 13,
              height: 13,
              borderRadius: 4,
              border: filled ? `1px solid ${accent}` : "1px solid #cbd5e1",
              background: filled ? accent : "#ffffff"
            }}
          />
        );
      })}
    </div>
  );
}

function ToppingCheck({ checked, label, onClick }) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(event);
        }
      }}
      style={{
        border: checked ? "1px solid #f59e0b" : "1px solid #fcd34d",
        background: checked ? "#f59e0b" : "#fffbeb",
        color: checked ? "#ffffff" : "#92400e",
        borderRadius: 10,
        padding: "7px 9px",
        display: "grid",
        gridTemplateColumns: "16px minmax(0, 1fr)",
        gap: 7,
        alignItems: "center",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 900,
        lineHeight: 1.15
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: checked ? "1px solid #ffffff" : "1px solid #f59e0b",
          background: checked ? "#ffffff" : "#fff7ed",
          boxShadow: checked ? "inset 0 0 0 3px #f59e0b" : "none"
        }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", color: checked ? "#fffbeb" : "#b45309", fontSize: 10 }}>
          Thêm kèm
        </span>
        <strong style={{ display: "block", overflowWrap: "anywhere" }}>{label}</strong>
      </span>
    </span>
  );
}

export default function KitchenOrderCard({
  active = false,
  dimmed = false,
  highlightedDishKey = "",
  isItemHighlighted,
  onFocusOrder,
  onSelectOrder,
  order,
  onMarkDone,
  onToggleItemDone,
  updating = false,
  updatingItemKey = ""
}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const [unitProgress, setUnitProgress] = useState(() => readProgress(UNIT_PROGRESS_STORAGE_KEY));
  const [toppingProgress, setToppingProgress] = useState(() => readProgress(TOPPING_PROGRESS_STORAGE_KEY));
  const isCancelled = order.kitchenStatus === "cancelled";
  const isPreorder = order.kitchenStatus === "preorder";
  const nextOrderAction = getNextKitchenOrderAction(order);
  const canMarkDone = Boolean(nextOrderAction);
  const canToggleItems = Boolean(nextOrderAction?.requiresReady);
  const theme = getKitchenOrderTheme(order);
  const platformTone = getKitchenPlatformTone(order.platform || order.source || "");
  const isHighlighted = Boolean(highlightedDishKey);
  const displayItems = useMemo(() => {
    let itemNumber = 1;

    return items.flatMap((item, itemIndex) => {
      const quantity = getItemQuantity(item);
      return Array.from({ length: quantity }).map((_, unitIndex) => ({
        item,
        itemIndex,
        quantity,
        unitIndex,
        itemNumber: itemNumber++
      }));
    });
  }, [items]);
  const totalItems = displayItems.length;
  const doneItems = displayItems.filter(({ item, unitIndex }) => {
    if (item.status === "done") return true;
    const itemKey = `${order.sourceType}-${order.id}-${item.sourceItemId || item.id}`;
    return Boolean(unitProgress[`${itemKey}-${unitIndex}`]);
  }).length;
  const totalToppings = displayItems.reduce((total, { item }) => total + getPaidToppings(item).length, 0);
  const doneToppings = displayItems.reduce((total, { item, unitIndex }) => {
    const itemKey = `${order.sourceType}-${order.id}-${item.sourceItemId || item.id}`;
    return total + getPaidToppings(item).filter((option) => (
      Boolean(toppingProgress[`${itemKey}-${unitIndex}-${option.label}`])
    )).length;
  }, 0);
  const allItemsChecked = totalItems > 0 && doneItems === totalItems;
  const allToppingsChecked = totalToppings === 0 || doneToppings === totalToppings;
  const orderReadyToConfirm = allItemsChecked && allToppingsChecked;
  const actionButtonTone = getActionButtonTone(nextOrderAction?.type, theme.button);
  const isActionButtonEnabled = canMarkDone && (!nextOrderAction?.requiresReady || orderReadyToConfirm);
  const closedOrderLabel = isCancelled
    ? "Đơn đã hủy"
    : isPreorder
      ? "Đơn đặt trước"
      : "Đơn đã xong";

  useEffect(() => {
    setUnitProgress((currentProgress) => {
      let changed = false;
      const nextProgress = { ...currentProgress };

      items.forEach((item) => {
        const itemKey = `${order.sourceType}-${order.id}-${item.sourceItemId || item.id}`;
        const quantity = getItemQuantity(item);
        Array.from({ length: quantity }).forEach((_, unitIndex) => {
          const unitKey = `${itemKey}-${unitIndex}`;
          if (item.status === "done" && !nextProgress[unitKey]) {
            nextProgress[unitKey] = true;
            changed = true;
          }
        });
      });

      if (changed) saveProgress(UNIT_PROGRESS_STORAGE_KEY, nextProgress);
      return changed ? nextProgress : currentProgress;
    });
  }, [items, order.id, order.sourceType]);

  function handleToggleUnit(event, item, unitIndex) {
    event.stopPropagation();
    if (!canToggleItems) return;
    if (updatingItemKey) return;
    onFocusOrder?.(`${order.sourceType || "order"}-${order.id || ""}`);

    const itemKey = `${order.sourceType}-${order.id}-${item.sourceItemId || item.id}`;
    const quantity = getItemQuantity(item);
    const unitKey = `${itemKey}-${unitIndex}`;
    const sourceDone = item.status === "done";
    const nextProgress = { ...unitProgress, [unitKey]: sourceDone ? false : !unitProgress[unitKey] };

    if (sourceDone) {
      Array.from({ length: quantity }).forEach((_, index) => {
        const key = `${itemKey}-${index}`;
        if (index !== unitIndex) nextProgress[key] = true;
      });
    }

    setUnitProgress(nextProgress);
    saveProgress(UNIT_PROGRESS_STORAGE_KEY, nextProgress);

    const allUnitsDone = Array.from({ length: quantity }).every((_, index) => Boolean(nextProgress[`${itemKey}-${index}`]));
    if (allUnitsDone !== sourceDone) {
      onToggleItemDone?.(order, item);
    }
  }

  function handleToggleTopping(event, item, unitIndex, option) {
    event.stopPropagation();
    if (!canToggleItems) return;
    onFocusOrder?.(`${order.sourceType || "order"}-${order.id || ""}`);
    const itemKey = `${order.sourceType}-${order.id}-${item.sourceItemId || item.id}`;
    const toppingKey = `${itemKey}-${unitIndex}-${option.label}`;
    const nextProgress = {
      ...toppingProgress,
      [toppingKey]: !toppingProgress[toppingKey]
    };

    setToppingProgress(nextProgress);
    saveProgress(TOPPING_PROGRESS_STORAGE_KEY, nextProgress);
  }

  return (
    <article
      onClick={() => onSelectOrder?.(`${order.sourceType || "order"}-${order.id || ""}`)}
      style={{
        border: active
          ? `3px solid ${theme.border}`
          : isHighlighted
            ? "2px solid #8b5cf6"
            : `2px solid ${theme.border}`,
        background: isHighlighted ? "#f5f3ff" : theme.background,
        borderRadius: 16,
        padding: 12,
        display: "grid",
        gridTemplateRows: "auto auto minmax(96px, auto) auto",
        gap: 10,
        color: theme.text,
        cursor: "pointer",
        boxSizing: "border-box",
        maxWidth: "100%",
        overflow: "hidden",
        opacity: dimmed ? 0.62 : 1,
        filter: dimmed ? "saturate(0.75)" : "none",
        boxShadow: active || isHighlighted
          ? `0 14px 34px ${theme.border}33`
          : "0 8px 24px rgba(15, 23, 42, 0.06)"
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 1fr) minmax(230px, 0.9fr) auto",
          gap: 16,
          alignItems: "start"
        }}
      >
        <div style={{ minWidth: 0, display: "grid", gap: 9 }}>
          <h3
            style={{
              margin: 0,
              color: theme.code,
              fontSize: 24,
              lineHeight: 1.1,
              fontWeight: 950,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {order.orderCode || order.id || "Chưa có mã đơn"}
          </h3>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {active ? (
              <Badge tone={{ background: theme.border, border: theme.border, color: "#ffffff" }}>
                ĐANG CHỌN
              </Badge>
            ) : null}
            <Badge tone={{ background: platformTone.background, border: platformTone.border, color: platformTone.color }}>
              {order.platform || "Nguồn khác"}
            </Badge>
            <Badge tone={getStatusTone(order.kitchenStatus)}>{order.displayStatus}</Badge>
          </div>
          <strong
            style={{
              color: theme.code,
              fontSize: 20,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {order.displayOrderCode || order.orderCode || order.id}
          </strong>
          <span style={{ color: theme.text, fontSize: 14 }}>
            {formatTime(order.createdAt)}
          </span>
        </div>

        <div style={{ display: "grid", gap: 9, color: "#0f172a", fontWeight: 800 }}>
          <div>
            {order.customerName || "Khách"}
            {order.customerPhone ? ` - ${order.customerPhone}` : ""}
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <OptionChip>Đồng · 1 đơn</OptionChip>
            <OptionChip>Lần 1 tháng này</OptionChip>
            <OptionChip>Tháng này 1/3 đơn</OptionChip>
          </div>
          <strong style={{ color: "#059669" }}>{formatWaitingMinutes(order)}</strong>
        </div>

        <div style={{ textAlign: "right", display: "grid", gap: 6, justifyItems: "end" }}>
          <strong style={{ color: "#334155", fontSize: 22 }}>
            {doneItems}/{totalItems}
          </strong>
          <ProgressBoxes doneItems={doneItems} totalItems={totalItems} accent={theme.border} />
          {totalToppings ? (
            <>
              <span style={{ color: "#92400e", fontSize: 11, fontWeight: 900 }}>
                Topping {doneToppings}/{totalToppings}
              </span>
              <ProgressBoxes doneItems={doneToppings} totalItems={totalToppings} accent="#f59e0b" />
            </>
          ) : null}
          <span style={{ color: "#475569", fontSize: 12, fontWeight: 800 }}>
            {canMarkDone ? order.displayStatus : closedOrderLabel}
          </span>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(148, 163, 184, 0.35)" }} />

      {isCancelled || isPreorder ? (
        <div
          style={{
            border: `1px solid ${isCancelled ? "#fca5a5" : "#fdba74"}`,
            background: isCancelled ? "#fef2f2" : "#fff7ed",
            color: isCancelled ? "#991b1b" : "#9a3412",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 13,
            fontWeight: 900
          }}
        >
          {isCancelled
            ? "Đơn này đã bị hủy từ NexPOS, bếp không cần làm tiếp."
            : "Đơn đặt trước, chỉ hiện khi NexPOS chuyển sang đang làm."}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: displayItems.length <= 1 ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))",
          gridAutoRows: "auto",
          alignItems: "start",
          gap: 10,
          maxHeight: 420,
          overflowY: "auto",
          paddingRight: 4
        }}
      >
        {displayItems.length ? (
          displayItems.map(({ item, itemNumber, unitIndex }) => {
            const itemHighlighted = typeof isItemHighlighted === "function" && isItemHighlighted(item);
            const itemKey = `${order.sourceType}-${order.id}-${item.sourceItemId || item.id}`;
            const unitKey = `${itemKey}-${unitIndex}`;
            const itemDone = item.status === "done" || Boolean(unitProgress[unitKey]);
            const itemUpdating = updatingItemKey === itemKey;
            const paidToppings = getPaidToppings(item);

            return (
              <button
                key={`${item.id || itemKey}-unit-${unitIndex}`}
                type="button"
                disabled={!canToggleItems || Boolean(updatingItemKey)}
                onClick={(event) => handleToggleUnit(event, item, unitIndex)}
                style={{
                  minHeight: item.note || getPaidToppings(item).length ? 220 : 122,
                  height: "auto",
                  textAlign: "left",
                  border: itemHighlighted ? "2px solid #8b5cf6" : "1px solid #dbe3ef",
                  background: itemHighlighted ? "#faf5ff" : itemDone ? "#f0fdf4" : "rgba(255,255,255,0.88)",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "24px minmax(0, 1fr)",
                  gap: 10,
                  alignContent: "start",
                  alignItems: "start",
                  overflow: "visible",
                  cursor: !canToggleItems || updatingItemKey ? "not-allowed" : "pointer",
                  opacity: updatingItemKey && !itemUpdating ? 0.65 : 1
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 3,
                    border: itemDone ? "1px solid #16a34a" : "1px solid #94a3b8",
                    background: itemDone ? "#16a34a" : "#ffffff",
                    marginTop: 2,
                    boxShadow: itemDone ? "inset 0 0 0 3px #ffffff" : "none"
                  }}
                />
                <span style={{ minWidth: 0, display: "grid", gap: 7 }}>
                  <strong
                    style={{
                      color: itemDone ? "#64748b" : "#111827",
                      fontSize: 15,
                      lineHeight: 1.15,
                      overflowWrap: "anywhere",
                      textDecoration: itemDone ? "line-through" : "none"
                    }}
                  >
                    {item.name || "Không tên món"}
                  </strong>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <OptionChip>Món #{itemNumber}</OptionChip>
                    {item.options?.map((option) => (
                      <OptionChip key={`${itemKey}-${option}`} optionLabel={option}>
                        {option}
                      </OptionChip>
                    ))}
                  </span>
                  {item.note ? (
                    <span
                      style={{
                        border: "1px solid #fde68a",
                        background: "#fef3c7",
                        color: "#92400e",
                        borderRadius: 10,
                        padding: "8px 10px",
                        display: "grid",
                        gap: 3,
                        fontSize: 12,
                        lineHeight: 1.25
                      }}
                    >
                      <strong style={{ fontWeight: 950 }}>Ghi chú</strong>
                      <span>{item.note}</span>
                    </span>
                  ) : null}
                  {paidToppings.length ? (
                    <span style={{ display: "grid", gap: 6 }}>
                      {paidToppings.map((option) => {
                        const toppingKey = `${itemKey}-${unitIndex}-${option.label}`;
                        return (
                          <ToppingCheck
                            key={toppingKey}
                            checked={Boolean(toppingProgress[toppingKey])}
                            label={option.value}
                            onClick={(event) => handleToggleTopping(event, item, unitIndex, option)}
                          />
                        );
                      })}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
        ) : (
          <div
            style={{
              border: "1px dashed #cbd5e1",
              background: "#ffffff",
              borderRadius: 12,
              padding: 12,
              color: "#64748b"
            }}
          >
            Đơn này chưa có chi tiết món.
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 10,
          alignItems: "center"
        }}
      >
        <button
          type="button"
          disabled={!canMarkDone || updating || (nextOrderAction?.requiresReady && !orderReadyToConfirm)}
          onClick={(event) => {
            event.stopPropagation();
            onMarkDone?.(order);
          }}
          style={{
            border: isActionButtonEnabled ? `1px solid ${actionButtonTone.border}` : "1px solid #cbd5e1",
            background: isActionButtonEnabled ? actionButtonTone.background : "#e2e8f0",
            color: isActionButtonEnabled ? "#ffffff" : "#64748b",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13,
            fontWeight: 950,
            cursor: !canMarkDone || updating || (nextOrderAction?.requiresReady && !orderReadyToConfirm) ? "not-allowed" : "pointer",
            opacity: updating ? 0.7 : isActionButtonEnabled ? 1 : 0.82,
            boxShadow: isActionButtonEnabled ? `0 8px 18px ${actionButtonTone.shadow}` : "none"
          }}
        >
          {updating
            ? "Đang cập nhật..."
            : canMarkDone
              ? nextOrderAction?.requiresReady && !orderReadyToConfirm
                ? "Chưa đủ món"
                : nextOrderAction?.label || "Cập nhật đơn"
              : closedOrderLabel}
        </button>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          style={{
            border: "1px solid #dbe3ef",
            background: "#ffffff",
            color: "#111827",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13,
            fontWeight: 900,
            cursor: "default"
          }}
        >
          Reset
        </button>
      </div>
    </article>
  );
}
