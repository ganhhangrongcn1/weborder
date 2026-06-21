import { loyaltyRepository } from "./repositories/loyaltyRepository.js";
import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";
import { getDataSource } from "./repositories/dataSource.js";

function createRuleActivationIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `loyalty-v2:rule:${crypto.randomUUID()}`.slice(0, 200);
  }
  return `loyalty-v2:rule:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`.slice(0, 200);
}

function normalizeStreakRewards(streakRewards = {}) {
  return {
    7: Math.max(1, Math.floor(Number(streakRewards?.[7] || streakRewards?.["7"] || 1))),
    14: Math.max(1, Math.floor(Number(streakRewards?.[14] || streakRewards?.["14"] || 1))),
    30: Math.max(1, Math.floor(Number(streakRewards?.[30] || streakRewards?.["30"] || 1)))
  };
}

export function normalizeLoyaltyRuleVersionPayload(config = {}) {
  return {
    currencyPerPoint: Math.max(1, Math.floor(Number(config?.currencyPerPoint || 100))),
    pointPerUnit: Math.max(1, Math.floor(Number(config?.pointPerUnit || 1))),
    checkinDailyPoints: Math.max(1, Math.floor(Number(config?.checkinDailyPoints || 100))),
    redeemPointUnit: Math.max(1, Math.floor(Number(config?.redeemPointUnit || 1))),
    redeemValue: Math.max(1, Math.floor(Number(config?.redeemValue || 1))),
    streakRewards: normalizeStreakRewards(config?.streakRewards || {})
  };
}

export async function activateLoyaltyRuleVersion(config = {}) {
  const normalized = normalizeLoyaltyRuleVersionPayload(config);
  const idempotencyKey = createRuleActivationIdempotencyKey();
  const persistedConfig = {
    ...(config || {}),
    ...normalized,
    enabled: true,
    source: "loyalty_v2",
    idempotencyKey
  };

  if (getDataSource() !== "supabase") {
    await loyaltyRepository.saveCrmConfigAsync(persistedConfig);
    return {
      ok: true,
      localOnly: true,
      config: normalized
    };
  }

  const result = await coreSupabaseRepository.activateLoyaltyRuleVersion({
    earnNumerator: normalized.pointPerUnit,
    earnDenominator: normalized.currencyPerPoint,
    redeemPointUnit: normalized.redeemPointUnit,
    redeemValue: normalized.redeemValue,
    checkinDailyPoints: normalized.checkinDailyPoints,
    streakRewards: normalized.streakRewards,
    idempotencyKey
  });

  await loyaltyRepository.saveCrmConfigAsync(persistedConfig);

  return {
    ...(result || {}),
    config: normalized
  };
}

export default {
  activateLoyaltyRuleVersion,
  normalizeLoyaltyRuleVersionPayload
};
