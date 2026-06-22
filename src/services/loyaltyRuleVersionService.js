import { loyaltyRepository } from "./repositories/loyaltyRepository.js";
import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";
import { getDataSource } from "./repositories/dataSource.js";
import { normalizeLoyaltyProgramConfig } from "./loyaltyProgramConfigService.js";

function createRuleActivationIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `loyalty-v2:rule:${crypto.randomUUID()}`.slice(0, 200);
  }
  return `loyalty-v2:rule:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`.slice(0, 200);
}

function normalizeStreakRewards(streakRewards = {}) {
  return {
    7: Math.max(0, Math.floor(Number(streakRewards?.[7] ?? streakRewards?.["7"] ?? 0))),
    14: Math.max(0, Math.floor(Number(streakRewards?.[14] ?? streakRewards?.["14"] ?? 0))),
    30: Math.max(0, Math.floor(Number(streakRewards?.[30] ?? streakRewards?.["30"] ?? 0)))
  };
}

export function normalizeLoyaltyRuleVersionPayload(config = {}) {
  const normalized = normalizeLoyaltyProgramConfig(config);
  return {
    ...normalized,
    checkinDailyPoints: Math.max(0, Math.floor(Number(normalized.checkinDailyPoints || 0))),
    streakRewards: normalizeStreakRewards(normalized.streakRewards || {})
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

  const result = await coreSupabaseRepository.activateLoyaltyProgramVersion({
    programConfig: persistedConfig,
    idempotencyKey
  });
  loyaltyRepository.primeCrmConfig(persistedConfig);

  return {
    ...(result || {}),
    config: normalized
  };
}

export default {
  activateLoyaltyRuleVersion,
  normalizeLoyaltyRuleVersionPayload
};
