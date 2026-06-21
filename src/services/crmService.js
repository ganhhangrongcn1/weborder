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
import { getDataSource } from "./repositories/dataSource.js";
import { activateLoyaltyRuleVersion, normalizeLoyaltyRuleVersionPayload } from "./loyaltyRuleVersionService.js";
import { hasDateRange } from "../utils/adminDateRange.js";
import {
  calculateOrderPoints,
  defaultLoyaltyData,
  getLoyaltyRuleConfig,
  normalizeLoyaltyData,
  resolveVoucherUsageFromOrders
} from "./loyaltyService.js";
export const CRM_CUSTOMERS_KEY = "ghr_customers";
export const CRM_LOYALTY_KEY = "ghr_loyalty";

const defaultLoyaltyConfig = {
  currencyPerPoint: 100,
  pointPerUnit: 1,
  checkinDailyPoints: 100,
  streakRewards: {
    7: 700,
    14: 1500,
    30: 3000
  },
  redeemPointUnit: 1,
  redeemValue: 1,
  byPhone: {}
};
const CRM_SUPPORT_CACHE_TTL_MS = 60000;
let crmSupportCache = { value: null, cachedAt: 0 };
let crmSupportInFlight = null;

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

function getPhoneRecord(allByPhone, phone) {
  const key = getCustomerKey(phone);
  return allByPhone[key] || { manualAdjust: 0, vouchers: [], updatedAt: null };
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

export function loadCustomersMeta() {
  return customerRepository.getCustomersMeta();
}

export function saveCustomersMeta(next) {
  return customerRepository.saveCustomersMeta(next || {});
}

export function loadLoyaltyConfig() {
  const saved = loyaltyRepository.getCrmConfig(defaultLoyaltyConfig);
  return {
    ...defaultLoyaltyConfig,
    ...(saved || {}),
    byPhone: { ...(saved?.byPhone || {}) }
  };
}

function normalizeLoyaltyConfigInput(next) {
  const incomingStreakRewards = next?.streakRewards || {};
  return {
    ...defaultLoyaltyConfig,
    ...(next || {}),
    ...normalizeLoyaltyRuleVersionPayload(next),
    streakRewards: {
      7: Math.max(1, Number(incomingStreakRewards?.[7] || incomingStreakRewards?.["7"] || defaultLoyaltyConfig.streakRewards[7])),
      14: Math.max(1, Number(incomingStreakRewards?.[14] || incomingStreakRewards?.["14"] || defaultLoyaltyConfig.streakRewards[14])),
      30: Math.max(1, Number(incomingStreakRewards?.[30] || incomingStreakRewards?.["30"] || defaultLoyaltyConfig.streakRewards[30]))
    },
    byPhone: { ...(next?.byPhone || {}) }
  };
}

export function saveLoyaltyConfig(next) {
  const normalized = normalizeLoyaltyConfigInput(next);
  return loyaltyRepository.saveCrmConfig(normalized);
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
      profileCountResult
    ] = await Promise.allSettled([
      loyaltyRepository.getCrmConfigAsync(defaultLoyaltyConfig),
      customerRepository.getCustomersMetaAsync(),
      customerRepository.getUsersAsync(),
      coreSupabaseRepository.readLoyaltyAccountsSummaryFromTable(),
      coreSupabaseRepository.readCustomerProfileCountFromTable()
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
      supabaseProfileCount: profileCountResult.status === "fulfilled" ? profileCountResult.value : null
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

export function getCustomerTier(totalSpent = 0) {
  const amount = Number(totalSpent || 0);
  if (amount >= 5000000) return "Kim cương";
  if (amount >= 2500000) return "Vàng";
  if (amount >= 1000000) return "Bạc";
  return "Đồng";
}

export function buildCustomersFromOrders(orderStorage) {
  const orders = orderStorage?.getAll?.() || [];
  const loyalty = loadLoyaltyConfig();
  const customerMeta = loadCustomersMeta();
  const registeredUsers = customerRepository.getUsers();
  const loyaltyByPhone = loyaltyRepository.getAllByPhone();
  return buildCustomersSnapshotFromSources({
    orders,
    loyalty,
    customerMeta,
    registeredUsers,
    loyaltyByPhone
  });
}

export async function buildCustomersFromOrdersAsync(orderStorage, options = {}) {
  const dateRange = options?.dateRange || {};
  const webOrders = await orderStorage?.getAllAsync?.(dateRange) || [];
  const partnerOrders = await readPartnerOrdersForAdmin(dateRange);
  const orders = [
    ...(Array.isArray(webOrders) ? webOrders : []),
    ...(Array.isArray(partnerOrders) ? partnerOrders : [])
  ];
  return buildCustomersFromOrderListAsync(orders, orderStorage, options);
}

export async function buildCustomersFromOrderListAsync(orders = [], orderStorage, options = {}) {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const {
    loyalty,
    customerMeta,
    registeredUsers,
    loyaltyByPhone,
    supabaseProfileCount
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
    supabaseProfileCount
  });
}

export async function getCustomerLoyaltyDetailAsync(phone, { limit = 50, offset = 0 } = {}) {
  const key = getCustomerKey(phone);
  if (!key) return { rows: [], total: 0 };
  try {
    return await coreSupabaseRepository.readLoyaltyLedgerByPhonePaged(key, { limit, offset });
  } catch {
    return { rows: [], total: 0 };
  }
}

export async function getCustomerRecentOrdersAsync(phone, { limit = 100 } = {}) {
  const key = getCustomerKey(phone);
  if (!key) return [];

  const safeLimit = Math.max(3, Math.min(100, Number(limit || 100)));
  const [webResult, partnerResult] = await Promise.allSettled([
    coreSupabaseRepository.readOrdersForPhoneFromTable(key),
    readCustomerPartnerOrdersForAdmin(key, { limit: safeLimit })
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
  supabaseProfileCount = null
}) {
  const normalizedLoyaltyConfig = {
    ...defaultLoyaltyConfig,
    ...(loyalty || {}),
    byPhone: { ...(loyalty?.byPhone || {}) }
  };
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
      const autoPoints = Math.floor((Number(totalSpent || 0) / ratio.currencyPerPoint) * ratio.pointPerUnit);
      const phoneLoyalty = normalizeLoyaltyData({
        ...defaultLoyaltyData,
        ...(loyaltyByPhone[customer.phone] || {})
      });
      const orderEarnedPoints = sumPointsByTypes(phoneLoyalty.pointHistory, ["ORDER_EARN", "PARTNER_ORDER_EARN", "ORDER_EARN_REVERSED"]);
      const checkinAndRewardPoints = sumPointsByTypes(phoneLoyalty.pointHistory, ["CHECKIN", "CHECKIN_V2", "MILESTONE"]);
      const spentPointsRaw = sumPointsByType(phoneLoyalty.pointHistory, (type) => type === "ORDER_SPEND" || type === "ORDER_SPEND_REVERSED");
      const spentPoints = Math.max(0, Math.abs(Number(spentPointsRaw || 0)));
      const otherAdjustPoints = sumPointsByType(phoneLoyalty.pointHistory, (type) => !["ORDER_EARN", "PARTNER_ORDER_EARN", "ORDER_EARN_REVERSED", "CHECKIN", "CHECKIN_V2", "MILESTONE", "ORDER_SPEND", "ORDER_SPEND_REVERSED"].includes(type));
      const totalFromHistory = (phoneLoyalty.pointHistory || []).reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
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
        tier: getCustomerTier(totalSpent),
        daysSinceLastOrder: getDaysSince(lastOrderAt),
        vouchers: resolvedVouchers,
        pointsHistory: phoneLoyalty.pointHistory
      };
    })
    .sort((a, b) => new Date(b.lastOrderAt || 0) - new Date(a.lastOrderAt || 0));

  const rpcCustomerCount = customers.filter((customer) => customer.transactionSummarySource === "rpc").length;
  const comparedCustomers = customers.filter((customer) => customer.transactionAudit?.compared);
  const mismatchedCustomers = comparedCustomers.filter((customer) => customer.transactionAudit?.mismatch);
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
    }
  };
}

