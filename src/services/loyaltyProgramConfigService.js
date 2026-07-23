export const LOYALTY_PROGRAM_SCHEMA_VERSION = 5;

export const LOYALTY_TIER_ICON_OPTIONS = [
  { key: "sprout", label: "Mầm non", symbol: "🌱" },
  { key: "smile", label: "Gương mặt vui", symbol: "😋" },
  { key: "flame", label: "Ngọn lửa", symbol: "🔥" },
  { key: "crown", label: "Vương miện", symbol: "👑" },
  { key: "star", label: "Ngôi sao", symbol: "🌟" }
];

const LOYALTY_TIER_ICON_KEYS = new Set(LOYALTY_TIER_ICON_OPTIONS.map((option) => option.key));

export const DEFAULT_LOYALTY_TIERS = [
  {
    id: "new_customer",
    name: "Chớm Ghiền",
    iconKey: "sprout",
    minAnnualSpend: 0,
    currencyPerPoint: 100,
    pointPerUnit: 10,
    milestoneVoucherId: "",
    enabled: true
  },
  {
    id: "returning_customer",
    name: "Ghiền Nhẹ",
    iconKey: "smile",
    minAnnualSpend: 500000,
    currencyPerPoint: 100,
    pointPerUnit: 11,
    milestoneVoucherId: "",
    enabled: true
  },
  {
    id: "super_fan",
    name: "Ghiền Thiệt",
    iconKey: "flame",
    minAnnualSpend: 1500000,
    currencyPerPoint: 100,
    pointPerUnit: 12,
    milestoneVoucherId: "",
    enabled: true
  },
  {
    id: "inner_circle_fan",
    name: "Ghiền Chính Hiệu",
    iconKey: "crown",
    minAnnualSpend: 3000000,
    currencyPerPoint: 100,
    pointPerUnit: 13,
    milestoneVoucherId: "",
    enabled: true
  },
  {
    id: "ganh_legend",
    name: "Huyền Thoại Gánh",
    iconKey: "star",
    minAnnualSpend: 6000000,
    currencyPerPoint: 100,
    pointPerUnit: 15,
    milestoneVoucherId: "",
    enabled: true
  }
];

export const DEFAULT_LOYALTY_PROGRAM_CONFIG = {
  schemaVersion: LOYALTY_PROGRAM_SCHEMA_VERSION,
  enabled: true,
  currencyPerPoint: 100,
  pointPerUnit: 10,
  redeemPointUnit: 1,
  redeemValue: 1,
  maxRedemptionPercent: 50,
  pointsExpiryMonths: 12,
  pointsExpiryMode: "LAST_PURCHASE",
  tierCycleMonths: 12,
  tierCycleMode: "CALENDAR_YEAR",
  checkinEnabled: true,
  checkinDailyPoints: 1000,
  welcomeVoucherEnabled: false,
  welcomeVoucherId: "",
  welcomeVoucherValidityDays: 7,
  streakRewards: {
    7: 5000,
    15: 10000,
    30: 15000
  },
  tiers: DEFAULT_LOYALTY_TIERS
};

function positiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizeTier(rawTier, fallbackTier, index) {
  const currencyPerPoint = positiveInteger(
    rawTier?.currencyPerPoint,
    fallbackTier.currencyPerPoint
  );
  const pointPerUnit = positiveInteger(rawTier?.pointPerUnit, fallbackTier.pointPerUnit);
  const requestedIconKey = String(rawTier?.iconKey || fallbackTier.iconKey).trim();

  return {
    id: String(rawTier?.id || fallbackTier.id).trim() || fallbackTier.id,
    name: String(rawTier?.name || fallbackTier.name).trim() || fallbackTier.name,
    iconKey: LOYALTY_TIER_ICON_KEYS.has(requestedIconKey) ? requestedIconKey : fallbackTier.iconKey,
    minAnnualSpend: index === 0
      ? 0
      : nonNegativeInteger(rawTier?.minAnnualSpend, fallbackTier.minAnnualSpend),
    currencyPerPoint,
    pointPerUnit,
    milestoneVoucherId: String(rawTier?.milestoneVoucherId || "").trim(),
    enabled: rawTier?.enabled !== false
  };
}

export function getLoyaltyTierIconSymbol(iconKey) {
  return LOYALTY_TIER_ICON_OPTIONS.find((option) => option.key === iconKey)?.symbol || "🌟";
}

export function getLoyaltyEarnPercent(currencyPerPoint, pointPerUnit) {
  const amount = positiveInteger(currencyPerPoint, 1);
  const points = positiveInteger(pointPerUnit, 1);
  return (points / amount) * 100;
}

