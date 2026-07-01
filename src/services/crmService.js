import { getCustomerKey } from "./storageService.js";
import { readCustomerPartnerOrdersForAdmin, readPartnerOrdersForAdmin } from "./adminOrderFeedService.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import { customerRepository } from "./repositories/customerRepository.js";
import { loyaltyRepository } from "./repositories/loyaltyRepository.js";
import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";
import {
  EMPTY_ORDER_COUNT_SUMMARY,
  appendOrderCountSummary,
  isExcludedOrderForCounting,
  toOrderCountingNumber
} from "./customerOrderCountingService.js";
import { getMonthlyCustomerGiftStatsByPhonesRpc } from "./customerOrderCountingRpcService.js";
import { getAdminCrmAnalyticsRpc } from "./adminCrmAnalyticsService.js";
import { activateLoyaltyRuleVersion, normalizeLoyaltyRuleVersionPayload } from "./loyaltyRuleVersionService.js";
import {
  DEFAULT_LOYALTY_PROGRAM_CONFIG,
  normalizeLoyaltyProgramConfig,
  resolveLoyaltyTier
} from "./loyaltyProgramConfigService.js";
import {
  addDaysToVietnamDateInput,
  buildVietnamDateRange,
  hasDateRange,
  toVietnamDateInputValue
} from "../utils/adminDateRange.js";
import {
  calculateOrderPoints,
  defaultLoyaltyData,
  getLoyaltyRuleConfig,
  normalizeLoyaltyData,
  resolveVoucherUsageFromOrders
} from "./loyaltyService.js";
export const CRM_CUSTOMERS_KEY = "ghr_customers";
export const CRM_LOYALTY_KEY = "ghr_loyalty";

const defaultLoyaltyConfig = DEFAULT_LOYALTY_PROGRAM_CONFIG;
const CRM_SUPPORT_CACHE_TTL_MS = 60000;
let crmSupportCache = { value: null, cachedAt: 0 };
let crmSupportInFlight = null;
let crmFastSupportCache = { value: null, cachedAt: 0 };
let crmFastSupportInFlight = null;

