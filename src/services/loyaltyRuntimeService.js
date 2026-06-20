function toText(value = "") {
  return String(value || "").trim();
}

function normalizeStatusToken(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toPositiveInteger(value = 0) {
  const parsed = Math.floor(Number(value || 0));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

const DONE_STATUSES = new Set(["done", "completed", "complete", "hoan_tat"]);
const CANCELLED_STATUSES = new Set(["cancel", "cancelled", "canceled", "refunded", "refund"]);
const SPEND_ENTRY_STATUSES = new Set(["pending_payment", "pending_qr", "pending_zalo", "pending", "confirmed", "new", "unpaid"]);

export function normalizeLoyaltySourceType(value = "") {
  const normalized = toText(value).toUpperCase();
  return normalized === "PARTNER_ORDER" ? "PARTNER_ORDER" : "ORDER";
}

export function buildOrderLoyaltyIdempotencyKey({
  sourceType = "ORDER",
  sourceOrderId = "",
  action = ""
} = {}) {
  const safeSourceType = normalizeLoyaltySourceType(sourceType);
  const safeOrderId = toText(sourceOrderId).replace(/\s+/g, "-").slice(0, 120);
  const safeAction = toText(action).toUpperCase();
  return `loyalty-v2:${safeSourceType}:${safeOrderId}:${safeAction}:v1`.slice(0, 200);
}

export function buildCheckinIdempotencyKey(dateKey = "") {
  const safeDateKey = toText(dateKey) || new Date().toISOString().slice(0, 10);
  return `loyalty-v2:checkin:${safeDateKey}`.slice(0, 200);
}

export function planOrderLoyaltyActions({
  sourceType = "ORDER",
  previousStatus = "",
  currentStatus = "",
  pointsSpent = 0
} = {}) {
  const safeSourceType = normalizeLoyaltySourceType(sourceType);
  const prev = normalizeStatusToken(previousStatus);
  const next = normalizeStatusToken(currentStatus);
  const spendPoints = toPositiveInteger(pointsSpent);
  const prevDone = DONE_STATUSES.has(prev);
  const nextDone = DONE_STATUSES.has(next);
  const prevCancelled = CANCELLED_STATUSES.has(prev);
  const nextCancelled = CANCELLED_STATUSES.has(next);
  const actions = [];

  if (safeSourceType === "PARTNER_ORDER") {
    if (nextDone && !prevDone) {
      actions.push("CLAIM_PARTNER_EARN");
    }
    if (nextCancelled && !prevCancelled && prevDone) {
      actions.push("REVERSE_EARN");
    }
    return actions;
  }

  if (
    spendPoints > 0 &&
    !nextDone &&
    !nextCancelled &&
    (
      !prev ||
      SPEND_ENTRY_STATUSES.has(prev)
    )
  ) {
    actions.push("SPEND");
  }

  if (nextDone && !prevDone) {
    actions.push("SETTLE_EARN");
  }

  if (nextCancelled && !prevCancelled) {
    if (spendPoints > 0) {
      actions.push("REVERSE_SPEND");
    }
    if (prevDone) {
      actions.push("REVERSE_EARN");
    }
  }

  return actions;
}
