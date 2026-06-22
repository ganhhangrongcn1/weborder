function toAmountOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function resolvePartnerNetReceivedAmount(row = {}) {
  const rawData = getObject(row?.raw_data || row?.rawData);
  const financeData = getObject(rawData.finance_data);

  return (
    toAmountOrNull(row?.net_received_amount ?? row?.netReceivedAmount) ??
    toAmountOrNull(financeData.real_received) ??
    toAmountOrNull(financeData.net_received) ??
    toAmountOrNull(rawData.total_for_biz) ??
    toAmountOrNull(financeData.total_for_biz)
  );
}

export function buildPartnerLoyaltyAmountSnapshot(row = {}) {
  const netReceivedAmount = resolvePartnerNetReceivedAmount(row);
  const persistedHoldReason = String(
    row?.loyalty_hold_reason || row?.loyaltyHoldReason || ""
  ).trim();
  const rawPointStatus = String(row?.point_status || row?.pointStatus || "pending").trim().toLowerCase();
  const isClaimed = rawPointStatus === "claimed";
  const isBlocked = ["blocked", "rejected", "expired", "cancelled", "canceled"].includes(rawPointStatus);
  const loyaltyHoldReason = isClaimed
    ? ""
    : persistedHoldReason || (netReceivedAmount ? "" : "missing_partner_net_received");

  return {
    netReceivedAmount,
    loyaltyEligibleAmount: netReceivedAmount || 0,
    pointsBaseAmount: netReceivedAmount || 0,
    loyaltyHoldReason,
    pointStatus: isBlocked ? "blocked" : (loyaltyHoldReason ? "waiting_data" : rawPointStatus)
  };
}

export default {
  buildPartnerLoyaltyAmountSnapshot,
  resolvePartnerNetReceivedAmount
};
