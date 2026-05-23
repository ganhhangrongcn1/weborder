import { useEffect, useMemo, useState } from "react";
import { getKitchenRecipeOptions, parseKitchenOptionLabel } from "./kitchenOptionDisplay.js";
import {
  getKitchenOrderDoneTimeValue,
  getKitchenOrderTimeValue,
  isKitchenOrderDone
} from "./kitchenOrderGrouping.js";
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
    // Local progress is a convenience only for this kitchen screen.
  }
}

function getItemQuantity(item = {}) {
  const quantity = Number(item.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
}

function getPaidToppings(item = {}) {
  return getKitchenRecipeOptions(item.options).filter((option) => option.group === "Ngon Hơn Khi Ăn Cùng" && option.value);
}

function normalizeKitchenOptionText(value = "") {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/Ä‘/g, "d")
    .replace(/\s+/g, " ");
}

function buildPaidToppingOptionKeys(paidToppings = []) {
  return new Set(
    (paidToppings || [])
      .flatMap((option) => [
        option.label,
        option.value,
        option.group && option.value ? `${option.group}: ${option.value}` : ""
      ])
      .map(normalizeKitchenOptionText)
      .filter(Boolean)
  );
}

function isPaidToppingDisplayOption(option = "", paidToppingKeys = new Set()) {
  const parsed = parseKitchenOptionLabel(option);
  if (normalizeKitchenOptionText(parsed.group) === "ngon hon khi an cung") return true;
  return paidToppingKeys.has(normalizeKitchenOptionText(option));
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

function formatDoneTime(order = {}) {
  const timeValue = getKitchenOrderDoneTimeValue(order);
  if (!timeValue || !Number.isFinite(timeValue)) return "Đã xong";

  const date = new Date(timeValue);
  if (Number.isNaN(date.getTime())) return "Đã xong";

  return `Xong lúc ${date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function formatOrderTiming(order = {}) {
  const status = String(order?.kitchenStatus || order?.status || "").toLowerCase();
  if (status === "cancelled") return "Đã hủy";
  return isKitchenOrderDone(order) ? formatDoneTime(order) : formatWaitingMinutes(order);
}

function formatClaimedGiftTime(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}

function getMonthlyGiftBadgeText(gift = null, monthlyOrderCount = 0) {
  const threshold = Number(gift?.threshold || 3);
  const count = Number(monthlyOrderCount || 0);

  if (gift?.claimed) return "Quà tháng: đã tặng";
  if (count >= threshold) return "Quà tháng: đủ điều kiện";

  const missing = Math.max(0, threshold - count);
  return `Quà tháng: còn ${missing} đơn`;
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

function getMemberTierTone(memberTier = "") {
  const value = String(memberTier || "").toLowerCase();

  if (value.includes("kim")) return { background: "#f0fdff", border: "#a5f3fc", color: "#0e7490" };
  if (value.includes("vàng") || value.includes("vang")) return { background: "#fffaf0", border: "#fde68a", color: "#b45309" };
  if (value.includes("bạc") || value.includes("bac")) return { background: "#f8fafc", border: "#e2e8f0", color: "#475569" };

  return { background: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
}

function getMonthlyCountTone(count = 0) {
  const safeCount = Number(count || 0);
  if (safeCount >= 3) return { background: "#f0fdf4", border: "#bbf7d0", color: "#15803d" };
  if (safeCount === 2) return { background: "#fffbeb", border: "#fde68a", color: "#b45309" };
  return { background: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
}

function getGiftBadgeTone(gift = null, monthlyOrderCount = 0) {
  if (gift?.claimed) return { background: "#f0fdf4", border: "#bbf7d0", color: "#15803d" };
  if (Number(monthlyOrderCount || 0) >= Number(gift?.threshold || 3)) {
    return { background: "#fffbeb", border: "#fde68a", color: "#b45309" };
  }

  return { background: "#f5f3ff", border: "#ddd6fe", color: "#6d28d9" };
}

function KitchenIcon({ name, size = 14 }) {
  const paths = {
    badge: (
      <>
        <path d="M4 5.5 12 2l8 3.5v6.25c0 4.5-3.1 8.2-8 10.25-4.9-2.05-8-5.75-8-10.25V5.5Z" />
        <path d="M9 12.2 11.1 14.3 15.4 10" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v5l3.25 2" />
      </>
    ),
    gift: (
      <>
        <path d="M4 10h16v10H4V10Z" />
        <path d="M4 10h16M12 10v10M7.5 6.5c0-1.1.9-2 2-2 2.5 0 2.5 3.5 2.5 5.5-2 0-4.5-1-4.5-3.5ZM16.5 6.5c0-1.1-.9-2-2-2-2.5 0-2.5 3.5-2.5 5.5 2 0 4.5-1 4.5-3.5Z" />
      </>
    ),
    order: (
      <>
        <path d="M7 3.5h10l2 2V20l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L7 20V3.5Z" />
        <path d="M10 8h4.5M10 12h5.5M10 16h3.5" />
      </>
    ),
    phone: (
      <>
        <path d="M8.2 4.2 10 8 8.6 9.4c1 2.1 2.9 4 5 5L15 13l3.8 1.8c.45.2.7.7.55 1.2-.55 1.95-2.35 3.2-4.35 2.85C10.1 18 6 13.9 5.15 9 4.8 7 6.05 5.2 8 4.65c.5-.15 1 .1 1.2.55Z" />
      </>
    ),
    repeat: (
      <>
        <path d="M17 2.5 20.5 6 17 9.5" />
        <path d="M3.5 10V8a2 2 0 0 1 2-2h15" />
        <path d="M7 21.5 3.5 18 7 14.5" />
        <path d="M20.5 14v2a2 2 0 0 1-2 2h-15" />
      </>
    ),
    shop: (
      <>
        <path d="M4 10h16l-1.5-5h-13L4 10Z" />
        <path d="M6 10v9h12v-9" />
        <path d="M9 19v-5h6v5" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3l1.5 5L18 10l-4.5 2L12 17l-1.5-5L6 10l4.5-2L12 3Z" />
        <path d="M19.5 15.5 21 17l-1.5 1.5L18 17l1.5-1.5ZM4.5 15.5 6 17l-1.5 1.5L3 17l1.5-1.5Z" />
      </>
    ),
    timer: (
      <>
        <path d="M9 2.5h6" />
        <path d="M12 7v5l3 1.8" />
        <circle cx="12" cy="13" r="7.5" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H5.5A2.5 2.5 0 0 0 8 10M16 6h2.5A2.5 2.5 0 0 1 16 10M12 12.5V17M9 20h6M10 17h4" />
      </>
    )
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "0 0 auto", opacity: 0.78 }}
    >
      {paths[name] || paths.badge}
    </svg>
  );
}

function Badge({ children, tone, icon = "" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        borderRadius: 999,
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 760,
        lineHeight: 1.1,
        whiteSpace: "nowrap"
      }}
    >
      {icon ? <KitchenIcon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

function InfoLine({ children, color = "#475569", icon, strong = false }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        color,
        fontSize: strong ? 14 : 13,
        fontWeight: strong ? 780 : 680,
        lineHeight: 1.25
      }}
    >
      <KitchenIcon name={icon} size={strong ? 14 : 13} />
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {children}
      </span>
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
        fontWeight: 700,
        lineHeight: 1.15
      }}
    >
      {parsedOption?.group ? (
        <>
          <span style={{ color: "#64748b", fontSize: 10, fontWeight: 650 }}>
            {parsedOption.group}
          </span>
          <strong style={{ color: "#111827", fontSize: 12, fontWeight: 780 }}>
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

function MonthlyGiftCard({ claiming = false, gift, onClaim }) {
  if (!gift?.eligible) return null;

  const claimed = Boolean(gift.claimed);
  const claimedTime = formatClaimedGiftTime(gift.claimedAt);

  return (
    <div
      style={{
        border: claimed ? "1px solid #86efac" : "1px solid #fbbf24",
        background: claimed ? "#f0fdf4" : "#fffbeb",
        color: claimed ? "#166534" : "#92400e",
        borderRadius: 10,
        padding: "6px 10px",
        display: "inline-grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 8,
        alignItems: "center",
        width: "fit-content",
        maxWidth: "100%",
        justifySelf: "start"
      }}
    >
      <div style={{ minWidth: 0, display: "grid", gap: 1 }}>
        <strong style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.2 }}>
          {claimed ? "Đã tặng quà tháng này" : "Đủ điều kiện tặng quà"}
        </strong>
        <span style={{ fontSize: 11, fontWeight: 800, color: claimed ? "#15803d" : "#a16207", lineHeight: 1.2 }}>
          Tháng này: {gift.monthlyOrderCount || 0} đơn
          {claimed && gift.claimedOrderCode ? ` · Đơn xác nhận ${gift.claimedOrderCode}` : ""}
          {claimedTime ? ` · ${claimedTime}` : ""}
        </span>
      </div>

      {!claimed ? (
        <button
          type="button"
          disabled={claiming}
          onClick={(event) => {
            event.stopPropagation();
            onClaim?.();
          }}
          style={{
            border: "1px solid #f59e0b",
            background: "#f59e0b",
            color: "#ffffff",
            borderRadius: 8,
            padding: "6px 9px",
            fontSize: 11,
            fontWeight: 900,
            cursor: claiming ? "not-allowed" : "pointer",
            opacity: claiming ? 0.72 : 1,
            whiteSpace: "nowrap"
          }}
        >
          {claiming ? "Đang lưu..." : "Đã tặng quà"}
        </button>
      ) : null}
    </div>
  );
}

export default function KitchenOrderCard({
  compact = false,
  active = false,
  dimmed = false,
  highlightedDishKey = "",
  isItemHighlighted,
  onFocusOrder,
  onSelectOrder,
  order,
  onMarkDone,
  onPrintBill,
  onClaimGift,
  onToggleItemDone,
  claimingGift = false,
  updating = false,
  printingBill = false,
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
  const monthlyGift = order.monthlyGift || null;
  const monthlyOrderCount = Number(monthlyGift?.monthlyOrderCount || 0);
  const totalOrderCount = Number(monthlyGift?.totalOrderCount || monthlyOrderCount || 0);
  const monthlyGiftBadgeText = getMonthlyGiftBadgeText(monthlyGift, monthlyOrderCount);
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

  function handleResetProgress(event) {
    event.stopPropagation();
    onFocusOrder?.(`${order.sourceType || "order"}-${order.id || ""}`);

    const itemKeys = items.map((item) => `${order.sourceType}-${order.id}-${item.sourceItemId || item.id}`);

    setUnitProgress((currentProgress) => {
      const nextProgress = { ...currentProgress };
      let changed = false;

      itemKeys.forEach((itemKey) => {
        Object.keys(nextProgress).forEach((key) => {
          if (key.startsWith(`${itemKey}-`)) {
            delete nextProgress[key];
            changed = true;
          }
        });
      });

      if (changed) saveProgress(UNIT_PROGRESS_STORAGE_KEY, nextProgress);
      return changed ? nextProgress : currentProgress;
    });

    setToppingProgress((currentProgress) => {
      const nextProgress = { ...currentProgress };
      let changed = false;

      itemKeys.forEach((itemKey) => {
        Object.keys(nextProgress).forEach((key) => {
          if (key.startsWith(`${itemKey}-`)) {
            delete nextProgress[key];
            changed = true;
          }
        });
      });

      if (changed) saveProgress(TOPPING_PROGRESS_STORAGE_KEY, nextProgress);
      return changed ? nextProgress : currentProgress;
    });

    items.forEach((item) => {
      if (item.status === "done") {
        onToggleItemDone?.(order, item);
      }
    });
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
          gridTemplateColumns: compact ? "1fr" : "minmax(260px, 1fr) minmax(230px, 0.9fr) auto",
          gap: compact ? 10 : 16,
          alignItems: "start"
        }}
      >
        <div style={{ minWidth: 0, display: "grid", gap: 9 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "18px minmax(0, 1fr)",
              gap: 6,
              alignItems: "center",
              color: theme.code,
              minWidth: 0
            }}
          >
            <KitchenIcon name="order" size={16} />
            <h3
              style={{
                margin: 0,
                color: "inherit",
                fontSize: compact ? 19 : 22,
                lineHeight: 1.1,
                fontWeight: 840,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {order.orderCode || order.id || "Chưa có mã đơn"}
            </h3>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {active ? (
              <Badge tone={{ background: theme.border, border: theme.border, color: "#ffffff" }} icon="badge">
                ĐANG CHỌN
              </Badge>
            ) : null}
            <Badge tone={{ background: platformTone.background, border: platformTone.border, color: platformTone.color }} icon="shop">
              {order.platform || "Nguồn khác"}
            </Badge>
            <Badge tone={getStatusTone(order.kitchenStatus)} icon={isKitchenOrderDone(order) ? "badge" : "spark"}>
              {order.displayStatus}
            </Badge>
          </div>
          <strong
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: theme.code,
              fontSize: compact ? 16 : 18,
              fontWeight: 760,
              lineHeight: 1.15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            <KitchenIcon name="shop" size={15} />
            {order.displayOrderCode || order.orderCode || order.id}
          </strong>
          <InfoLine icon="clock" color={theme.text}>
            {formatTime(order.createdAt)}
          </InfoLine>
        </div>

        <div style={{ display: "grid", gap: compact ? 7 : 9, color: "#0f172a", fontWeight: 680 }}>
          <InfoLine icon="phone" color="#0f172a" strong>
            {order.customerName || "Khách"}
            {order.customerPhone ? ` - ${order.customerPhone}` : ""}
          </InfoLine>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <Badge tone={getMemberTierTone(monthlyGift?.memberTier || "Đồng")} icon="trophy">
              {monthlyGift?.memberTier || "Đồng"} · {totalOrderCount} đơn
            </Badge>
            <Badge tone={getMonthlyCountTone(monthlyOrderCount)} icon="repeat">
              Lần {monthlyOrderCount || 1} tháng này
            </Badge>
            <Badge tone={getGiftBadgeTone(monthlyGift, monthlyOrderCount)} icon="gift">
              {monthlyGiftBadgeText}
            </Badge>
          </div>
          <InfoLine icon="timer" color={isKitchenOrderDone(order) ? "#334155" : "#059669"} strong>
            {formatOrderTiming(order)}
          </InfoLine>
        </div>

        <div style={{ textAlign: compact ? "left" : "right", display: "grid", gap: 6, justifyItems: compact ? "start" : "end" }}>
          <strong style={{ color: "#334155", fontSize: compact ? 18 : 21, fontWeight: 780 }}>
            {doneItems}/{totalItems}
          </strong>
          <ProgressBoxes doneItems={doneItems} totalItems={totalItems} accent={theme.border} />
          {totalToppings ? (
            <>
              <span style={{ color: "#92400e", fontSize: 11, fontWeight: 760 }}>
                Topping {doneToppings}/{totalToppings}
              </span>
              <ProgressBoxes doneItems={doneToppings} totalItems={totalToppings} accent="#f59e0b" />
            </>
          ) : null}
          <span style={{ color: "#475569", fontSize: 12, fontWeight: 680 }}>
            {canMarkDone ? order.displayStatus : closedOrderLabel}
          </span>
          <MonthlyGiftCard
            claiming={claimingGift}
            gift={monthlyGift}
            onClaim={() => onClaimGift?.(order)}
          />
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
          gridTemplateColumns: compact ? "1fr" : (displayItems.length <= 1 ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))"),
          gridAutoRows: "auto",
          alignItems: "start",
          gap: 10,
          maxHeight: compact ? "none" : 420,
          overflowY: compact ? "visible" : "auto",
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
            const paidToppingKeys = buildPaidToppingOptionKeys(paidToppings);
            const displayOptions = (item.options || []).filter((option) => !isPaidToppingDisplayOption(option, paidToppingKeys));

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
                      fontWeight: 760,
                      overflowWrap: "anywhere",
                      textDecoration: itemDone ? "line-through" : "none"
                    }}
                  >
                    {item.name || "Không tên món"}
                  </strong>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <OptionChip>Món #{itemNumber}</OptionChip>
                    {displayOptions.map((option) => (
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
          gridTemplateColumns: compact ? "1fr" : "minmax(0, 1fr) auto auto",
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
          disabled={printingBill}
          onClick={(event) => {
            event.stopPropagation();
            onPrintBill?.(order);
          }}
          style={{
            border: "1px solid #0f766e",
            background: printingBill ? "#99f6e4" : "#14b8a6",
            color: "#ffffff",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13,
            fontWeight: 900,
            cursor: printingBill ? "not-allowed" : "pointer",
            opacity: printingBill ? 0.76 : 1
          }}
        >
          {printingBill ? "Đang in..." : "In bill"}
        </button>
        <button
          type="button"
          onClick={handleResetProgress}
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
