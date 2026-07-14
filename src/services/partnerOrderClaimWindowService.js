export const PARTNER_ORDER_CLAIM_WINDOW_DAYS = 7;

const CLAIM_WINDOW_MS = PARTNER_ORDER_CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function toTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getPartnerOrderClaimStartedAt(order = {}) {
  return (
    order?.orderTime ||
    order?.order_time ||
    order?.createdAt ||
    order?.created_at ||
    ""
  );
}

export function isPartnerOrderClaimExpired(order = {}, now = Date.now()) {
  const startedAt = toTimestamp(getPartnerOrderClaimStartedAt(order));
  const currentTime = now instanceof Date ? now.getTime() : Number(now);
  if (startedAt === null || !Number.isFinite(currentTime)) return false;
  return currentTime >= startedAt + CLAIM_WINDOW_MS;
}

export function resolvePartnerOrderPointStatus(order = {}, now = Date.now()) {
  const status = String(order?.pointStatus || order?.point_status || "pending").trim().toLowerCase();
  if (status === "claimed") return "claimed";
  if (["expired", "rejected", "blocked", "cancelled", "canceled"].includes(status)) {
    return status;
  }
  return isPartnerOrderClaimExpired(order, now) ? "expired" : status;
}

export default {
  PARTNER_ORDER_CLAIM_WINDOW_DAYS,
  getPartnerOrderClaimStartedAt,
  isPartnerOrderClaimExpired,
  resolvePartnerOrderPointStatus
};
