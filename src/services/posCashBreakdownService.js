export const CASH_DENOMINATIONS = [
  500000,
  200000,
  100000,
  50000,
  20000,
  10000,
  5000,
  2000,
  1000
];

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toCashCount(value = "") {
  const parsed = Number(String(value || "").replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export function formatCashDenomination(value = 0) {
  return `${Math.max(0, Math.round(toNumber(value))).toLocaleString("vi-VN")}đ`;
}

export function normalizeCashBreakdown(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const normalized = {};
  CASH_DENOMINATIONS.forEach((denomination) => {
    const count = toCashCount(value[denomination] ?? value[String(denomination)]);
    if (count > 0) normalized[String(denomination)] = count;
  });
  return normalized;
}

export function getCashBreakdownTotal(value = null) {
  const normalized = normalizeCashBreakdown(value);
  if (!normalized) return 0;
  return CASH_DENOMINATIONS.reduce(
    (sum, denomination) => sum + denomination * toCashCount(normalized[String(denomination)]),
    0
  );
}

export function getCashBreakdownEntries(value = null, options = {}) {
  const normalized = normalizeCashBreakdown(value);
  if (!normalized) return [];

  const includeZero = options.includeZero === true;
  return CASH_DENOMINATIONS
    .map((denomination) => {
      const count = toCashCount(normalized[String(denomination)]);
      return {
        denomination,
        count,
        total: denomination * count,
        label: formatCashDenomination(denomination)
      };
    })
    .filter((entry) => includeZero || entry.count > 0);
}

export function formatCashBreakdownSummary(value = null) {
  const entries = getCashBreakdownEntries(value);
  if (!entries.length) return "Chưa đếm tiền";
  return entries
    .map((entry) => `${entry.label} x ${entry.count}`)
    .join(" · ");
}
