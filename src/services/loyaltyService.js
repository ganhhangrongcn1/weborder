import { getCustomerKey } from "./storageService.js";
import { loyaltyRepository } from "./repositories/loyaltyRepository.js";
import {
  buildOrderLoyaltyIdempotencyKey,
  planOrderLoyaltyActions
} from "./loyaltyRuntimeService.js";

export const defaultLoyaltyData = {
  totalPoints: 0,
  lastCheckinDate: null,
  checkinStreak: 0,
  checkinHistory: [],
  pointHistory: [],
  rewardHistory: [],
  voucherHistory: [],
  lastMissedStreak: 0,
  comebackUsedDate: null
};

export function normalizeLoyaltyData(data) {
  const voucherHistory = Array.isArray(data?.voucherHistory)
    ? data.voucherHistory
    : Array.isArray(data?.vouchers)
      ? data.vouchers
      : [];
  return {
    ...defaultLoyaltyData,
    ...(data || {}),
    checkinHistory: Array.isArray(data?.checkinHistory) ? data.checkinHistory : [],
    pointHistory: Array.isArray(data?.pointHistory) ? data.pointHistory : [],
    rewardHistory: Array.isArray(data?.rewardHistory) ? data.rewardHistory : [],
    voucherHistory
  };
}

export const loyaltyStorage = {
  get() {
    const saved = loyaltyRepository.getDemo(defaultLoyaltyData);
    return normalizeLoyaltyData(saved);
  },
  save(data) {
    return loyaltyRepository.saveDemo(normalizeLoyaltyData(data));
  },
  reset() {
    return loyaltyRepository.clearDemo(defaultLoyaltyData);
  }
};

export const loyaltyByPhoneStorage = {
  getAll() {
    return loyaltyRepository.getAllByPhone();
  },
  getByPhone(phone) {
    return normalizeLoyaltyData(loyaltyRepository.getByPhone(phone, defaultLoyaltyData));
  },
  saveByPhone(phone, loyalty) {
    return loyaltyRepository.saveByPhone(phone, normalizeLoyaltyData(loyalty), defaultLoyaltyData);
  }
};

export function getLoyaltyRuleConfig() {
  return loyaltyRepository.getCrmConfig({
    currencyPerPoint: 100,
    pointPerUnit: 10,
    checkinDailyPoints: 100,
    streakRewards: { 7: 700, 14: 1500, 30: 3000 },
    redeemPointUnit: 1,
    redeemValue: 1,
    maxRedemptionPercent: 50
  });
}

export async function getLoyaltyRuleConfigAsync() {
  return loyaltyRepository.getCrmConfigAsync({
    currencyPerPoint: 100,
    pointPerUnit: 10,
    checkinDailyPoints: 100,
    streakRewards: { 7: 700, 14: 1500, 30: 3000 },
    redeemPointUnit: 1,
    redeemValue: 1,
    maxRedemptionPercent: 50
  });
}

export function calculateOrderPoints(amount, loyaltyRule = getLoyaltyRuleConfig()) {
  const currencyPerPoint = Math.max(1, Number(loyaltyRule?.currencyPerPoint || 100));
  const pointPerUnit = Math.max(1, Number(loyaltyRule?.pointPerUnit || 10));
  return Math.floor((Number(amount || 0) / currencyPerPoint) * pointPerUnit);
}

export async function applyOrderLoyaltyAsync({
  phone,
  orderId,
  createdAt = new Date().toISOString(),
  promoSource = "",
  promoVoucherId = "",
  promoCode = "",
  pointsDiscount = 0,
  orderStatus = "",
  previousOrderStatus = "",
  pointsSpent = pointsDiscount,
  sourceType = "ORDER",
  client = null
}) {
  const key = getCustomerKey(phone);
  if (!key || !orderId) return loyaltyByPhoneStorage.getByPhone(key);

  const phoneLoyalty = normalizeLoyaltyData(
    await loyaltyRepository.getByPhoneAsync(key, defaultLoyaltyData)
  );
  const spendPoints = Math.max(0, Number(pointsSpent || pointsDiscount || 0));
  const plannedActions = planOrderLoyaltyActions({
    sourceType,
    previousStatus: previousOrderStatus,
    currentStatus: orderStatus,
    pointsSpent: spendPoints
  });

  for (const action of plannedActions) {
    await loyaltyRepository.processOrderActionByPhoneAsync(
      key,
      {
        sourceType,
        sourceOrderId: orderId,
        action,
        idempotencyKey: buildOrderLoyaltyIdempotencyKey({
          sourceType,
          sourceOrderId: orderId,
          action
        })
      },
      defaultLoyaltyData,
      { throwOnError: true, client }
    );
  }

  if (
    plannedActions.includes("SPEND") &&
    promoSource === "loyalty" &&
    (promoVoucherId || promoCode)
  ) {
    await loyaltyRepository.markVoucherUsedByPhoneAsync(
      key,
      {
        voucherId: promoVoucherId,
        voucherCode: promoCode,
        orderId,
        usedAt: createdAt
      },
      defaultLoyaltyData
    );
  }

  return loyaltyRepository.getByPhoneAsync(key, {
    ...phoneLoyalty,
    phone: key
  });
}

