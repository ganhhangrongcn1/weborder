export function normalizeReceiptLoyaltyDisplay(receipt) {
  if (!receipt || typeof receipt !== "object") return receipt;
  const knownZero = (value) => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number(value) === 0;
  const noAccrual = [receipt.totalAmount, receipt.pointsBaseAmount, receipt.points].every(knownZero);
  if (noAccrual && ["available", "waiting_data", "expired"].includes(receipt.status)) {
    return { ...receipt, status: "not_eligible" };
  }
  return receipt;
}

export default normalizeReceiptLoyaltyDisplay;
