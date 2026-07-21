import { useEffect, useMemo, useState } from "react";
import {
  getKitchenRecipeOptions,
  isKitchenPaidToppingGroup,
  isKitchenPaidToppingOption,
  isKitchenRecipeOnlyGroup,
  isKitchenRecipeOnlyOption,
  normalizeKitchenOptionText,
  parseKitchenOptionLabel
} from "./kitchenOptionDisplay.js";
import {
  getKitchenOrderDoneTimeValue,
  getKitchenOrderTimeValue,
  isKitchenOrderDone
} from "./kitchenOrderGrouping.js";
import { getNextKitchenOrderAction } from "../../services/kitchenOrderService.js";
import { getKitchenOrderTheme, getKitchenPlatformTone } from "./kitchenPlatformTheme.js";
import {
  formatPickupCountdown,
  getScheduledPickupTone,
  parsePickupTimeText
} from "../../utils/dateTimeDefaults.js";

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

function isRecipeOnlyKitchenOption(option = {}) {
  return (
    isKitchenRecipeOnlyOption(option.group) ||
    isKitchenRecipeOnlyOption(option.value) ||
    isKitchenRecipeOnlyOption(option.label)
  );
}

function getRecipeOnlyDisplayLabel(option = {}) {
  const value = String(option.value || "").trim();
  const label = String(option.label || "").trim();
  const parsed = parseKitchenOptionLabel(label);

  if (isKitchenRecipeOnlyGroup(option.group) && value) return label || `${option.group}: ${value}`;
  if (isKitchenRecipeOnlyOption(label)) return parsed.group && parsed.value ? `${parsed.group}: ${parsed.value}` : label;
  if (isKitchenRecipeOnlyOption(value)) return value;
  return "";
}

function isRecipeOnlyGroupHeader(label = "") {
  return isKitchenRecipeOnlyGroup(label);
}

function compactKitchenDisplayOptions(options = []) {
  const uniqueOptions = (Array.isArray(options) ? options : [])
    .filter(Boolean)
    .filter((option, index, list) => list.indexOf(option) === index);

  return uniqueOptions.filter((option) => {
    if (!isRecipeOnlyGroupHeader(option)) return true;

    const headerKey = normalizeKitchenOptionText(option);
    return !uniqueOptions.some((candidate) => {
      const candidateKey = normalizeKitchenOptionText(candidate);
      return candidateKey !== headerKey && candidateKey.startsWith(`${headerKey} `);
    });
  });
}

