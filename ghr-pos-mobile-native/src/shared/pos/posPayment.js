function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const CASH_ROUNDING_UNIT = 1000;

export function normalizeCashReceived(value = "") {
  return Math.max(0, Math.floor(toNumber(String(value).replace(/[^\d]/g, ""))));
}

export function roundDownCashAmount(value = 0, unit = CASH_ROUNDING_UNIT) {
  const safeValue = Math.max(0, Math.floor(toNumber(value)));
  const safeUnit = Math.max(1, Math.floor(toNumber(unit || CASH_ROUNDING_UNIT)));
  return Math.floor(safeValue / safeUnit) * safeUnit;
}

export function getCashPaymentSummary(total = 0) {
  const originalAmount = Math.max(0, Math.floor(toNumber(total)));
  const paymentAmount = roundDownCashAmount(originalAmount);
  return {
    originalAmount,
    paymentAmount,
    cashRoundingDiscount: Math.max(0, originalAmount - paymentAmount),
    cashRoundingUnit: CASH_ROUNDING_UNIT
  };
}

export function calculateCashChange(total = 0, cashReceived = 0) {
  return Math.max(0, normalizeCashReceived(cashReceived) - Math.max(0, Math.floor(toNumber(total))));
}
