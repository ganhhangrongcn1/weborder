import { getCustomerKey } from "./storageService.js";
import { loyaltyRepository } from "./repositories/loyaltyRepository.js";

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
    currencyPerPoint: 1000,
    pointPerUnit: 1,
    checkinDailyPoints: 100,
    streakRewards: { 7: 700, 14: 1500, 30: 3000 },
    redeemPointUnit: 1,
    redeemValue: 1
  });
}

export function calculateOrderPoints(amount, loyaltyRule = getLoyaltyRuleConfig()) {
  const currencyPerPoint = Math.max(1, Number(loyaltyRule?.currencyPerPoint || 1000));
  const pointPerUnit = Math.max(1, Number(loyaltyRule?.pointPerUnit || 1));
  return Math.floor((Number(amount || 0) / currencyPerPoint) * pointPerUnit);
}

export function applyOrderLoyalty({
  phone,
  orderId,
  amount,
  createdAt = new Date().toISOString(),
  promoSource = "",
  promoVoucherId = "",
  promoCode = "",
  pointsDiscount = 0,
  orderStatus = ""
}) {
  const key = getCustomerKey(phone);
  if (!key || !orderId) return loyaltyByPhoneStorage.getByPhone(key);

  const phoneLoyalty = loyaltyByPhoneStorage.getByPhone(key);
  const pointHistory = Array.isArray(phoneLoyalty.pointHistory) ? phoneLoyalty.pointHistory : [];
  const normalizedStatus = String(orderStatus || "").toLowerCase();
  const isSettlementDone = ["done", "completed", "hoan tat", "hoàn tất"].includes(normalizedStatus);
  const alreadyEarned = pointHistory.some((entry) => {
    return String(entry?.orderId || "") === String(orderId) && String(entry?.type || "").toUpperCase() === "ORDER_EARN";
  });
  const pointsEarned = isSettlementDone && !alreadyEarned ? calculateOrderPoints(amount) : 0;
  const spendPoints = Math.max(0, Number(pointsDiscount || 0));
  const alreadySpent = pointHistory.some((entry) => {
    return String(entry?.orderId || "") === String(orderId) && String(entry?.type || "").toUpperCase() === "ORDER_SPEND";
  });
  const pointEntry = {
    id: `point-${orderId}`,
    type: "ORDER_EARN",
    orderId,
    points: pointsEarned,
    amount: Number(amount || 0),
    createdAt,
    note: "Tich diem tu don hang",
    title: `Tich diem don ${orderId}`
  };
  const spendEntry = {
    id: `point-spend-${orderId}`,
    type: "ORDER_SPEND",
    orderId,
    points: -spendPoints,
    amount: Number(amount || 0),
    createdAt,
    note: "Dung diem khi thanh toan",
    title: `Dung diem don ${orderId}`
  };
  const nextVoucherHistory = promoSource === "loyalty"
    ? (phoneLoyalty.voucherHistory || []).map((voucher) => {
        const sameVoucher = String(voucher.id || "") === String(promoVoucherId || "") || String(voucher.code || "").toUpperCase() === String(promoCode || "").toUpperCase();
        return sameVoucher ? { ...voucher, used: true, usedAt: createdAt, orderCode: orderId } : voucher;
      })
    : phoneLoyalty.voucherHistory || [];
  const nextPointHistory = [
    ...(alreadyEarned || pointsEarned <= 0 ? [] : [pointEntry]),
    ...(alreadySpent || spendPoints <= 0 ? [] : [spendEntry]),
    ...pointHistory
  ];
  const nextTotalPoints = Math.max(
    0,
    Number(phoneLoyalty.totalPoints || 0) + pointsEarned - (alreadySpent ? 0 : spendPoints)
  );
  const nextPhoneLoyalty = {
    ...phoneLoyalty,
    totalPoints: nextTotalPoints,
    pointHistory: nextPointHistory,
    voucherHistory: nextVoucherHistory
  };

  const saved = loyaltyByPhoneStorage.saveByPhone(key, nextPhoneLoyalty);
  const remoteEventTasks = [];
  if (!alreadyEarned && pointsEarned > 0) {
    remoteEventTasks.push(
      loyaltyRepository.appendEventByPhoneAsync(
        key,
        {
          entryType: "ORDER_EARN",
          points: pointsEarned,
          orderId,
          amount: Number(amount || 0),
          title: pointEntry.title,
          note: pointEntry.note,
          createdAt,
          metadata: pointEntry
        },
        defaultLoyaltyData
      )
    );
  }
  if (!alreadySpent && spendPoints > 0) {
    remoteEventTasks.push(
      loyaltyRepository.appendEventByPhoneAsync(
        key,
        {
          entryType: "ORDER_SPEND",
          points: -spendPoints,
          orderId,
          amount: Number(amount || 0),
          title: spendEntry.title,
          note: spendEntry.note,
          createdAt,
          metadata: spendEntry
        },
        defaultLoyaltyData
      )
    );
  }
  if (remoteEventTasks.length) {
    Promise.allSettled(remoteEventTasks).catch(() => null);
  }
  if (promoSource === "loyalty" && (promoVoucherId || promoCode)) {
    loyaltyRepository
      .markVoucherUsedByPhoneAsync(
        key,
        {
          voucherId: promoVoucherId,
          voucherCode: promoCode,
          orderId,
          usedAt: createdAt
        },
        defaultLoyaltyData
      )
      .catch((error) => {
        if (import.meta?.env?.DEV) {
          console.error("[loyaltyService] markVoucherUsedByPhoneAsync failed", error);
        }
      });
  }
  return saved;
}