function getPaidToppings(item = {}) {
  const fromOptions = getKitchenRecipeOptions(item.options)
    .filter(isKitchenPaidToppingOption);

  const fromToppings = (Array.isArray(item.toppings) ? item.toppings : [])
    .map((topping) => {
      const group = String(topping?.groupName || topping?.group || topping?.group_name || "").trim();
      const value = String(topping?.name || topping?.label || topping?.value || "").trim();
      const label = group ? `${group}: ${value}` : value;
      if (!isKitchenPaidToppingGroup(group) || !value || isRecipeOnlyKitchenOption({ group, value, label })) return null;

      return {
        group: group || "Ngon Hơn Khi Ăn Cùng",
        value,
        label
      };
    })
    .filter(Boolean);

  const seen = new Set();
  return [...fromOptions, ...fromToppings].filter((option) => {
    const key = normalizeKitchenOptionText(`${option.group}:${option.value}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function getKitchenItemProgressKey(order = {}, item = {}) {
  return `${order.sourceType}-${order.id}-${item.sourceItemId || item.id}`;
}

function getKitchenItemRequestKey(order = {}, item = {}) {
  return `${String(order?.id || "").trim()}:${String(item?.sourceItemId || item?.id || "").trim()}`;
}

function getUnitProgressState(progress = {}, itemKey = "", unitIndex = 0, sourceDone = false) {
  const unitKey = `${itemKey}-${unitIndex}`;
  if (sourceDone) {
    if (Object.prototype.hasOwnProperty.call(progress, unitKey)) {
      return progress[unitKey] !== false;
    }
    return true;
  }

  return Boolean(progress[unitKey]);
}

function getToppingProgressState(progress = {}, itemKey = "", unitIndex = 0, option = {}) {
  return Boolean(progress[`${itemKey}-${unitIndex}-${option.label}`]);
}

function areUnitToppingsDone(progress = {}, itemKey = "", unitIndex = 0, paidToppings = []) {
  return (Array.isArray(paidToppings) ? paidToppings : []).every((option) => (
    getToppingProgressState(progress, itemKey, unitIndex, option)
  ));
}

function isPaidToppingDisplayOption(option = "", paidToppingKeys = new Set()) {
  const parsed = parseKitchenOptionLabel(option);
  if (isKitchenPaidToppingGroup(parsed.group)) return true;
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

function formatKitchenMoney(value = 0) {
  const amount = Number(value || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(safeAmount);
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
  if (actionType === "partner_cancelled") {
    return {
      background: "#dc2626",
      border: "#dc2626",
      shadow: "rgba(220, 38, 38, 0.28)"
    };
  }

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

function getPrintButtonConfig(printBillState = {}, printingBill = false) {
  const status = String(printBillState?.status || "").toLowerCase();
  const rawErrorMessage = String(
    printBillState?.error_message ||
      printBillState?.errorMessage ||
      printBillState?.job?.error_message ||
      printBillState?.job?.errorMessage ||
      ""
  ).trim();
  const errorMessage = rawErrorMessage.toLowerCase();

  if (printingBill || status === "submitting") {
    return {
      label: "Đang gửi...",
      disabled: true,
      background: "#99f6e4",
      border: "#0f766e",
      color: "#0f766e",
      opacity: 0.78
    };
  }

  if (status === "pending") {
    return {
      label: "Đã gửi · Chờ POS",
      disabled: true,
      background: "#e0f2fe",
      border: "#0284c7",
      color: "#075985",
      opacity: 0.92
    };
  }

  if (status === "printing") {
    return {
      label: "Đang in...",
      disabled: true,
      background: "#ccfbf1",
      border: "#0f766e",
      color: "#0f766e",
      opacity: 0.9
    };
  }

  if (status === "printed") {
    return {
      label: "In lại",
      disabled: false,
      background: "#dcfce7",
      border: "#16a34a",
      color: "#166534",
      opacity: 1
    };
  }

  if (status === "failed") {
    const isAutoExpired = errorMessage.includes("quá 5 phút") || errorMessage.includes("qua 5 phut");
    return {
      label: isAutoExpired ? "Quá 5 phút - In lại" : "In lỗi - In lại",
      disabled: false,
      title: rawErrorMessage || "Lệnh in bị lỗi. Bấm để gửi lại lệnh in.",
      background: "#fff7ed",
      border: "#f97316",
      color: "#c2410c",
      opacity: 1
    };
  }

  return {
    label: "In bill",
    disabled: false,
    background: "#14b8a6",
    border: "#0f766e",
    color: "#ffffff",
    opacity: 1
  };
}

function isExternallyCancelled(order = {}) {
  const values = [
    order.kitchenStatus,
    order.nexposState,
    order.nexposStatus,
    order.status,
    order.raw?.nexpos_status,
    order.raw?.status
  ];

  return values.some((value) => {
    const status = String(value || "").trim().toLowerCase();
    return ["cancel", "canceled", "cancelled", "huy", "da huy", "dahuy"].includes(status);
  });
}

function isCancellationAcknowledged(order = {}) {
  return [
    order.kitchenStatus,
    order.kitchenWorkStatus,
    order.raw?.kitchen_work_status,
    order.raw?.kitchen_status
  ].some((value) => String(value || "").trim().toLowerCase() === "cancelled");
}

function normalizeKitchenSourceToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getKitchenCollectAmount(order = {}) {
  const sourceType = normalizeKitchenSourceToken(order.sourceType || order.source_type);
  if (sourceType !== "website") return 0;

  const source = normalizeKitchenSourceToken(order.source || order.orderSource || order.channel);
  const fulfillmentType = normalizeKitchenSourceToken(order.fulfillmentType || order.raw?.fulfillment_type);
  const shouldCollect = ["website", "weborder", "online", "pickup", "qr_counter"].includes(source) || fulfillmentType === "pickup";

  if (!shouldCollect) return 0;

  const totalAmount = Number(order.totalAmount ?? order.total ?? order.raw?.total_amount ?? 0);
  const shippingFee = Number(order.shippingFee ?? order.raw?.shipping_fee ?? 0);
  const amount = totalAmount - shippingFee;

  return Number.isFinite(amount) ? Math.max(amount, 0) : 0;
}

function isKitchenOrderPaid(order = {}) {
  const metadata = order.raw?.metadata && typeof order.raw.metadata === "object" ? order.raw.metadata : {};
  const nestedMetadata = metadata.metadata && typeof metadata.metadata === "object" ? metadata.metadata : {};
  const paymentStatus = String(
    order.paymentStatus ||
      metadata.paymentStatus ||
      metadata.payment_status ||
      nestedMetadata.paymentStatus ||
      nestedMetadata.payment_status ||
      ""
  ).trim().toLowerCase();
  const paidAt = String(
    order.paidAt ||
      metadata.paidAt ||
      metadata.paid_at ||
      nestedMetadata.paidAt ||
      nestedMetadata.paid_at ||
      ""
  ).trim();

  return paymentStatus === "paid" || Boolean(paidAt);
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
    cash: (
      <>
        <path d="M4 7h16v10H4V7Z" />
        <path d="M7 10.5h.01M17 13.5h.01" />
        <circle cx="12" cy="12" r="2.25" />
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

function Badge({ children, tone, icon = "", compact = false }) {
  const isCompact = compact || ["trophy", "repeat", "gift"].includes(icon);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isCompact ? 3 : 5,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        borderRadius: 999,
        padding: isCompact ? "3px 7px" : "4px 8px",
        fontSize: isCompact ? 10 : 11,
        fontWeight: isCompact ? 720 : 760,
        lineHeight: 1.1,
        whiteSpace: "nowrap"
      }}
    >
      {icon ? <KitchenIcon name={icon} size={isCompact ? 10 : 12} /> : null}
      {children}
    </span>
  );
}

function InfoLine({ children, color = "#475569", icon, strong = false, wrap = false }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: wrap ? "flex-start" : "center",
        gap: 6,
        minWidth: 0,
        color,
        fontSize: strong ? 14 : 13,
        fontWeight: strong ? 780 : 680,
        lineHeight: 1.25
      }}
    >
      <KitchenIcon name={icon} size={strong ? 14 : 13} />
      <span
        style={{
          minWidth: 0,
          overflow: wrap ? "visible" : "hidden",
          overflowWrap: wrap ? "anywhere" : "normal",
          textOverflow: wrap ? "clip" : "ellipsis",
          whiteSpace: wrap ? "normal" : "nowrap"
        }}
      >
        {children}
      </span>
    </span>
  );
}

function formatDeliveryTime(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getKitchenShortOrderCode(order = {}) {
  const display = String(order.displayOrderCode || "").trim();
  if (display) return display;

  const fullCode = String(order.orderCode || order.id || "").trim();
  const digits = fullCode.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  if (fullCode.length >= 4) return fullCode.slice(-4);
  return fullCode || "----";
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
        borderRadius: 8,
        padding: "6px 8px",
        display: "grid",
        gridTemplateColumns: "15px minmax(0, 1fr)",
        gap: 6,
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
      <strong style={{ display: "block", minWidth: 0, overflowWrap: "anywhere" }}>{label}</strong>
    </span>
  );
}

export default function KitchenOrderCard({
  compact = false,
  tabletCompact = false,
  active = false,
  dimmed = false,
  highlightedDishKey = "",
  isItemHighlighted,
  onFocusOrder,
  onSelectOrder,
  order,
  onMarkDone,
  onPrintBill,
  onToggleItemDone,
  updating = false,
  printingBill = false,
  printBillState = {},
  updatingItemKey = ""
}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const [unitProgress, setUnitProgress] = useState(() => readProgress(UNIT_PROGRESS_STORAGE_KEY));
  const [toppingProgress, setToppingProgress] = useState(() => readProgress(TOPPING_PROGRESS_STORAGE_KEY));
  const [driverDetailsOpen, setDriverDetailsOpen] = useState(false);
  const [pickupCountdownTick, setPickupCountdownTick] = useState(() => Date.now());
  const isCancelled = isExternallyCancelled(order);
  const isCancelledAcknowledged = isCancellationAcknowledged(order);
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
    const itemKey = getKitchenItemProgressKey(order, item);
    const sourceDone = item.status === "done";
    const paidToppings = getPaidToppings(item);
    const unitChecked = getUnitProgressState(unitProgress, itemKey, unitIndex, sourceDone);
    return sourceDone || (unitChecked && areUnitToppingsDone(toppingProgress, itemKey, unitIndex, paidToppings));
  }).length;
  const totalToppings = displayItems.reduce((total, { item }) => total + getPaidToppings(item).length, 0);
  const doneToppings = displayItems.reduce((total, { item, unitIndex }) => {
    const itemKey = getKitchenItemProgressKey(order, item);
    return total + getPaidToppings(item).filter((option) => (
      getToppingProgressState(toppingProgress, itemKey, unitIndex, option)
    )).length;
  }, 0);
  const allItemsChecked = totalItems > 0 && doneItems === totalItems;
  const allToppingsChecked = totalToppings === 0 || doneToppings === totalToppings;
  const orderReadyToConfirm = allItemsChecked && allToppingsChecked;
  const actionButtonTone = getActionButtonTone(nextOrderAction?.type, theme.button);
  const isActionButtonEnabled = canMarkDone && (!nextOrderAction?.requiresReady || orderReadyToConfirm);
  const printButtonConfig = isCancelled || isPreorder
    ? {
        label: isCancelled ? "Không in đơn hủy" : "Chưa in đơn đặt trước",
        disabled: true,
        background: isCancelled ? "#fee2e2" : "#ffedd5",
        border: isCancelled ? "#fca5a5" : "#fdba74",
        color: isCancelled ? "#991b1b" : "#9a3412",
        opacity: 0.9
      }
    : getPrintButtonConfig(printBillState, printingBill);
  const driverName = String(order.driverName || order.rawData?.driver_name || order.raw?.raw_data?.driver_name || "").trim();
  const driverPhone = String(order.driverPhone || order.rawData?.driver_phone || order.raw?.raw_data?.driver_phone || "").trim();
  const deliveryTime = formatDeliveryTime(order.deliveryTime || order.rawData?.delivery_time || order.raw?.raw_data?.delivery_time);
  const hasDriverDetails = Boolean(driverName || driverPhone || deliveryTime);
  const closedOrderLabel = isCancelled
    ? "Đơn đã hủy"
    : isPreorder
      ? "Đơn đặt trước"
      : "Đơn đã xong";
  const statusBadgeTone = isCancelled ? getStatusTone("cancelled") : getStatusTone(order.kitchenStatus);
  const statusBadgeText = isCancelled ? "Đã hủy từ NexPOS" : order.displayStatus;
  const collectAmount = getKitchenCollectAmount(order);
  const isPaid = isKitchenOrderPaid(order);
  const shouldShowCollectBadge = collectAmount > 0 && !isPaid;
  const pickupSchedule = parsePickupTimeText(
    order.pickupTimeText ||
      order.raw?.pickup_time_text ||
      order.raw?.metadata?.pickupTimeText ||
      order.raw?.metadata?.pickup_time_text
  );
  const isScheduledPickupOrder = String(order.fulfillmentType || "").toLowerCase() === "pickup" && pickupSchedule.scheduled;
  const scheduledPickupTone = getScheduledPickupTone(pickupSchedule.text, new Date(pickupCountdownTick));
  const scheduledPickupCountdown = formatPickupCountdown(pickupSchedule.text, new Date(pickupCountdownTick));
  const scheduledPickupTheme = scheduledPickupTone === "due"
    ? { background: "#fef2f2", border: "#fca5a5", color: "#b91c1c", card: "#fff7f7" }
    : scheduledPickupTone === "soon"
      ? { background: "#fff7ed", border: "#fdba74", color: "#c2410c", card: "#fffaf4" }
      : { background: "#fefce8", border: "#fde047", color: "#a16207", card: "#fffef2" };
  const pagerNumber = String(
    order.pagerNumber ||
    order.raw?.pager_number ||
    order.raw?.metadata?.pagerNumber ||
    order.raw?.metadata?.pager_number ||
    order.raw?.metadata?.metadata?.pagerNumber ||
    order.raw?.metadata?.metadata?.pager_number ||
    ""
  ).trim();
  const shortOrderCode = getKitchenShortOrderCode(order);
  const fullOrderCode = String(order.displayOrderCode || order.orderCode || order.id || "").trim();

  const isNarrowLayout = compact || tabletCompact;
  const itemGridColumns = compact
    ? "1fr"
    : displayItems.length <= 1
      ? "1fr"
      : "repeat(2, minmax(0, 1fr))";

  useEffect(() => {
    setUnitProgress((currentProgress) => {
      let changed = false;
      const nextProgress = { ...currentProgress };

      items.forEach((item) => {
        const itemKey = getKitchenItemProgressKey(order, item);
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

  useEffect(() => {
    setToppingProgress((currentProgress) => {
      let changed = false;
      const nextProgress = { ...currentProgress };

      items.forEach((item) => {
        if (item.status !== "done") return;
        const itemKey = getKitchenItemProgressKey(order, item);
        const quantity = getItemQuantity(item);
        const paidToppings = getPaidToppings(item);

        Array.from({ length: quantity }).forEach((_, unitIndex) => {
          paidToppings.forEach((option) => {
            const toppingKey = `${itemKey}-${unitIndex}-${option.label}`;
            if (!nextProgress[toppingKey]) {
              nextProgress[toppingKey] = true;
              changed = true;
            }
          });
        });
      });

      if (changed) saveProgress(TOPPING_PROGRESS_STORAGE_KEY, nextProgress);
      return changed ? nextProgress : currentProgress;
    });
  }, [items, order.id, order.sourceType]);

  useEffect(() => {
    if (!isScheduledPickupOrder) return undefined;
    const timer = window.setInterval(() => {
      setPickupCountdownTick(Date.now());
    }, 60000);
    return () => window.clearInterval(timer);
  }, [isScheduledPickupOrder]);

  function syncItemDoneState(item, nextUnitProgress = unitProgress, nextToppingProgress = toppingProgress) {
    const itemKey = getKitchenItemProgressKey(order, item);
    const sourceDone = item.status === "done";
    const quantity = getItemQuantity(item);
    const paidToppings = getPaidToppings(item);
    const allUnitsDone = Array.from({ length: quantity }).every((_, index) => (
      getUnitProgressState(nextUnitProgress, itemKey, index, sourceDone)
    ));
    const allToppingsDone = Array.from({ length: quantity }).every((_, index) => (
      areUnitToppingsDone(nextToppingProgress, itemKey, index, paidToppings)
    ));
    const fullyDone = allUnitsDone && allToppingsDone;

    if (fullyDone !== sourceDone) {
      onToggleItemDone?.(order, item);
    }
  }

  function handleToggleUnit(event, item, unitIndex) {
    event.stopPropagation();
    if (!canToggleItems) return;
    if (updatingItemKey === getKitchenItemRequestKey(order, item)) return;
    onFocusOrder?.(`${order.sourceType || "order"}-${order.id || ""}`);

    const itemKey = getKitchenItemProgressKey(order, item);
    const unitKey = `${itemKey}-${unitIndex}`;
    const sourceDone = item.status === "done";
    const currentChecked = getUnitProgressState(unitProgress, itemKey, unitIndex, sourceDone);
    const nextProgress = { ...unitProgress, [unitKey]: !currentChecked };

    setUnitProgress(nextProgress);
    saveProgress(UNIT_PROGRESS_STORAGE_KEY, nextProgress);
    syncItemDoneState(item, nextProgress, toppingProgress);
  }

  function handleToggleTopping(event, item, unitIndex, option) {
    event.stopPropagation();
    if (!canToggleItems) return;
    if (updatingItemKey === getKitchenItemRequestKey(order, item)) return;
    onFocusOrder?.(`${order.sourceType || "order"}-${order.id || ""}`);
    const itemKey = getKitchenItemProgressKey(order, item);
    const toppingKey = `${itemKey}-${unitIndex}-${option.label}`;
    const nextProgress = {
      ...toppingProgress,
      [toppingKey]: !toppingProgress[toppingKey]
    };

    setToppingProgress(nextProgress);
    saveProgress(TOPPING_PROGRESS_STORAGE_KEY, nextProgress);
    syncItemDoneState(item, unitProgress, nextProgress);
  }

  function handleResetProgress(event) {
    event.stopPropagation();
    onFocusOrder?.(`${order.sourceType || "order"}-${order.id || ""}`);

    const itemKeys = items.map((item) => getKitchenItemProgressKey(order, item));

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
        background: isHighlighted
          ? "#f5f3ff"
          : isScheduledPickupOrder && !isCancelled && !isKitchenOrderDone(order)
            ? scheduledPickupTheme.card
            : theme.background,
        borderRadius: tabletCompact ? 12 : 16,
        padding: tabletCompact ? 8 : 12,
        display: "grid",
        gap: tabletCompact ? 7 : 10,
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
          gridTemplateColumns: compact
            ? "1fr"
            : tabletCompact
              ? "minmax(210px, 0.85fr) minmax(270px, 1.15fr) auto"
              : "minmax(260px, 1fr) minmax(230px, 0.9fr) auto",
          gap: tabletCompact ? 8 : isNarrowLayout ? 10 : 16,
          alignItems: "start"
        }}
      >
        <div style={{ minWidth: 0, display: "grid", gap: tabletCompact ? 5 : 9 }}>
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
                fontSize: tabletCompact ? 18 : isNarrowLayout ? 20 : 22,
                lineHeight: 1.1,
                fontWeight: 840,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              #{shortOrderCode}
            </h3>
          </div>
          <div style={{ display: "flex", gap: tabletCompact ? 4 : 7, flexWrap: "wrap" }}>
            {active ? (
              <Badge tone={{ background: theme.border, border: theme.border, color: "#ffffff" }} icon="badge">
                Đang chọn
              </Badge>
            ) : null}
            <Badge tone={{ background: platformTone.background, border: platformTone.border, color: platformTone.color }} icon="shop">
              {order.platform || "Nguồn khác"}
            </Badge>
            {pagerNumber ? (
              <Badge tone={{ background: "#ecfdf5", border: "#86efac", color: "#166534" }} icon="badge">
                Thẻ rung {pagerNumber}
              </Badge>
            ) : null}
            <Badge tone={statusBadgeTone} icon={isCancelled || isKitchenOrderDone(order) ? "badge" : "spark"}>
              {statusBadgeText}
            </Badge>
            {isPaid ? (
              <Badge tone={{ background: "#dcfce7", border: "#86efac", color: "#166534" }} icon="cash">
                Đã trả
              </Badge>
            ) : null}
            {shouldShowCollectBadge ? (
              <Badge tone={{ background: "#fefce8", border: "#fde047", color: "#a16207" }} icon="cash">
                Thu {formatKitchenMoney(collectAmount)}
              </Badge>
            ) : null}
            {isScheduledPickupOrder ? (
              <Badge tone={scheduledPickupTheme} icon="timer">
                Lấy {pickupSchedule.clock}
              </Badge>
            ) : null}
          </div>
          {pagerNumber || (fullOrderCode && fullOrderCode !== shortOrderCode) ? (
            <strong
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: theme.code,
                fontSize: isNarrowLayout ? 14 : 15,
                fontWeight: 760,
                lineHeight: 1.15,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              <KitchenIcon name="badge" size={14} />
              {pagerNumber ? `Thẻ rung ${pagerNumber}` : fullOrderCode}
            </strong>
          ) : null}
          <InfoLine icon="clock" color={theme.text}>
            {formatTime(order.createdAt)}
          </InfoLine>
        </div>

        <div style={{ display: "grid", gap: tabletCompact ? 4 : isNarrowLayout ? 6 : 9, color: "#0f172a", fontWeight: 680, minWidth: 0 }}>
          <InfoLine icon="phone" color="#0f172a" strong wrap={isNarrowLayout}>
            {order.customerName || "Khách"}
            {order.customerPhone ? ` - ${order.customerPhone}` : ""}
          </InfoLine>
          {hasDriverDetails ? (
            <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDriverDetailsOpen((current) => !current);
                }}
                style={{
                  border: "1px solid #bae6fd",
                  background: "#f0f9ff",
                  color: "#0369a1",
                  borderRadius: 999,
                  padding: "4px 9px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 850,
                  cursor: "pointer"
                }}
              >
                <KitchenIcon name="phone" size={11} />
                Tài xế
                <span aria-hidden="true">{driverDetailsOpen ? "▲" : "▼"}</span>
              </button>
              {driverDetailsOpen ? (
                <div
                  style={{
                    border: "1px solid #bae6fd",
                    background: "#f0f9ff",
                    color: "#0c4a6e",
                    borderRadius: 10,
                    padding: "8px 10px",
                    display: "grid",
                    gap: 3,
                    fontSize: 12,
                    fontWeight: 720,
                    lineHeight: 1.3
                  }}
                >
                  {driverName ? <span><strong>Tài xế:</strong> {driverName}</span> : null}
                  {driverPhone ? <span><strong>SĐT:</strong> {driverPhone}</span> : null}
                  {deliveryTime ? <span><strong>Giao dự kiến:</strong> {deliveryTime}</span> : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <InfoLine icon="timer" color={isKitchenOrderDone(order) ? "#334155" : "#059669"} strong>
            {formatOrderTiming(order)}
          </InfoLine>
          {isScheduledPickupOrder ? (
            <div
              style={{
                border: `1px solid ${scheduledPickupTheme.border}`,
                background: scheduledPickupTheme.background,
                color: scheduledPickupTheme.color,
                borderRadius: 10,
                padding: "8px 10px",
                display: "grid",
                gap: 2,
                width: "fit-content",
                maxWidth: "100%",
                fontSize: 12,
                fontWeight: 850,
                lineHeight: 1.2
              }}
            >
              <strong style={{ fontSize: 13, fontWeight: 950 }}>
                Khách lấy lúc {pickupSchedule.clock}
              </strong>
              <span>{scheduledPickupCountdown}</span>
            </div>
          ) : null}
        </div>

        <div style={{ textAlign: compact ? "left" : "right", display: "grid", gap: tabletCompact ? 4 : 6, justifyItems: compact ? "start" : "end", minWidth: 0 }}>
          <strong style={{ color: "#334155", fontSize: isNarrowLayout ? 18 : 21, fontWeight: 780 }}>
            {isCancelled ? "Đã hủy" : `${doneItems}/${totalItems}`}
          </strong>
          {isCancelled ? null : <ProgressBoxes doneItems={doneItems} totalItems={totalItems} accent={theme.border} />}
          {!isCancelled && totalToppings ? (
            <>
              <span style={{ color: "#92400e", fontSize: 11, fontWeight: 760 }}>
                Topping {doneToppings}/{totalToppings}
              </span>
              <ProgressBoxes doneItems={doneToppings} totalItems={totalToppings} accent="#f59e0b" />
            </>
          ) : null}
          <span style={{ color: "#475569", fontSize: 12, fontWeight: 680 }}>
            {isCancelled
              ? isCancelledAcknowledged
                ? "Đã xác nhận hủy"
                : "Chờ bếp xác nhận hủy"
              : canMarkDone ? order.displayStatus : closedOrderLabel}
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
            ? isCancelledAcknowledged
              ? "Đơn này đã được bếp xác nhận hủy."
              : "Đơn này đã bị hủy từ NexPOS. Bếp không làm tiếp, kiểm lại món đã chuẩn bị rồi bấm Xác nhận đơn hủy."
            : "Đơn đặt trước, chỉ hiện khi NexPOS chuyển sang đang làm."}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: itemGridColumns,
          gridAutoRows: "auto",
          alignItems: "start",
          gap: tabletCompact ? 7 : 10,
          maxHeight: compact ? "none" : 420,
          overflowY: compact ? "visible" : "auto",
          paddingRight: tabletCompact ? 2 : 4
        }}
      >
        {displayItems.length ? (
          displayItems.map(({ item, itemNumber, unitIndex }) => {
            const itemHighlighted = typeof isItemHighlighted === "function" && isItemHighlighted(item);
            const itemKey = getKitchenItemProgressKey(order, item);
            const itemRequestKey = getKitchenItemRequestKey(order, item);
            const sourceDone = item.status === "done";
            const unitChecked = getUnitProgressState(unitProgress, itemKey, unitIndex, sourceDone);
            const paidToppings = getPaidToppings(item);
            const unitToppingsDone = areUnitToppingsDone(toppingProgress, itemKey, unitIndex, paidToppings);
            const itemDone = sourceDone || (unitChecked && unitToppingsDone);
            const itemUpdating = updatingItemKey === itemRequestKey;
            const normalizedRecipeOptions = getKitchenRecipeOptions(item.options);
            const paidToppingKeys = buildPaidToppingOptionKeys(paidToppings);
            const displayOptions = compactKitchenDisplayOptions(normalizedRecipeOptions
              .flatMap((option) => {
                const recipeOnlyLabel = getRecipeOnlyDisplayLabel(option);
                if (recipeOnlyLabel) return [recipeOnlyLabel];
                return isPaidToppingDisplayOption(option.label, paidToppingKeys) ? [] : [option.label];
              }));
            const itemMinHeight = tabletCompact
              ? item.note && paidToppings.length
                ? 132
                : item.note
                  ? 112
                  : paidToppings.length
                    ? 104
                    : 72
              : item.note && paidToppings.length
                ? 178
                : item.note
                  ? 158
                  : paidToppings.length
                    ? 130
                    : 112;

            return (
              <button
                key={`${item.id || itemKey}-unit-${unitIndex}`}
                type="button"
                disabled={!canToggleItems || itemUpdating}
                onClick={(event) => handleToggleUnit(event, item, unitIndex)}
                style={{
                  minHeight: itemMinHeight,
                  height: "auto",
                  textAlign: "left",
                  border: itemHighlighted ? "2px solid #8b5cf6" : "1px solid #dbe3ef",
                  background: itemHighlighted ? "#faf5ff" : itemDone ? "#f0fdf4" : unitChecked ? "#fffbeb" : "rgba(255,255,255,0.88)",
                  borderRadius: 12,
                  padding: tabletCompact ? 8 : 11,
                  display: "grid",
                  gridTemplateColumns: tabletCompact ? "20px minmax(0, 1fr)" : "22px minmax(0, 1fr)",
                  gap: tabletCompact ? 7 : 9,
                  alignContent: "start",
                  alignItems: "start",
                  overflow: "visible",
                  cursor: !canToggleItems || itemUpdating ? "not-allowed" : "pointer",
                  opacity: itemUpdating ? 0.72 : 1
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: tabletCompact ? 16 : 18,
                    height: tabletCompact ? 16 : 18,
                    borderRadius: 3,
                    border: itemDone ? "1px solid #16a34a" : unitChecked ? "1px solid #f59e0b" : "1px solid #94a3b8",
                    background: itemDone ? "#16a34a" : unitChecked ? "#f59e0b" : "#ffffff",
                    marginTop: 2,
                    boxShadow: itemDone || unitChecked ? "inset 0 0 0 3px #ffffff" : "none"
                  }}
                />
                <span style={{ minWidth: 0, display: "grid", gap: tabletCompact ? 6 : 9 }}>
                  <strong
                    style={{
                      color: itemDone ? "#64748b" : "#111827",
                      fontSize: tabletCompact ? 14 : 15,
                      lineHeight: 1.24,
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
          gap: tabletCompact ? 7 : 10,
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
            padding: tabletCompact ? "9px 11px" : "12px 14px",
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
          title={printButtonConfig.title || ""}
          disabled={printButtonConfig.disabled}
          onClick={(event) => {
            event.stopPropagation();
            onPrintBill?.(order);
          }}
          style={{
            border: `1px solid ${printButtonConfig.border}`,
            background: printButtonConfig.background,
            color: printButtonConfig.color,
            borderRadius: 10,
            padding: tabletCompact ? "9px 11px" : "12px 14px",
            fontSize: 13,
            fontWeight: 900,
            cursor: printButtonConfig.disabled ? "not-allowed" : "pointer",
            opacity: printButtonConfig.opacity
          }}
        >
          {printButtonConfig.label}
        </button>
        <button
          type="button"
          disabled={isCancelled || isPreorder}
          onClick={handleResetProgress}
          style={{
            border: "1px solid #dbe3ef",
            background: isCancelled || isPreorder ? "#f1f5f9" : "#ffffff",
            color: isCancelled || isPreorder ? "#94a3b8" : "#111827",
            borderRadius: 10,
            padding: tabletCompact ? "9px 11px" : "12px 14px",
            fontSize: 13,
            fontWeight: 900,
            cursor: isCancelled || isPreorder ? "not-allowed" : "default"
          }}
        >
          Reset
        </button>
      </div>
    </article>
  );
}
