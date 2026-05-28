const ORDER_COUNT_EXCLUDED_STATUS_KEYS = new Set([
  "cancel",
  "canceled",
  "cancelled",
  "huy",
  "dahuy",
  "refunded",
  "preorder",
  "pre_order",
  "preordered",
  "scheduled",
  "dattruoc"
]);

const ORDER_COUNT_COMPLETED_STATUS_KEYS = new Set([
  "done",
  "completed",
  "complete",
  "finish",
  "finished",
  "served",
  "hoantat"
]);

export const EMPTY_ORDER_COUNT_SUMMARY = {
  totalOrders: 0,
  totalSpent: 0
};

export function normalizeOrderCountingStatus(value = "") {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9]+/g, "");
}

export function toOrderCountingNumber(value = 0, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildOrderCountingPhoneVariants(phoneKeys = []) {
  const variants = new Set();

  (Array.isArray(phoneKeys) ? phoneKeys : []).forEach((phoneKey) => {
    const normalized = String(phoneKey || "").trim();
    if (!normalized) return;

    variants.add(normalized);

    const localDigits = normalized.startsWith("0") ? normalized.slice(1) : normalized;
    if (!localDigits) return;

    variants.add(localDigits);
    variants.add(`84${localDigits}`);
    variants.add(`+84${localDigits}`);
    variants.add(`0084${localDigits}`);
  });

  return [...variants];
}

export function isExcludedOrderForCounting(...values) {
  return values.some((value) => ORDER_COUNT_EXCLUDED_STATUS_KEYS.has(normalizeOrderCountingStatus(value)));
}

export function isCompletedOrderForCounting(...values) {
  return values.some((value) => ORDER_COUNT_COMPLETED_STATUS_KEYS.has(normalizeOrderCountingStatus(value)));
}

export function appendOrderCountSummary(summary = EMPTY_ORDER_COUNT_SUMMARY, amount = 0, count = 1) {
  return {
    totalOrders: toOrderCountingNumber(summary.totalOrders, 0) + Math.max(0, toOrderCountingNumber(count, 0)),
    totalSpent: toOrderCountingNumber(summary.totalSpent, 0) + Math.max(0, toOrderCountingNumber(amount, 0))
  };
}

export function buildCustomerOrderCountMap(rows = [], options = {}) {
  const resolveIdentity = typeof options.resolveIdentity === "function"
    ? options.resolveIdentity
    : (() => ({ key: "" }));
  const allowedKeys = options.keySet instanceof Set ? options.keySet : null;
  const counts = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const identity = resolveIdentity(row) || {};
    const key = String(identity.key || "").trim();
    if (!key) return;
    if (allowedKeys && !allowedKeys.has(key)) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return counts;
}

export function buildCustomerLifetimeStatsMap(rows = [], options = {}) {
  const resolveIdentity = typeof options.resolveIdentity === "function"
    ? options.resolveIdentity
    : (() => ({ key: "" }));
  const getAmount = typeof options.getAmount === "function"
    ? options.getAmount
    : ((row) => row?.totalAmount || row?.total_amount || row?.total || 0);
  const allowedKeys = options.keySet instanceof Set ? options.keySet : null;
  const stats = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const identity = resolveIdentity(row) || {};
    const key = String(identity.key || "").trim();
    if (!key) return;
    if (allowedKeys && !allowedKeys.has(key)) return;

    const current = stats.get(key) || EMPTY_ORDER_COUNT_SUMMARY;
    stats.set(key, appendOrderCountSummary(current, getAmount(row), 1));
  });

  return stats;
}

export default {
  EMPTY_ORDER_COUNT_SUMMARY,
  normalizeOrderCountingStatus,
  toOrderCountingNumber,
  buildOrderCountingPhoneVariants,
  isExcludedOrderForCounting,
  isCompletedOrderForCounting,
  appendOrderCountSummary,
  buildCustomerOrderCountMap,
  buildCustomerLifetimeStatsMap
};