export function reconcileLoyaltyFromOrders(phone, orderStorage) {
  const key = getCustomerKey(phone);
  if (!key) return defaultLoyaltyData;
  const orders = orderStorage.getByPhone(key);
  const loyalty = loyaltyByPhoneStorage.getByPhone(key);
  const currentPointHistory = Array.isArray(loyalty.pointHistory) ? loyalty.pointHistory : [];
  const nonOrderEntries = currentPointHistory.filter(
    (entry) => String(entry?.type || "").toUpperCase() !== "ORDER_EARN"
  );

  const byOrderId = new Map();
  orders.forEach((order) => {
    const orderId = String(order?.orderCode || "").trim();
    if (!orderId) return;
    const amount = Number(order.subtotal ?? order.pointsBaseAmount ?? order.totalAmount ?? order.total ?? 0);
    const points = Number(order.pointsEarned ?? calculateOrderPoints(amount));
    if (points <= 0) return;
    const createdAt = order.createdAt || new Date().toISOString();
    const existing = byOrderId.get(orderId);
    if (!existing || new Date(createdAt).getTime() > new Date(existing.createdAt || 0).getTime()) {
      byOrderId.set(orderId, {
        id: `point-${orderId}`,
        type: "ORDER_EARN",
        orderId,
        points,
        amount,
        createdAt,
        note: "Tich diem tu don hang",
        title: `Tich diem don ${orderId}`
      });
    }
  });

  const orderEntries = Array.from(byOrderId.values()).sort(
    (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
  );
  const nextPointHistory = [...orderEntries, ...nonOrderEntries];
  const nextTotalPoints = nextPointHistory.reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
  const prevTotal = Number(loyalty.totalPoints || 0);
  const prevLen = currentPointHistory.length;
  if (prevLen === nextPointHistory.length && prevTotal === nextTotalPoints) {
    return normalizeLoyaltyData(loyalty);
  }
  return loyaltyByPhoneStorage.saveByPhone(key, {
    ...loyalty,
    totalPoints: Math.max(0, nextTotalPoints),
    pointHistory: nextPointHistory
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
    // Important:
    // If voucher has a stable id, only resolve by id to avoid false "used"
    // when multiple vouchers share the same code (e.g. many LOYAL10 gifts).
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
