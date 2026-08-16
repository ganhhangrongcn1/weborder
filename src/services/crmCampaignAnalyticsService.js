function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizePhone(value = "") {
  return normalizeText(value).replace(/\D/g, "");
}

function toDateKey(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getBatchTimestamp(batchId = "") {
  const matched = normalizeText(batchId).match(/(\d{12,})$/);
  return matched ? Number(matched[1]) : 0;
}

function matchesOrderCode(order = {}, orderCode = "") {
  const target = normalizeText(orderCode);
  return Boolean(target && [order.id, order.orderCode, order.displayOrderCode]
    .some((value) => normalizeText(value) === target));
}

function getOrderRevenue(order = {}) {
  return Math.max(0, Number(order.totalAmount ?? order.total ?? order.subtotal ?? 0));
}

function isVoucherExpired(voucher = {}, todayKey = toDateKey(new Date())) {
  const expiredAt = normalizeText(voucher.expiredAt || voucher.endAt || voucher.expiry);
  return Boolean(expiredAt && expiredAt.slice(0, 10) < todayKey);
}

function addDays(dateKey = "", days = 0) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + Number(days || 0));
  return toDateKey(date);
}

function getMostCommonExpiry(rows = []) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = normalizeText(row.expiredAt).slice(0, 10);
    if (key) counts.set(key, Number(counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function buildDailyUsage(startValue = "", expiresAt = "", usedRows = []) {
  const startKey = toDateKey(startValue);
  if (!startKey) return [];
  const endKey = expiresAt || startKey;
  const usageCounts = new Map();
  usedRows.forEach((row) => {
    const key = toDateKey(row.usedAt);
    if (key) usageCounts.set(key, Number(usageCounts.get(key) || 0) + 1);
  });

  const days = [];
  let currentKey = startKey;
  while (currentKey && currentKey <= endKey && days.length < 60) {
    days.push({ date: currentKey, count: Number(usageCounts.get(currentKey) || 0) });
    currentKey = addDays(currentKey, 1);
  }
  return days;
}

function getMatchingCandidates(history = {}, customers = []) {
  const successPhones = new Set((history.successPhones || []).map(normalizePhone).filter(Boolean));
  const historyDate = toDateKey(history.createdAt);
  const voucherCode = normalizeText(history.voucherCode).toUpperCase();
  const voucherId = normalizeText(history.voucherId);
  const campaignKey = normalizeText(history.campaignKey);
  const campaignLabel = normalizeText(history.campaignLabel);

  return (customers || []).flatMap((customer) => {
    const phone = normalizePhone(customer.phone);
    if (successPhones.size && !successPhones.has(phone)) return [];
    return (customer.vouchers || [])
      .filter((voucher) => {
        const matchesVoucher = voucherId
          ? normalizeText(voucher.couponId) === voucherId || normalizeText(voucher.id) === voucherId
          : normalizeText(voucher.code).toUpperCase() === voucherCode;
        if (!matchesVoucher) return false;
        if (historyDate && toDateKey(voucher.createdAt) !== historyDate) return false;
        if (campaignKey && voucher.grantCampaignKey && normalizeText(voucher.grantCampaignKey) !== campaignKey) return false;
        if (campaignLabel && voucher.grantCampaignLabel && normalizeText(voucher.grantCampaignLabel) !== campaignLabel) return false;
        return true;
      })
      .map((voucher) => ({ customer, phone, voucher }));
  });
}

function resolveBatchId(history = {}, candidates = []) {
  const storedBatchId = normalizeText(history.grantBatchId);
  if (storedBatchId) return storedBatchId;

  const historyTime = new Date(history.createdAt || 0).getTime();
  const grouped = new Map();
  candidates.forEach((item) => {
    const batchId = normalizeText(item.voucher.grantBatchId);
    if (!batchId) return;
    grouped.set(batchId, Number(grouped.get(batchId) || 0) + 1);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const aDistance = Math.abs(getBatchTimestamp(a[0]) - historyTime);
      const bDistance = Math.abs(getBatchTimestamp(b[0]) - historyTime);
      return aDistance - bDistance;
    })[0]?.[0] || "";
}

function pickCustomerVoucher(items = [], batchId = "") {
  const exactBatch = batchId
    ? items.find((item) => normalizeText(item.voucher.grantBatchId) === batchId)
    : null;
  if (exactBatch) return exactBatch;
  return [...items].sort((a, b) => {
    const usedDifference = Number(Boolean(b.voucher.used)) - Number(Boolean(a.voucher.used));
    if (usedDifference !== 0) return usedDifference;
    return getBatchTimestamp(b.voucher.grantBatchId) - getBatchTimestamp(a.voucher.grantBatchId);
  })[0] || null;
}

export function buildCampaignHistoryAnalytics(history = {}, customers = [], now = new Date()) {
  const candidates = getMatchingCandidates(history, customers);
  const batchId = resolveBatchId(history, candidates);
  const byPhone = new Map();
  candidates.forEach((item) => {
    if (!byPhone.has(item.phone)) byPhone.set(item.phone, []);
    byPhone.get(item.phone).push(item);
  });

  const todayKey = toDateKey(now);
  const customerRows = Array.from(byPhone.values())
    .map((items) => pickCustomerVoucher(items, batchId))
    .filter(Boolean)
    .map(({ customer, phone, voucher }) => {
      const orderCode = normalizeText(voucher.orderCode);
      const order = (customer.orders || []).find((item) => matchesOrderCode(item, orderCode)) || null;
      return {
        phone,
        name: normalizeText(customer.name) || "Khách hàng",
        used: Boolean(voucher.used),
        usedAt: normalizeText(voucher.usedAt),
        expiredAt: normalizeText(voucher.expiredAt),
        expired: !voucher.used && isVoucherExpired(voucher, todayKey),
        orderCode,
        orderRevenue: order ? getOrderRevenue(order) : 0
      };
    })
    .sort((a, b) => Number(b.used) - Number(a.used) || new Date(b.usedAt || 0) - new Date(a.usedAt || 0));

  const grantedCount = Math.max(0, Number(history.successCount || 0));
  const usedRows = customerRows.filter((row) => row.used);
  const expiredRows = customerRows.filter((row) => row.expired);
  const usedCount = usedRows.length;
  const unusedCount = Math.max(0, grantedCount - usedCount);
  const expiresAt = getMostCommonExpiry(customerRows);

  return {
    batchId,
    grantedCount,
    matchedCount: customerRows.length,
    usedCount,
    unusedCount,
    expiredCount: expiredRows.length,
    activeUnusedCount: Math.max(0, unusedCount - expiredRows.length),
    expiresAt,
    redemptionRate: grantedCount ? Math.round((usedCount / grantedCount) * 1000) / 10 : 0,
    attributedRevenue: usedRows.reduce((sum, row) => sum + row.orderRevenue, 0),
    dailyUsage: buildDailyUsage(history.createdAt, expiresAt, usedRows),
    usedRows,
    unusedRows: customerRows.filter((row) => !row.used),
    coverageRate: grantedCount ? Math.min(100, Math.round((customerRows.length / grantedCount) * 1000) / 10) : 100
  };
}

export function buildCampaignHistoryOverview(history = [], customers = [], now = new Date()) {
  const entries = (history || []).map((entry) => ({
    entry,
    analytics: buildCampaignHistoryAnalytics(entry, customers, now)
  }));
  const grantedCount = entries.reduce((sum, item) => sum + item.analytics.grantedCount, 0);
  const usedCount = entries.reduce((sum, item) => sum + item.analytics.usedCount, 0);
  return {
    entries,
    grantedCount,
    usedCount,
    unusedCount: Math.max(0, grantedCount - usedCount),
    redemptionRate: grantedCount ? Math.round((usedCount / grantedCount) * 1000) / 10 : 0,
    attributedRevenue: entries.reduce((sum, item) => sum + item.analytics.attributedRevenue, 0)
  };
}

export default {
  buildCampaignHistoryAnalytics,
  buildCampaignHistoryOverview
};