export function adjustCustomerPoints(phone, deltaPoints) {
  if (getDataSource() === "supabase") {
    throw new Error("Điều chỉnh điểm kiểu cũ đã bị tắt trong chế độ Supabase.");
  }
  const key = getCustomerKey(phone);
  if (!key) return loadLoyaltyConfig();
  const loyalty = loadLoyaltyConfig();
  const current = getPhoneRecord(loyalty.byPhone, key);
  const next = {
    ...loyalty,
    byPhone: {
      ...loyalty.byPhone,
      [key]: {
        ...current,
        manualAdjust: Number(current.manualAdjust || 0) + Number(deltaPoints || 0),
        updatedAt: new Date().toISOString()
      }
    }
  };
  return saveLoyaltyConfig(next);
}

export function resetCustomerPoints(phone, autoPoints = 0) {
  if (getDataSource() === "supabase") {
    throw new Error("Reset điểm kiểu cũ đã bị tắt trong chế độ Supabase.");
  }
  const key = getCustomerKey(phone);
  if (!key) return loadLoyaltyConfig();
  const loyalty = loadLoyaltyConfig();
  const current = getPhoneRecord(loyalty.byPhone, key);
  const next = {
    ...loyalty,
    byPhone: {
      ...loyalty.byPhone,
      [key]: {
        ...current,
        manualAdjust: -Math.max(0, Number(autoPoints || 0)),
        updatedAt: new Date().toISOString()
      }
    }
  };
  return saveLoyaltyConfig(next);
}

export async function giftVoucherToCustomer(phone, voucherTitle = "Voucher demo 10.000đ") {
  const key = getCustomerKey(phone);
  if (!key) return null;
  const sourceVoucher = typeof voucherTitle === "object" && voucherTitle ? voucherTitle : null;
  const allByPhone = loyaltyRepository.getAllByPhone();
  const current = normalizeLoyaltyData({
    ...defaultLoyaltyData,
    ...(allByPhone[key] || {})
  });
  const today = getDateKey(new Date());
  const nextVoucher = normalizeCrmVoucher({
    id: `crm-voucher-${Date.now()}`,
    type: "CRM_GIFT",
    couponId: sourceVoucher?.id || "",
    code: sourceVoucher?.code || "",
    discountType: sourceVoucher?.discountType || "",
    value: sourceVoucher?.value ?? "",
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


