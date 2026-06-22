function toText(value = "") {
  return String(value || "").trim();
}

function toUpper(value = "") {
  return toText(value).toUpperCase();
}

function toPoints(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pushNetPoints(map, keys = [], points = 0) {
  const safePoints = toPoints(points);
  if (!safePoints) return;
  keys
    .map(toText)
    .filter(Boolean)
    .forEach((key) => {
      map.set(key, toPoints(map.get(key)) + safePoints);
    });
}

function getEntryPartnerKeys(entry = {}) {
  return [
    entry.partnerOrderId,
    entry.partner_order_id,
    entry.partnerOrderCode,
    entry.partner_order_code,
    entry.displayOrderCode,
    entry.display_order_code,
    entry.orderId,
    entry.order_id,
    entry.sourceOrderId,
    entry.source_order_id
  ];
}

function getEntryOrderKeys(entry = {}) {
  return [
    entry.orderId,
    entry.order_id,
    entry.sourceOrderId,
    entry.source_order_id,
    entry.displayOrderCode,
    entry.display_order_code
  ];
}

export function normalizeLoyaltyEntryType(value = "") {
  return toUpper(value);
}

export function isCheckinLikeEntryType(value = "") {
  return ["CHECKIN", "CHECKIN_V2"].includes(normalizeLoyaltyEntryType(value));
}

export function isMilestoneEntryType(value = "") {
  return normalizeLoyaltyEntryType(value) === "MILESTONE";
}

export function isSpendEntryType(value = "") {
  return normalizeLoyaltyEntryType(value) === "ORDER_SPEND";
}

export function isSpendReversalEntryType(value = "") {
  return normalizeLoyaltyEntryType(value) === "ORDER_SPEND_REVERSED";
}

export function isEarnEntryType(value = "") {
  return ["ORDER_EARN", "PARTNER_ORDER_EARN"].includes(normalizeLoyaltyEntryType(value));
}

export function isEarnReversalEntryType(value = "") {
  return normalizeLoyaltyEntryType(value) === "ORDER_EARN_REVERSED";
}

export function buildLoyaltyOrderPointLookup(entries = []) {
  const orderPoints = new Map();
  const partnerOrderPoints = new Map();

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const type = normalizeLoyaltyEntryType(entry?.type || entry?.entryType);
    const points = toPoints(entry?.points);

    if (type === "PARTNER_ORDER_EARN") {
      pushNetPoints(partnerOrderPoints, getEntryPartnerKeys(entry), points);
      return;
    }

    if (type === "ORDER_EARN_REVERSED" && getEntryPartnerKeys(entry).map(toText).some(Boolean)) {
      pushNetPoints(partnerOrderPoints, getEntryPartnerKeys(entry), points);
      return;
    }

    if (type === "ORDER_EARN" || type === "ORDER_EARN_REVERSED") {
      pushNetPoints(orderPoints, getEntryOrderKeys(entry), points);
    }
  });

  return { orderPoints, partnerOrderPoints };
}

export function normalizeOrderPointStatus(value = "") {
  return toText(value).toLowerCase();
}

export function isBlockedOrderPointStatus(value = "") {
  return ["rejected", "expired", "cancelled", "canceled"].includes(normalizeOrderPointStatus(value));
}

export function getNetOrderPoints(lookup = {}, order = {}) {
  const sourceType = toText(order?.sourceType || order?.source_type).toLowerCase();
  const keys = [
    order.id,
    order.orderCode,
    order.order_code,
    order.displayOrderCode,
    order.display_order_code,
    order.partnerOrderCode,
    order.partner_order_code,
    order.partnerOrderId,
    order.partner_order_id,
    order.nexposOrderId
  ]
    .map(toText)
    .filter(Boolean);
  const map = sourceType === "partner" || order?.partnerSource ? lookup.partnerOrderPoints : lookup.orderPoints;
  return keys.reduce((sum, key) => sum + toPoints(map?.get(key)), 0);
}

export function resolveOrderPointStatus(order = {}, lookup = {}) {
  const rawStatus = normalizeOrderPointStatus(order?.pointStatus || order?.point_status || "");
  if (isBlockedOrderPointStatus(rawStatus)) return "blocked";
  if (getNetOrderPoints(lookup, order) > 0) return "claimed";
  if (rawStatus === "waiting_data") return "waiting_data";
  return "pending";
}

export function formatSignedLoyaltyPoints(points = 0) {
  const safePoints = Math.trunc(toPoints(points));
  const sign = safePoints > 0 ? "+" : safePoints < 0 ? "-" : "";
  return `${sign}${Math.abs(safePoints).toLocaleString("vi-VN")}`;
}
