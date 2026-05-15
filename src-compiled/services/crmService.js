import { getCustomerKey } from "./storageService.js";
import { customerRepository } from "./repositories/customerRepository.js";
import { loyaltyRepository } from "./repositories/loyaltyRepository.js";
import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";
import {
  calculateOrderPoints,
  defaultLoyaltyData,
  getLoyaltyRuleConfig,
  normalizeLoyaltyData,
  reconcileLoyaltyFromOrders,
  resolveVoucherUsageFromOrders
} from "./loyaltyService.js";

export const CRM_CUSTOMERS_KEY = "ghr_customers";
export const CRM_LOYALTY_KEY = "ghr_loyalty";

const defaultLoyaltyConfig = {
  currencyPerPoint: 1000,
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

export function saveLoyaltyConfig(next) {
  const incomingStreakRewards = next?.streakRewards || {};
  const normalized = {
    ...defaultLoyaltyConfig,
    ...(next || {}),
    currencyPerPoint: Math.max(1, Number(next?.currencyPerPoint || defaultLoyaltyConfig.currencyPerPoint)),
    pointPerUnit: Math.max(1, Number(next?.pointPerUnit || defaultLoyaltyConfig.pointPerUnit)),
    checkinDailyPoints: Math.max(1, Number(next?.checkinDailyPoints || defaultLoyaltyConfig.checkinDailyPoints)),
    redeemPointUnit: Math.max(1, Number(next?.redeemPointUnit || defaultLoyaltyConfig.redeemPointUnit)),
    redeemValue: Math.max(1, Number(next?.redeemValue || defaultLoyaltyConfig.redeemValue)),
    streakRewards: {
      7: Math.max(1, Number(incomingStreakRewards?.[7] || incomingStreakRewards?.["7"] || defaultLoyaltyConfig.streakRewards[7])),
      14: Math.max(1, Number(incomingStreakRewards?.[14] || incomingStreakRewards?.["14"] || defaultLoyaltyConfig.streakRewards[14])),
      30: Math.max(1, Number(incomingStreakRewards?.[30] || incomingStreakRewards?.["30"] || defaultLoyaltyConfig.streakRewards[30]))
    },
    byPhone: { ...(next?.byPhone || {}) }
  };
  return loyaltyRepository.saveCrmConfig(normalized);
}

function sumNumericPoints(entries = []) {
  return entries.reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
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
  const uniquePhones = Array.from(
    new Set(
      orders
        .map((order) => getCustomerKey(order.customerPhone || order.phone || ""))
        .filter(Boolean)
    )
  );
  uniquePhones.forEach((phone) => {
    reconcileLoyaltyFromOrders(phone, orderStorage);
  });
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
  const orders = await orderStorage?.getAllAsync?.(options?.dateRange || {}) || [];
  const uniquePhones = Array.from(
    new Set(
      orders
        .map((order) => getCustomerKey(order.customerPhone || order.phone || ""))
        .filter(Boolean)
    )
  );
  const shouldReconcile = options?.skipReconcile !== true;
  if (shouldReconcile) {
    uniquePhones.forEach((phone) => {
      try {
        reconcileLoyaltyFromOrders(phone, orderStorage);
      } catch (error) {
        console.error("[crmService] reconcile loyalty failed", { phone, error });
      }
    });
  }

  const [
    loyaltyResult,
    customerMetaResult,
    registeredUsersResult,
    loyaltyByPhoneResult
  ] = await Promise.allSettled([
    loyaltyRepository.getCrmConfigAsync(defaultLoyaltyConfig),
    customerRepository.getCustomersMetaAsync(),
    customerRepository.getUsersAsync(),
    coreSupabaseRepository.readLoyaltyAccountsSummaryFromTable()
  ]);

  const loyalty = loyaltyResult.status === "fulfilled" ? loyaltyResult.value : defaultLoyaltyConfig;
  const customerMeta = customerMetaResult.status === "fulfilled" ? customerMetaResult.value : {};
  const registeredUsers = registeredUsersResult.status === "fulfilled" ? registeredUsersResult.value : {};
  const loyaltyByPhone = loyaltyByPhoneResult.status === "fulfilled" ? (loyaltyByPhoneResult.value || {}) : {};

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

  return buildCustomersSnapshotFromSources({
    orders,
    loyalty,
    customerMeta,
    registeredUsers,
    loyaltyByPhone
  });
}

export async function getCustomerLoyaltyDetailAsync(phone, { limit = 50, offset = 0 } = {}) {
  const key = getCustomerKey(phone);
  if (!key) return { rows: [], total: 0 };
  try {
    return await coreSupabaseRepository.readLoyaltyLedgerByPhonePaged(key, { limit, offset });
  } catch (_error) {
    return { rows: [], total: 0 };
  }
}

function buildCustomersSnapshotFromSources({
  orders = [],
  loyalty = defaultLoyaltyConfig,
  customerMeta = {},
  registeredUsers = {},
  loyaltyByPhone = {}
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
    const orderName = order.orderCustomerName || order.customerName || customerMeta[phone]?.name || "Khách";
    const current = acc[phone] || {
      phone,
      name: orderName,
      lastOrderName: orderName,
      totalOrders: 0,
      totalSpent: 0,
      lastOrderAt: null,
      orders: []
    };
    current.totalOrders += 1;
    current.totalSpent += Number(order.totalAmount || order.total || 0);
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
    new Set([
      ...Object.keys(grouped || {}),
      ...Object.keys(registeredUsers || {}),
      ...Object.keys(customerMeta || {}),
      ...Object.keys(loyaltyByPhone || {}),
      ...Object.keys(loyalty?.byPhone || {})
    ])
  )
    .map((phone) => getCustomerKey(phone))
    .filter(Boolean);

  const customers = allPhones
    .map((phone) => {
      const customer = grouped[phone] || {
        phone,
        name: customerMeta?.[phone]?.name || "",
        lastOrderName: "",
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: null,
        orders: []
      };
      const autoPoints = Math.floor((Number(customer.totalSpent || 0) / ratio.currencyPerPoint) * ratio.pointPerUnit);
      const phoneRecord = getPhoneRecord(normalizedLoyaltyConfig.byPhone, customer.phone);
      const phoneLoyalty = normalizeLoyaltyData({
        ...defaultLoyaltyData,
        ...(loyaltyByPhone[customer.phone] || {})
      });
      const orderEarnedPoints = sumPointsByType(phoneLoyalty.pointHistory, (type) => type === "ORDER_EARN");
      const checkinAndRewardPoints = sumPointsByTypes(phoneLoyalty.pointHistory, ["CHECKIN", "MILESTONE"]);
      const spentPointsRaw = sumPointsByType(phoneLoyalty.pointHistory, (type) => type === "ORDER_SPEND");
      const spentPoints = Math.abs(Math.min(0, Number(spentPointsRaw || 0)));
      const otherAdjustPoints = sumPointsByType(phoneLoyalty.pointHistory, (type) => !["ORDER_EARN", "CHECKIN", "MILESTONE", "ORDER_SPEND"].includes(type));
      const totalFromHistory = (phoneLoyalty.pointHistory || []).reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
      const currentPoints = Math.max(0, Number((phoneLoyalty.pointHistory || []).length ? totalFromHistory : (phoneLoyalty.totalPoints || autoPoints || 0)));
      const bonusPointsFromHistory = checkinAndRewardPoints + otherAdjustPoints - spentPoints;
      const unifiedVouchers = [
        ...(Array.isArray(phoneLoyalty.voucherHistory) ? phoneLoyalty.voucherHistory : [])
      ].map(normalizeCrmVoucher);
      const resolvedVouchers = resolveVoucherUsageFromOrders(unifiedVouchers, customer.orders || []);
      const lastOrderAt = customer.lastOrderAt;
      const registeredUser = registeredUsers[customer.phone];
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
        name: displayName,
        registeredCustomerName,
        orderCustomerName: customer.lastOrderName,
        nameMismatch,
        autoPoints: orderEarnedPoints || autoPoints,
        manualAdjust: (phoneLoyalty.pointHistory || []).length
          ? bonusPointsFromHistory
          : Number(currentPoints || 0) - Number(orderEarnedPoints || autoPoints || 0),
        checkinAndRewardPoints,
        spentPoints,
        otherAdjustPoints,
        currentPoints,
        registeredCustomer: Boolean(
          registeredUser?.registered ||
          registeredUser?.passwordDemo ||
          registeredUser?.email
        ),
        tier: getCustomerTier(customer.totalSpent),
        daysSinceLastOrder: getDaysSince(lastOrderAt),
        vouchers: resolvedVouchers,
        pointsHistory: phoneLoyalty.pointHistory.length ? phoneLoyalty.pointHistory : [{
          type: "AUTO_FROM_ORDER",
          points: autoPoints,
          note: `Tự cộng từ ${customer.totalOrders} đơn`,
          createdAt: lastOrderAt || new Date().toISOString()
        }]
      };
    })
    .sort((a, b) => new Date(b.lastOrderAt || 0) - new Date(a.lastOrderAt || 0));

  return { customers, loyaltyConfig: normalizedLoyaltyConfig };
}

export function adjustCustomerPoints(phone, deltaPoints) {
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