function getOrderTimeValue(order = {}) {
  const value = order?.createdAt || order?.orderTime || order?.order_time || order?.created_at || "";
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function dedupeOrdersByIdentity(orders = []) {
  return [...(Array.isArray(orders) ? orders : []).reduce((map, order) => {
    const key = String(order?.id || order?.orderCode || order?.displayOrderCode || "").trim();
    if (!key) return map;
    const current = map.get(key);
    if (!current || getOrderTimeValue(order) >= getOrderTimeValue(current)) {
      map.set(key, order);
    }
    return map;
  }, new Map()).values()];
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${String(dateKey).slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getDateKey(date);
}

function getUtcMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function normalizeCrmVoucher(voucher) {
  const createdAt = String(voucher?.createdAt || getDateKey(new Date()));
  return {
    id: voucher?.id || `voucher-${Date.now()}`,
    type: voucher?.type || "CRM_GIFT",
    couponId: voucher?.couponId || "",
    code: voucher?.code || "",
    discountType: voucher?.discountType || "fixed",
    value: Number(voucher?.value || 0),
    maxDiscount: Number(voucher?.maxDiscount || 0),
    minOrder: Number(voucher?.minOrder || 0),
    title: voucher?.title || "Voucher CRM",
    createdAt,
    used: Boolean(voucher?.used),
    usedAt: voucher?.usedAt || "",
    canceled: Boolean(voucher?.canceled),
    canceledAt: voucher?.canceledAt || "",
    orderCode: voucher?.orderCode || "",
    expiredAt: voucher?.expiredAt || addDaysToDateKey(createdAt, 7)
  };
}

function sumPointsByType(pointHistory = [], typeMatcher) {
  return pointHistory
    .filter((entry) => typeMatcher(String(entry?.type || "").toUpperCase()))
    .reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
}

function sumPointsByTypes(pointHistory = [], acceptedTypes = []) {
  const set = new Set((acceptedTypes || []).map((item) => String(item || "").toUpperCase()));
  return (pointHistory || [])
    .filter((entry) => set.has(String(entry?.type || "").toUpperCase()))
    .reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
}

function sumLoyaltyPointBalance(pointHistory = []) {
  return (pointHistory || []).reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
}

function calculateChangePercent(todayCount = 0, yesterdayCount = 0) {
  const today = Number(todayCount || 0);
  const yesterday = Number(yesterdayCount || 0);
  if (yesterday <= 0) return today > 0 ? 100 : 0;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

async function getMemberRegistrationComparisonAsync() {
  const todayKey = toVietnamDateInputValue();
  const yesterdayKey = addDaysToVietnamDateInput(todayKey, -1);
  const todayRange = buildVietnamDateRange(todayKey, todayKey);
  const yesterdayRange = buildVietnamDateRange(yesterdayKey, yesterdayKey);
  const [todayResult, yesterdayResult] = await Promise.allSettled([
    coreSupabaseRepository.countCustomerProfilesCreatedInRange({
      ...todayRange,
      registeredOnly: true
    }),
    coreSupabaseRepository.countCustomerProfilesCreatedInRange({
      ...yesterdayRange,
      registeredOnly: true
    })
  ]);
  recordAdminRequest("crm member registrations today", "profiles");
  recordAdminRequest("crm member registrations yesterday", "profiles");

  const todayCount = todayResult.status === "fulfilled" ? Number(todayResult.value || 0) : 0;
  const yesterdayCount = yesterdayResult.status === "fulfilled" ? Number(yesterdayResult.value || 0) : 0;
  const delta = todayCount - yesterdayCount;
  const totalTwoDays = todayCount + yesterdayCount;
  const todayWeight = totalTwoDays > 0 ? Math.round((todayCount / totalTwoDays) * 100) : 0;

  if (todayResult.status === "rejected") {
    console.error("[crmService] load member registrations today failed", todayResult.reason);
  }
  if (yesterdayResult.status === "rejected") {
    console.error("[crmService] load member registrations yesterday failed", yesterdayResult.reason);
  }

  return {
    source: "profiles.created_at",
    todayDate: todayKey,
    yesterdayDate: yesterdayKey,
    todayCount,
    yesterdayCount,
    delta,
    changePercent: calculateChangePercent(todayCount, yesterdayCount),
    todayWeight,
    totalTwoDays,
    trend: delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  };
}

export function loadCustomersMeta() {
  return customerRepository.getCustomersMeta();
}

export function saveCustomersMeta(next) {
  return customerRepository.saveCustomersMeta(next || {});
}

function normalizeLoyaltyConfigInput(next) {
  return normalizeLoyaltyProgramConfig({
    ...normalizeLoyaltyRuleVersionPayload(next),
    byPhone: { ...(next?.byPhone || {}) }
  });
}

export async function saveLoyaltyConfigAsync(next) {
  const normalized = normalizeLoyaltyConfigInput(next);
  await activateLoyaltyRuleVersion(normalized);
  return normalized;
}


function sumNumericPoints(entries = []) {
  return entries.reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
}

function shouldExcludeCrmOrder(order = {}) {
  return isExcludedOrderForCounting(
    order?.status,
    order?.orderStatus,
    order?.order_status,
    order?.nexposStatus,
    order?.nexpos_status,
    order?.raw?.status,
    order?.raw?.order_status,
    order?.raw?.nexpos_status
  );
}


async function loadCrmSupportSnapshot({ force = false } = {}) {
  const now = Date.now();
  if (!force && crmSupportCache.value && now - crmSupportCache.cachedAt < CRM_SUPPORT_CACHE_TTL_MS) {
    return crmSupportCache.value;
  }
  if (!force && crmSupportInFlight) return crmSupportInFlight;

  crmSupportInFlight = (async () => {
    const [
      loyaltyResult,
      customerMetaResult,
      registeredUsersResult,
      loyaltyByPhoneResult,
      profileCountResult,
      memberRegistrationResult
    ] = await Promise.allSettled([
      loyaltyRepository.getCrmConfigAsync(defaultLoyaltyConfig),
      customerRepository.getCustomersMetaAsync(),
      customerRepository.getUsersAsync(),
      coreSupabaseRepository.readLoyaltyAccountsSummaryFromTable(),
      coreSupabaseRepository.readCustomerProfileCountFromTable(),
      getMemberRegistrationComparisonAsync()
    ]);
    recordAdminRequest("crm loyalty config", "app_configs");
    recordAdminRequest("crm customer meta", "app_configs");
    recordAdminRequest("crm registered profiles", "profiles");
    recordAdminRequest("crm loyalty summary", "loyalty_accounts");
    recordAdminRequest("crm profile count", "profiles");

    const snapshot = {
      loyalty: loyaltyResult.status === "fulfilled" ? loyaltyResult.value : defaultLoyaltyConfig,
      customerMeta: customerMetaResult.status === "fulfilled" ? customerMetaResult.value : {},
      registeredUsers: registeredUsersResult.status === "fulfilled" ? registeredUsersResult.value : {},
      loyaltyByPhone: loyaltyByPhoneResult.status === "fulfilled" ? (loyaltyByPhoneResult.value || {}) : {},
      supabaseProfileCount: profileCountResult.status === "fulfilled" ? profileCountResult.value : null,
      memberRegistrationComparison: memberRegistrationResult.status === "fulfilled" ? memberRegistrationResult.value : null
    };

    if (loyaltyResult.status === "rejected") {
      console.error("[crmService] load loyalty config failed", loyaltyResult.reason);
    }
    if (customerMetaResult.status === "rejected") {
      console.error("[crmService] load customer meta failed", customerMetaResult.reason);
    }
    if (registeredUsersResult.status === "rejected") {
      console.error("[crmService] load registered users failed", registeredUsersResult.reason);
    }
    if (loyaltyByPhoneResult.status === "rejected") {
      console.error("[crmService] load loyalty-by-phone failed", loyaltyByPhoneResult.reason);
    }
    if (profileCountResult.status === "rejected") {
      console.error("[crmService] load profile count failed", profileCountResult.reason);
    }
    if (memberRegistrationResult.status === "rejected") {
      console.error("[crmService] load member registration comparison failed", memberRegistrationResult.reason);
    }

    crmSupportCache = {
      value: snapshot,
      cachedAt: Date.now()
    };
    return snapshot;
  })();

  try {
    return await crmSupportInFlight;
  } finally {
    crmSupportInFlight = null;
  }
}

export function recalculateAllLoyaltyFromOrders(orderStorage) {
  const orders = orderStorage?.getAll?.() || [];
  const loyaltyRule = getLoyaltyRuleConfig();
  const allByPhone = loyaltyRepository.getAllByPhone();
  const byPhoneOrderEntries = {};

  orders.forEach((order) => {
    const phone = getCustomerKey(order?.customerPhone || order?.phone || order?.rawCustomerPhone || "");
    const orderCode = String(order?.orderCode || order?.id || "").trim();
    if (!phone || !orderCode) return;

    const amount = Number(
      order?.pointsBaseAmount ??
        Math.max(
          Number(order?.subtotal ?? order?.totalAmount ?? order?.total ?? 0) -
            Number(order?.promoDiscount || 0),
          0
        )
    );
    const points = Math.max(0, Number(calculateOrderPoints(amount, loyaltyRule) || 0));
    if (points <= 0) return;

    if (!byPhoneOrderEntries[phone]) byPhoneOrderEntries[phone] = [];
    byPhoneOrderEntries[phone].push({
      id: `point-${orderCode}`,
      type: "ORDER_EARN",
      orderId: orderCode,
      points,
      amount,
      createdAt: order?.createdAt || new Date().toISOString(),
      note: "Tich diem tu don hang",
      title: `Tich diem don ${orderCode}`
    });
  });

  Object.entries(byPhoneOrderEntries).forEach(([phone, orderEntries]) => {
    const current = normalizeLoyaltyData({
      ...defaultLoyaltyData,
      ...(allByPhone[phone] || {})
    });

    const nonOrderEntries = (current.pointHistory || []).filter(
      (entry) => String(entry?.type || "").toUpperCase() !== "ORDER_EARN"
    );
    const mergedPointHistory = [...orderEntries, ...nonOrderEntries].sort(
      (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
    );
    const nextTotalPoints = Math.max(
      0,
      sumNumericPoints(orderEntries) + sumNumericPoints(nonOrderEntries)
    );

    loyaltyRepository.saveByPhone(phone, {
      ...current,
      phone,
      totalPoints: nextTotalPoints,
      pointHistory: mergedPointHistory
    }, defaultLoyaltyData);
  });

  return {
    updatedPhones: Object.keys(byPhoneOrderEntries).length,
    updatedOrders: orders.length
  };
}

function getDaysSince(dateValue) {
  if (!dateValue) return null;
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return null;
  const diff = Date.now() - time;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function getCustomerTier(totalSpent = 0, loyaltyConfig = defaultLoyaltyConfig) {
  return resolveLoyaltyTier(totalSpent, loyaltyConfig).name;
}

export async function buildCustomersFromOrdersAsync(orderStorage, options = {}) {
  const dateRange = options?.dateRange || {};
  const webOrders = await orderStorage?.getAllAsync?.({ ...dateRange, includeItems: false }) || [];
  const partnerOrders = await readPartnerOrdersForAdmin({ ...dateRange, includeItems: false });
  const orders = [
    ...(Array.isArray(webOrders) ? webOrders : []),
    ...(Array.isArray(partnerOrders) ? partnerOrders : [])
  ];
  return buildCustomersFromOrderListAsync(orders, orderStorage, options);
}

export async function buildCustomersFromOrderListAsync(orders = [], orderStorage, options = {}) {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const uniquePhones = Array.from(new Set(
    safeOrders
      .map((order) => getCustomerKey(order?.customerPhone || order?.phone || ""))
      .filter(Boolean)
  ));
  const {
    loyalty,
    customerMeta,
    registeredUsers,
    loyaltyByPhone,
    supabaseProfileCount,
    memberRegistrationComparison
  } = await loadCrmSupportSnapshot({ force: options?.forceSupportRefresh === true });

  const transactionPhoneKeys = Array.from(
    new Set(
      [
        ...uniquePhones,
        ...Object.keys(registeredUsers || {})
      ]
        .map((phone) => getCustomerKey(phone))
        .filter(Boolean)
    )
  );
  const transactionStatsByPhone = await getMonthlyCustomerGiftStatsByPhonesRpc({
    monthKey: getUtcMonthKey(),
    phoneKeys: transactionPhoneKeys
  });
  const crmAnalytics = await getAdminCrmAnalyticsRpc();
  if (transactionStatsByPhone instanceof Map) {
    recordAdminRequest("crm transaction summary rpc", "rpc:get_monthly_customer_gift_stats_by_phones");
  }
  if (crmAnalytics?.source === "rpc") {
    recordAdminRequest("crm practical analytics rpc", "rpc:get_admin_crm_analytics");
  }

  return buildCustomersSnapshotFromSources({
    orders: safeOrders,
    loyalty,
    customerMeta,
    registeredUsers,
    loyaltyByPhone,
    transactionStatsByPhone,
    crmAnalytics,
    auditEnabled: !hasDateRange(options?.dateRange),
    supabaseProfileCount,
    memberRegistrationComparison
  });
}

export async function buildCustomersFromCrmAnalyticsAsync(options = {}) {
  const crmAnalytics = await getAdminCrmAnalyticsRpc();
  if (!crmAnalytics?.source || !Array.isArray(crmAnalytics.customers)) return null;

  const {
    loyalty,
    loyaltyByPhone,
    supabaseProfileCount,
    memberRegistrationComparison
  } = await loadCrmFastSupportSnapshot({ force: options?.forceSupportRefresh === true });

  if (crmAnalytics?.source === "rpc") {
    recordAdminRequest("crm practical analytics rpc", "rpc:get_admin_crm_analytics");
  }

  return buildCustomersSnapshotFromAnalytics({
    crmAnalytics,
    loyalty,
    loyaltyByPhone,
    supabaseProfileCount,
    memberRegistrationComparison
  });
}

export async function getCustomerLoyaltyDetailAsync(phone, { limit = 50, offset = 0 } = {}) {
  const key = getCustomerKey(phone);
  if (!key) return { rows: [], total: 0 };
  try {
    const [ledgerResult, accountResult] = await Promise.allSettled([
      coreSupabaseRepository.readLoyaltyLedgerByPhonePaged(key, { limit, offset }),
      coreSupabaseRepository.readLoyaltyAccountSummaryForPhoneFromTable(key)
    ]);
    const ledger = ledgerResult.status === "fulfilled" && ledgerResult.value
      ? ledgerResult.value
      : { rows: [], total: 0 };
    const account = accountResult.status === "fulfilled" && accountResult.value
      ? accountResult.value
      : null;
    return {
      rows: Array.isArray(ledger.rows) ? ledger.rows : [],
      total: Number(ledger.total || 0),
      accountTotalPoints: account ? Number(account.totalPoints || 0) : null,
      accountVouchers: Array.isArray(account?.voucherHistory)
        ? account.voucherHistory.map(normalizeCrmVoucher)
        : [],
      accountUpdatedAt: account?.updatedAt || ""
    };
  } catch {
    return { rows: [], total: 0 };
  }
}

async function loadCrmFastSupportSnapshot({ force = false } = {}) {
  const now = Date.now();
  if (!force && crmFastSupportCache.value && now - crmFastSupportCache.cachedAt < CRM_SUPPORT_CACHE_TTL_MS) {
    return crmFastSupportCache.value;
  }
  if (!force && crmFastSupportInFlight) return crmFastSupportInFlight;

  crmFastSupportInFlight = (async () => {
    const [
      loyaltyResult,
      loyaltyByPhoneResult,
      profileCountResult,
      memberRegistrationResult
    ] = await Promise.allSettled([
      loyaltyRepository.getCrmConfigAsync(defaultLoyaltyConfig),
      coreSupabaseRepository.readLoyaltyAccountsSummaryFromTable(),
      coreSupabaseRepository.readCustomerProfileCountFromTable(),
      getMemberRegistrationComparisonAsync()
    ]);
    recordAdminRequest("crm loyalty config", "app_configs");
    recordAdminRequest("crm loyalty summary", "loyalty_accounts");
    recordAdminRequest("crm profile count", "profiles");

    const snapshot = {
      loyalty: loyaltyResult.status === "fulfilled" ? loyaltyResult.value : defaultLoyaltyConfig,
      loyaltyByPhone: loyaltyByPhoneResult.status === "fulfilled" ? (loyaltyByPhoneResult.value || {}) : {},
      supabaseProfileCount: profileCountResult.status === "fulfilled" ? profileCountResult.value : null,
      memberRegistrationComparison: memberRegistrationResult.status === "fulfilled" ? memberRegistrationResult.value : null
    };

    if (loyaltyResult.status === "rejected") {
      console.error("[crmService] load fast loyalty config failed", loyaltyResult.reason);
    }
    if (loyaltyByPhoneResult.status === "rejected") {
      console.error("[crmService] load fast loyalty-by-phone failed", loyaltyByPhoneResult.reason);
    }
    if (profileCountResult.status === "rejected") {
      console.error("[crmService] load fast profile count failed", profileCountResult.reason);
    }
    if (memberRegistrationResult.status === "rejected") {
      console.error("[crmService] load fast member registration comparison failed", memberRegistrationResult.reason);
    }

    crmFastSupportCache = {
      value: snapshot,
      cachedAt: Date.now()
    };
    return snapshot;
  })();

  try {
    return await crmFastSupportInFlight;
  } finally {
    crmFastSupportInFlight = null;
  }
}

export async function getCustomerRecentOrdersAsync(phone, { limit = 100 } = {}) {
  const key = getCustomerKey(phone);
  if (!key) return [];

  const safeLimit = Math.max(3, Math.min(100, Number(limit || 100)));
  const [webResult, partnerResult] = await Promise.allSettled([
    coreSupabaseRepository.readOrdersForPhoneFromTable(key, { limit: safeLimit, includeItems: false }),
    readCustomerPartnerOrdersForAdmin(key, { limit: safeLimit, includeItems: false })
  ]);
  const webOrders = webResult.status === "fulfilled" && Array.isArray(webResult.value)
    ? webResult.value
    : [];
  const partnerOrders = partnerResult.status === "fulfilled" && Array.isArray(partnerResult.value)
    ? partnerResult.value
    : [];

  return dedupeOrdersByIdentity([...webOrders, ...partnerOrders])
    .sort((a, b) => getOrderTimeValue(b) - getOrderTimeValue(a))
    .slice(0, safeLimit);
}

function buildCustomersSnapshotFromSources({
  orders = [],
  loyalty = defaultLoyaltyConfig,
  customerMeta = {},
  registeredUsers = {},
  loyaltyByPhone = {},
  transactionStatsByPhone = null,
  crmAnalytics = null,
  auditEnabled = false,
  supabaseProfileCount = null,
  memberRegistrationComparison = null
}) {
  const normalizedLoyaltyConfig = normalizeLoyaltyProgramConfig({
    ...(loyalty || {}),
    byPhone: { ...(loyalty?.byPhone || {}) }
  });
  const ratio = {
    currencyPerPoint: Math.max(1, Number(normalizedLoyaltyConfig.currencyPerPoint || defaultLoyaltyConfig.currencyPerPoint)),
    pointPerUnit: Math.max(1, Number(normalizedLoyaltyConfig.pointPerUnit || defaultLoyaltyConfig.pointPerUnit))
  };

  const grouped = orders.reduce((acc, order) => {
    const phone = getCustomerKey(order.customerPhone || order.phone || "");
    if (!phone) return acc;
    if (shouldExcludeCrmOrder(order)) return acc;
    const orderName = order.orderCustomerName || order.customerName || customerMeta[phone]?.name || "Khách";
    const current = acc[phone] || {
      phone,
      name: orderName,
      lastOrderName: orderName,
      ...EMPTY_ORDER_COUNT_SUMMARY,
      loyaltyQualifyingSpend: 0,
      lastOrderAt: null,
      orders: []
    };
    const nextSummary = appendOrderCountSummary(
      current,
      toOrderCountingNumber(order.totalAmount ?? order.total, 0),
      1
    );
    current.totalOrders = nextSummary.totalOrders;
    current.totalSpent = nextSummary.totalSpent;
    const isPartnerOrder = String(order?.sourceType || "").toLowerCase() === "partner" || Boolean(order?.partnerSource);
    const loyaltyQualifyingAmount = isPartnerOrder
      ? toOrderCountingNumber(order?.loyaltyEligibleAmount ?? order?.netReceivedAmount, 0)
      : toOrderCountingNumber(order?.totalAmount ?? order?.total, 0);
    current.loyaltyQualifyingSpend = toOrderCountingNumber(current.loyaltyQualifyingSpend, 0) + loyaltyQualifyingAmount;
    current.orders.push(order);
    if (!current.lastOrderAt || new Date(order.createdAt || 0) > new Date(current.lastOrderAt || 0)) {
      current.lastOrderAt = order.createdAt || null;
      current.lastOrderName = orderName || current.lastOrderName;
      current.name = orderName || current.name;
    }
    acc[phone] = current;
    return acc;
  }, {});

  const allPhones = Array.from(
    new Set(
      [
        ...Object.keys(grouped || {}),
        ...Object.keys(registeredUsers || {})
      ]
        .map((phone) => getCustomerKey(phone))
        .filter(Boolean)
    )
  );

  const customers = allPhones
    .map((phone) => {
      const registeredUser = registeredUsers[phone] || {};
      const crmAnalyticsCustomer = crmAnalytics?.customersByPhone instanceof Map
        ? crmAnalytics.customersByPhone.get(phone)
        : null;
      const customer = grouped[phone] || {
        phone,
        name: registeredUser?.name || customerMeta?.[phone]?.name || "",
        lastOrderName: "",
        ...EMPTY_ORDER_COUNT_SUMMARY,
        loyaltyQualifyingSpend: 0,
        lastOrderAt: registeredUser?.metadata?.lastOrderAt || registeredUser?.updatedAt || null,
        orders: []
      };
      const rpcStats = transactionStatsByPhone instanceof Map
        ? transactionStatsByPhone.get(phone)?.allTimeStats
        : null;
      const transactionSummarySource = rpcStats ? "rpc" : "client-fallback";
      const clientTotalOrders = toOrderCountingNumber(customer.totalOrders, 0);
      const clientTotalSpent = toOrderCountingNumber(customer.totalSpent, 0);
      const totalOrders = toOrderCountingNumber(rpcStats?.totalOrders ?? clientTotalOrders, 0);
      const totalSpent = toOrderCountingNumber(rpcStats?.totalSpent ?? clientTotalSpent, 0);
      const loyaltyQualifyingSpend = toOrderCountingNumber(customer.loyaltyQualifyingSpend, 0);
      const rpcTotalOrders = rpcStats ? toOrderCountingNumber(rpcStats.totalOrders, 0) : null;
      const rpcTotalSpent = rpcStats ? toOrderCountingNumber(rpcStats.totalSpent, 0) : null;
      const transactionAudit = {
        compared: Boolean(auditEnabled && rpcStats),
        clientTotalOrders,
        clientTotalSpent,
        rpcTotalOrders,
        rpcTotalSpent,
        orderDifference: rpcStats ? rpcTotalOrders - clientTotalOrders : null,
        spentDifference: rpcStats ? rpcTotalSpent - clientTotalSpent : null
      };
      transactionAudit.mismatch = Boolean(
        transactionAudit.compared &&
        (transactionAudit.orderDifference !== 0 || transactionAudit.spentDifference !== 0)
      );
      const lastOrderAt = crmAnalyticsCustomer?.lastOrderAt || customer.lastOrderAt || registeredUser?.metadata?.lastOrderAt || registeredUser?.updatedAt || null;
      const autoPoints = Math.floor((loyaltyQualifyingSpend / ratio.currencyPerPoint) * ratio.pointPerUnit);
      const phoneLoyalty = normalizeLoyaltyData({
        ...defaultLoyaltyData,
        ...(loyaltyByPhone[customer.phone] || {})
      });
      const orderEarnedPoints = sumPointsByTypes(phoneLoyalty.pointHistory, ["ORDER_EARN", "PARTNER_ORDER_EARN", "ORDER_EARN_REVERSED"]);
      const checkinAndRewardPoints = sumPointsByTypes(phoneLoyalty.pointHistory, ["CHECKIN", "CHECKIN_V2", "MILESTONE"]);
      const spentPointsRaw = sumPointsByType(phoneLoyalty.pointHistory, (type) => type === "ORDER_SPEND" || type === "ORDER_SPEND_REVERSED");
      const spentPoints = Math.max(0, Math.abs(Number(spentPointsRaw || 0)));
      const otherAdjustPoints = sumPointsByType(phoneLoyalty.pointHistory, (type) => !["ORDER_EARN", "PARTNER_ORDER_EARN", "ORDER_EARN_REVERSED", "CHECKIN", "CHECKIN_V2", "MILESTONE", "ORDER_SPEND", "ORDER_SPEND_REVERSED"].includes(type));
      const totalFromHistory = sumLoyaltyPointBalance(phoneLoyalty.pointHistory);
      const hasPointHistory = (phoneLoyalty.pointHistory || []).length > 0;
      const currentPoints = Math.max(0, Number(hasPointHistory ? totalFromHistory : (phoneLoyalty.totalPoints || 0)));
      const bonusPointsFromHistory = checkinAndRewardPoints + otherAdjustPoints - spentPoints;
      const unifiedVouchers = [
        ...(Array.isArray(phoneLoyalty.voucherHistory) ? phoneLoyalty.voucherHistory : [])
      ].map(normalizeCrmVoucher);
      const resolvedVouchers = resolveVoucherUsageFromOrders(unifiedVouchers, customer.orders || []);
      const registeredCustomerName = registeredUser?.name || "";
      const metaName = String(customerMeta?.[customer.phone]?.name || "").trim();
      const displayName = registeredCustomerName || customer.name || customer.lastOrderName || metaName || "Khách";
      const nameMismatch = Boolean(
        registeredCustomerName &&
        customer.lastOrderName &&
        normalizeName(registeredCustomerName) !== normalizeName(customer.lastOrderName)
      );

      return {
        ...customer,
        ...(crmAnalyticsCustomer || {}),
        totalOrders,
        totalSpent,
        loyaltyQualifyingSpend,
        transactionSummarySource,
        transactionAudit,
        lastOrderAt,
        name: displayName,
        registeredCustomerName,
        orderCustomerName: customer.lastOrderName,
        nameMismatch,
        autoPoints: orderEarnedPoints || autoPoints,
        manualAdjust: hasPointHistory
          ? bonusPointsFromHistory
          : Number(currentPoints || 0) - Number(orderEarnedPoints || 0),
        checkinAndRewardPoints,
        spentPoints,
        otherAdjustPoints,
        currentPoints,
        registeredCustomer: Boolean(
          registeredUser?.authUserId ||
          registeredUser?.registered ||
          registeredUser?.passwordDemo ||
          registeredUser?.email
        ),
        tier: getCustomerTier(loyaltyQualifyingSpend, normalizedLoyaltyConfig),
        daysSinceLastOrder: getDaysSince(lastOrderAt),
        vouchers: resolvedVouchers,
        pointsHistory: phoneLoyalty.pointHistory
      };
    })
    .sort((a, b) => new Date(b.lastOrderAt || 0) - new Date(a.lastOrderAt || 0));

  const rpcCustomerCount = customers.filter((customer) => customer.transactionSummarySource === "rpc").length;
  const comparedCustomers = customers.filter((customer) => customer.transactionAudit?.compared);
  const mismatchedCustomers = comparedCustomers.filter((customer) => customer.transactionAudit?.mismatch);
  const profilePhones = new Set(Object.keys(registeredUsers || {}).map((phone) => getCustomerKey(phone)).filter(Boolean));
  const transactionPhones = Object.keys(grouped || {}).map((phone) => getCustomerKey(phone)).filter(Boolean);
  const loyaltyPhones = Object.keys(loyaltyByPhone || {}).map((phone) => getCustomerKey(phone)).filter(Boolean);
  const missingProfileFromOrders = transactionPhones.filter((phone) => !profilePhones.has(phone));
  const missingProfileFromLoyalty = loyaltyPhones.filter((phone) => !profilePhones.has(phone));
  const profileOnlyCustomers = customers.filter((customer) => !grouped[customer.phone]);
  const staleLoyaltyBalanceCount = customers.filter((customer) => {
    const phoneLoyalty = normalizeLoyaltyData({
      ...defaultLoyaltyData,
      ...(loyaltyByPhone[customer.phone] || {})
    });
    const historyBalance = sumLoyaltyPointBalance(phoneLoyalty.pointHistory);
    return phoneLoyalty.pointHistory?.length > 0 &&
      Number(phoneLoyalty.totalPoints || 0) !== Number(historyBalance || 0);
  }).length;
  return {
    customers,
    crmAnalytics,
    loyaltyConfig: normalizedLoyaltyConfig,
    supabaseProfileCount,
    transactionSummary: {
      source: rpcCustomerCount === customers.length && customers.length > 0
        ? "rpc"
        : rpcCustomerCount > 0
          ? "mixed"
          : "client-fallback",
      rpcCustomerCount,
      fallbackCustomerCount: customers.length - rpcCustomerCount
    },
    transactionAudit: {
      enabled: auditEnabled,
      comparedCustomerCount: comparedCustomers.length,
      mismatchCustomerCount: mismatchedCustomers.length,
      matchedCustomerCount: comparedCustomers.length - mismatchedCustomers.length
    },
    dataHealth: {
      profileCustomerCount: profilePhones.size,
      transactionCustomerCount: transactionPhones.length,
      loyaltyCustomerCount: loyaltyPhones.length,
      profileOnlyCustomerCount: profileOnlyCustomers.length,
      missingProfileFromOrdersCount: missingProfileFromOrders.length,
      missingProfileFromLoyaltyCount: missingProfileFromLoyalty.length,
      transactionFallbackCustomerCount: customers.length - rpcCustomerCount,
      staleLoyaltyBalanceCount
    }
  };
}

function buildCustomersSnapshotFromAnalytics({
  crmAnalytics = null,
  loyalty = defaultLoyaltyConfig,
  loyaltyByPhone = {},
  supabaseProfileCount = null,
  memberRegistrationComparison = null
}) {
  const normalizedLoyaltyConfig = normalizeLoyaltyProgramConfig({
    ...(loyalty || {}),
    byPhone: { ...(loyalty?.byPhone || {}) }
  });
  const loyaltyPhones = Object.keys(loyaltyByPhone || {}).map((phone) => getCustomerKey(phone)).filter(Boolean);
  const customers = (crmAnalytics?.customers || [])
    .map((analyticsCustomer) => {
      const phone = getCustomerKey(analyticsCustomer?.phone || "");
      if (!phone) return null;
      const phoneLoyalty = normalizeLoyaltyData({
        ...defaultLoyaltyData,
        ...(loyaltyByPhone[phone] || {})
      });
      const totalOrders = toOrderCountingNumber(analyticsCustomer.totalOrders, 0);
      const totalSpent = toOrderCountingNumber(analyticsCustomer.totalSpent, 0);
      const currentPoints = Math.max(0, Number(phoneLoyalty.totalPoints || 0));
      const displayName = String(analyticsCustomer.name || "").trim() || "Khách";
      return {
        phone,
        name: displayName,
        lastOrderName: displayName,
        registeredCustomerName: displayName,
        orderCustomerName: displayName,
        profileSource: analyticsCustomer.profileSource || "profile",
        totalOrders,
        rawOrderCount: toOrderCountingNumber(analyticsCustomer.rawOrderCount, totalOrders),
        totalSpent,
        loyaltyQualifyingSpend: totalSpent,
        transactionSummarySource: "rpc",
        transactionAudit: {
          compared: false,
          clientTotalOrders: totalOrders,
          clientTotalSpent: totalSpent,
          rpcTotalOrders: totalOrders,
          rpcTotalSpent: totalSpent,
          orderDifference: 0,
          spentDifference: 0,
          mismatch: false
        },
        firstOrderAt: analyticsCustomer.firstOrderAt || null,
        lastOrderAt: analyticsCustomer.lastOrderAt || phoneLoyalty.lastPurchaseAt || null,
        lastBranch: analyticsCustomer.lastBranch || "Chưa xác định",
        lastChannel: analyticsCustomer.lastChannel || "website",
        orders30Days: Number(analyticsCustomer.orders30Days || 0),
        isVip: Boolean(analyticsCustomer.isVip),
        voucherSegment: analyticsCustomer.voucherSegment || "none",
        autoPoints: 0,
        manualAdjust: currentPoints,
        checkinAndRewardPoints: 0,
        spentPoints: 0,
        otherAdjustPoints: 0,
        currentPoints,
        registeredCustomer: true,
        tier: getCustomerTier(totalSpent, normalizedLoyaltyConfig),
        daysSinceLastOrder: analyticsCustomer.daysSinceLastOrder,
        vouchers: (Array.isArray(phoneLoyalty.voucherHistory) ? phoneLoyalty.voucherHistory : []).map(normalizeCrmVoucher),
        pointsHistory: [],
        orders: []
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.lastOrderAt || 0) - new Date(a.lastOrderAt || 0));

  const customersWithOrders = Number(crmAnalytics?.summary?.customersWithOrders || customers.filter((customer) => Number(customer.totalOrders || 0) > 0).length);
  const profileCustomerCount = supabaseProfileCount === null || supabaseProfileCount === undefined
    ? Number(crmAnalytics?.summary?.totalCustomers || customers.length)
    : Number(supabaseProfileCount);

  return {
    customers,
    crmAnalytics,
    loyaltyConfig: normalizedLoyaltyConfig,
    supabaseProfileCount,
    memberRegistrationComparison,
    transactionSummary: {
      source: "rpc",
      rpcCustomerCount: customers.length,
      fallbackCustomerCount: 0
    },
    transactionAudit: {
      enabled: false,
      comparedCustomerCount: 0,
      mismatchCustomerCount: 0,
      matchedCustomerCount: 0
    },
    dataHealth: {
      profileCustomerCount,
      transactionCustomerCount: customersWithOrders,
      loyaltyCustomerCount: loyaltyPhones.length,
      profileOnlyCustomerCount: Math.max(0, profileCustomerCount - customersWithOrders),
      missingProfileFromOrdersCount: 0,
      missingProfileFromLoyaltyCount: 0,
      transactionFallbackCustomerCount: 0,
      staleLoyaltyBalanceCount: 0
    }
  };
}

export async function giftVoucherToCustomer(phone, voucherTitle = "Voucher demo 10.000đ") {
  const key = getCustomerKey(phone);
  if (!key) return null;
  const sourceVoucher = typeof voucherTitle === "object" && voucherTitle ? voucherTitle : null;
  const current = normalizeLoyaltyData({
    ...defaultLoyaltyData,
    ...(await loyaltyRepository.getByPhoneAsync(key, {
      ...defaultLoyaltyData,
      phone: key
    }))
  });
  const today = getDateKey(new Date());
  const nextVoucher = normalizeCrmVoucher({
    id: `crm-voucher-${Date.now()}`,
    type: "CRM_GIFT",
    couponId: sourceVoucher?.id || "",
    code: String(sourceVoucher?.code || "").trim().toUpperCase(),
    discountType: sourceVoucher?.discountType || "fixed",
    value: sourceVoucher?.value ?? 0,
    maxDiscount: sourceVoucher?.maxDiscount ?? 0,
    minOrder: sourceVoucher?.minOrder ?? 0,
    title: sourceVoucher?.name || sourceVoucher?.title || voucherTitle,
    createdAt: today,
    used: false,
    expiredAt: sourceVoucher?.endAt || sourceVoucher?.expiry || addDaysToDateKey(today, 7)
  });
  const next = normalizeLoyaltyData({
    ...current,
    phone: key,
    voucherHistory: [nextVoucher, ...(current.voucherHistory || [])]
  });
  await loyaltyRepository.saveByPhoneAsync(key, next, defaultLoyaltyData);
  return next;
}

export async function cancelCustomerVoucher(phone, voucherRef) {
  const key = getCustomerKey(phone);
  if (!key || !voucherRef) return null;

  const targetId = String(
    typeof voucherRef === "object" && voucherRef
      ? voucherRef.id || ""
      : voucherRef || ""
  ).trim();
  const targetCode = String(
    typeof voucherRef === "object" && voucherRef
      ? voucherRef.code || ""
      : ""
  ).trim().toUpperCase();
  const targetCreatedAt = String(
    typeof voucherRef === "object" && voucherRef
      ? voucherRef.createdAt || ""
      : ""
  ).trim();

  const current = normalizeLoyaltyData(
    await loyaltyRepository.getByPhoneAsync(key, {
      ...defaultLoyaltyData,
      phone: key
    })
  );

  let updated = false;
  const next = normalizeLoyaltyData({
    ...current,
    phone: key,
    voucherHistory: (current.voucherHistory || []).map((voucher) => {
      const voucherId = String(voucher?.id || "").trim();
      const voucherCode = String(voucher?.code || "").trim().toUpperCase();
      const voucherCreatedAt = String(voucher?.createdAt || "").trim();
      const idMatched = targetId && voucherId && voucherId === targetId;
      const codeCreatedMatched =
        !idMatched &&
        targetCode &&
        voucherCode &&
        voucherCode === targetCode &&
        (!targetCreatedAt || !voucherCreatedAt || voucherCreatedAt === targetCreatedAt);
      if (!idMatched && !codeCreatedMatched) return voucher;
      updated = true;
      return {
        ...voucher,
        canceled: true,
        canceledAt: new Date().toISOString()
      };
    })
  });

  if (!updated) {
    return current;
  }

  await loyaltyRepository.saveByPhoneAsync(key, next, defaultLoyaltyData);
  return next;
}