export async function completeWebsiteOrderWithLoyaltyAsync({ orderId = "", client = null } = {}) {
  const sourceOrderId = String(orderId || "").trim();
  if (!sourceOrderId) throw new Error("Thiếu mã đơn để hoàn tất.");

  return loyaltyRepository.completeWebsiteOrderWithLoyaltyAsync({
    orderId: sourceOrderId,
    idempotencyKey: buildOrderLoyaltyIdempotencyKey({
      sourceType: "ORDER",
      sourceOrderId,
      action: "SETTLE_EARN"
    }),
    client
  });
}

export function generateLuckyVoucher(getTodayKey, addDaysToKey) {
  if (Math.random() >= 0.2) return null;
  const today = getTodayKey();
  const options = [
    { type: "FREE_TOPPING", title: "Tang topping mien phi" },
    { type: "FREE_DRINK", title: "Tang tra xoai cho don tu 50k" },
    { type: "DISCOUNT_10K", title: "Giam 10k cho don tu 59k" }
  ];
  const picked = options[Math.floor(Math.random() * options.length)];
  return {
    id: `${picked.type}-${Date.now()}`,
    type: picked.type,
    title: picked.title,
    createdAt: today,
    used: false,
    expiredAt: addDaysToKey(today, 7)
  };
}

export function isVoucherExpired(voucher, getTodayKey) {
  return voucher.expiredAt < getTodayKey();
}

function toDateValue(value) {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function normalizeVoucherId(value) {
  return String(value || "").trim();
}

function normalizeVoucherCode(value) {
  return String(value || "").trim().toUpperCase();
}

export function buildUsedVoucherLookupFromOrders(orders = []) {
  const byId = new Map();
  const byCode = new Map();

  (orders || []).forEach((order) => {
    const orderCreatedAt = order?.createdAt || order?.created_at || "";
    const orderCode = String(order?.orderCode || order?.order_code || order?.id || "").trim();
    const orderStatus = String(order?.status || "").trim();
    const promoSource = String(order?.promoSource || order?.promo_source || order?.metadata?.promoSource || "").trim().toLowerCase();
    const promoVoucherId = normalizeVoucherId(order?.promoVoucherId || order?.promo_voucher_id || order?.metadata?.promoVoucherId || "");
    const promoCode = normalizeVoucherCode(order?.promoCode || order?.promo_code || order?.metadata?.promoCode || "");

    const usage = {
      used: true,
      usedAt: orderCreatedAt || "",
      orderCode,
      orderStatus
    };

    if (promoVoucherId) {
      const prev = byId.get(promoVoucherId);
      if (!prev || toDateValue(usage.usedAt) >= toDateValue(prev.usedAt)) {
        byId.set(promoVoucherId, usage);
      }
    }

    if (promoSource === "loyalty" && promoCode) {
      const prev = byCode.get(promoCode);
      if (!prev || toDateValue(usage.usedAt) >= toDateValue(prev.usedAt)) {
        byCode.set(promoCode, usage);
      }
    }
  });

  return { byId, byCode };
}

export function resolveVoucherUsageFromOrders(vouchers = [], orders = []) {
  const lookup = buildUsedVoucherLookupFromOrders(orders);
  return (Array.isArray(vouchers) ? vouchers : []).map((voucher) => {
    const voucherId = normalizeVoucherId(voucher?.id);
    const voucherCode = normalizeVoucherCode(voucher?.code);
    const usage = voucherId
      ? lookup.byId.get(voucherId) || null
      : (voucherCode && lookup.byCode.get(voucherCode)) || null;
    if (!usage) return voucher;
    return {
      ...voucher,
      used: true,
      usedAt: usage.usedAt || voucher?.usedAt || "",
      orderCode: usage.orderCode || voucher?.orderCode || ""
    };
  });
}
