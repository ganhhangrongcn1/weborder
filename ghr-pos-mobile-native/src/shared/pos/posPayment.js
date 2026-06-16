function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeCashReceived(value = "") {
  return Math.max(0, Math.floor(toNumber(String(value).replace(/[^\d]/g, ""))));
}

export function calculateCashChange(total = 0, cashReceived = 0) {
  return Math.max(0, normalizeCashReceived(cashReceived) - Math.max(0, Math.floor(toNumber(total))));
}