export function normalizeLoyaltyProgramConfig(config = {}) {
  const incomingTiers = Array.isArray(config?.tiers) ? config.tiers : [];
  const tiers = DEFAULT_LOYALTY_TIERS.map((fallbackTier, index) => (
    normalizeTier(incomingTiers[index], fallbackTier, index)
  ));
  const sortedTiers = tiers.reduce((result, tier, index) => {
    const previousSpend = result[index - 1]?.minAnnualSpend ?? -1;
    result.push({
      ...tier,
      minAnnualSpend: index === 0
        ? 0
        : Math.max(tier.minAnnualSpend, previousSpend + 1)
    });
    return result;
  }, []);
  const baseTier = sortedTiers[0];
  const incomingStreakRewards = config?.streakRewards || {};

  return {
    ...DEFAULT_LOYALTY_PROGRAM_CONFIG,
    ...(config || {}),
    schemaVersion: LOYALTY_PROGRAM_SCHEMA_VERSION,
    enabled: config?.enabled !== false,
    currencyPerPoint: baseTier.currencyPerPoint,
    pointPerUnit: baseTier.pointPerUnit,
    redeemPointUnit: 1,
    redeemValue: 1,
    maxRedemptionPercent: Math.min(
      50,
      positiveInteger(config?.maxRedemptionPercent, DEFAULT_LOYALTY_PROGRAM_CONFIG.maxRedemptionPercent)
    ),
    pointsExpiryMonths: positiveInteger(
      config?.pointsExpiryMonths,
      DEFAULT_LOYALTY_PROGRAM_CONFIG.pointsExpiryMonths
    ),
    pointsExpiryMode: "LAST_PURCHASE",
    tierCycleMonths: 12,
    tierCycleMode: "CALENDAR_YEAR",
    checkinEnabled: config?.checkinEnabled !== false,
    checkinDailyPoints: nonNegativeInteger(
      config?.checkinDailyPoints,
      DEFAULT_LOYALTY_PROGRAM_CONFIG.checkinDailyPoints
    ),
    welcomeVoucherEnabled: config?.welcomeVoucherEnabled === true,
    welcomeVoucherId: String(config?.welcomeVoucherId || "").trim(),
    welcomeVoucherValidityDays: Math.min(
      60,
      positiveInteger(
        config?.welcomeVoucherValidityDays,
        DEFAULT_LOYALTY_PROGRAM_CONFIG.welcomeVoucherValidityDays
      )
    ),
    streakRewards: {
      7: nonNegativeInteger(incomingStreakRewards?.[7], DEFAULT_LOYALTY_PROGRAM_CONFIG.streakRewards[7]),
      15: nonNegativeInteger(incomingStreakRewards?.[15], DEFAULT_LOYALTY_PROGRAM_CONFIG.streakRewards[15]),
      30: nonNegativeInteger(incomingStreakRewards?.[30], DEFAULT_LOYALTY_PROGRAM_CONFIG.streakRewards[30])
    },
    tiers: sortedTiers,
    byPhone: { ...(config?.byPhone || {}) }
  };
}

export function resolveLoyaltyTier(totalAnnualSpend = 0, config = {}) {
  const normalized = normalizeLoyaltyProgramConfig(config);
  const amount = Math.max(0, Number(totalAnnualSpend || 0));
  return normalized.tiers.reduce((current, tier) => (
    tier.enabled && amount >= tier.minAnnualSpend ? tier : current
  ), normalized.tiers[0]);
}

export function buildLoyaltyTierJourney(account = {}, config = {}) {
  const normalized = normalizeLoyaltyProgramConfig(config);
  const annualSpend = Math.max(0, Number(account?.tierQualifyingSpend || 0));
  const annualOrderCount = Math.max(0, Math.floor(Number(account?.tierQualifyingOrderCount || 0)));
  const configuredTier = normalized.tiers.find((tier) => tier.id === account?.tierId);
  const currentTier = configuredTier || resolveLoyaltyTier(annualSpend, normalized);
  const currentIndex = Math.max(0, normalized.tiers.findIndex((tier) => tier.id === currentTier.id));
  const nextTier = normalized.tiers.slice(currentIndex + 1).find((tier) => tier.enabled) || null;
  const segmentStart = Math.max(0, Number(currentTier.minAnnualSpend || 0));
  const segmentEnd = nextTier ? Math.max(segmentStart + 1, Number(nextTier.minAnnualSpend || 0)) : segmentStart;
  const progressPercent = nextTier
    ? Math.min(100, Math.max(0, (annualSpend - segmentStart) / (segmentEnd - segmentStart) * 100))
    : 100;
  const cycleYear = Number(account?.tierCycleYear || new Date().getFullYear());
  const averageOrderValue = annualOrderCount > 0 ? annualSpend / annualOrderCount : 0;
  const amountToNextTier = nextTier
    ? Math.max(0, Number(nextTier.minAnnualSpend || 0) - annualSpend)
    : 0;
  const estimatedOrdersToNext = nextTier && averageOrderValue > 0
    ? Math.max(1, Math.ceil(amountToNextTier / averageOrderValue))
    : null;

  return {
    tiers: normalized.tiers.map((tier, index) => ({
      ...tier,
      index,
      earnPercent: getLoyaltyEarnPercent(tier.currencyPerPoint, tier.pointPerUnit),
      state: index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming"
    })),
    currentTier: {
      ...currentTier,
      earnPercent: getLoyaltyEarnPercent(currentTier.currencyPerPoint, currentTier.pointPerUnit)
    },
    nextTier: nextTier ? {
      ...nextTier,
      earnPercent: getLoyaltyEarnPercent(nextTier.currencyPerPoint, nextTier.pointPerUnit)
    } : null,
    annualSpend,
    annualOrderCount,
    averageOrderValue,
    amountToNextTier,
    estimatedOrdersToNext,
    progressPercent,
    cycleYear,
    cycleEndsAt: `${cycleYear}-12-31`,
    pointsExpiresAt: account?.pointsExpiresAt || null,
    maxRedemptionPercent: normalized.maxRedemptionPercent,
    redeemPointUnit: normalized.redeemPointUnit,
    redeemValue: normalized.redeemValue
  };
}

export default {
  DEFAULT_LOYALTY_PROGRAM_CONFIG,
  DEFAULT_LOYALTY_TIERS,
  LOYALTY_TIER_ICON_OPTIONS,
  getLoyaltyTierIconSymbol,
  getLoyaltyEarnPercent,
  buildLoyaltyTierJourney,
  normalizeLoyaltyProgramConfig,
  resolveLoyaltyTier
};
