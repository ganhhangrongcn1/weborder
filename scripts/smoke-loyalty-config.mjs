import { createLoyaltyConfigService } from "../src/services/loyaltyConfigService.js";
import { createLoyaltyConfigRepository } from "../src/services/repositories/loyaltyConfigRepository.js";
import {
  buildLoyaltyTierJourney,
  getLoyaltyEarnPercent,
  getLoyaltyTierIconSymbol,
  normalizeLoyaltyProgramConfig,
  resolveLoyaltyTier
} from "../src/services/loyaltyProgramConfigService.js";
import {
  buildPartnerLoyaltyAmountSnapshot,
  resolvePartnerNetReceivedAmount
} from "../src/services/partnerOrderAmountService.js";

const memory = new Map();

const service = createLoyaltyConfigService(createLoyaltyConfigRepository({
  load(key, fallback) {
    return memory.has(key) ? memory.get(key) : fallback;
  },
  save(key, value) {
    memory.set(key, value);
    return value;
  },
  async loadAsync(key, fallback) {
    return memory.has(key) ? memory.get(key) : fallback;
  },
  async saveAsync(key, value) {
    memory.set(key, value);
    return value;
  }
}));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const program = normalizeLoyaltyProgramConfig({});
  assert(program.tiers.length === 5, "loyalty program must contain five tiers");
  assert(program.tiers[0].name === "Chớm Ghiền", "first tier mismatch");
  assert(program.tiers[0].iconKey === "sprout", "first tier icon mismatch");
  assert(program.tiers[4].name === "Huyền Thoại Gánh", "highest tier mismatch");
  assert(program.tiers[1].minAnnualSpend === 500000, "returning customer threshold mismatch");
  assert(program.tiers[2].minAnnualSpend === 1500000, "super fan threshold mismatch");
  assert(program.tiers[3].minAnnualSpend === 3000000, "inner circle threshold mismatch");
  assert(program.tiers[4].minAnnualSpend === 6000000, "legend threshold mismatch");
  assert(getLoyaltyEarnPercent(100, 10) === 10, "lowest earn rate mismatch");
  assert(getLoyaltyEarnPercent(100, 15) === 15, "highest earn rate mismatch");
  assert(resolveLoyaltyTier(1500000, program).name === "Ghiền Thiệt", "tier resolution mismatch");
  assert(getLoyaltyTierIconSymbol("crown") === "👑", "tier icon rendering mismatch");
  const customizedProgram = normalizeLoyaltyProgramConfig({
    tiers: program.tiers.map((tier, index) => (
      index === 1 ? { ...tier, name: "Khách thân thiết", iconKey: "crown" } : tier
    ))
  });
  assert(customizedProgram.tiers[1].name === "Khách thân thiết", "custom tier name mismatch");
  assert(customizedProgram.tiers[1].iconKey === "crown", "custom tier icon mismatch");
  assert(program.maxRedemptionPercent === 50, "redemption limit mismatch");
  assert(program.pointsExpiryMode === "LAST_PURCHASE", "expiry mode mismatch");
  const tierJourney = buildLoyaltyTierJourney({
    tierId: "returning_customer",
    tierCycleYear: 2026,
    tierQualifyingSpend: 900000,
    tierQualifyingOrderCount: 6,
    pointsExpiresAt: "2027-06-21T00:00:00.000Z"
  }, program);
  assert(tierJourney.currentTier.id === "returning_customer", "current journey tier mismatch");
  assert(tierJourney.nextTier.id === "super_fan", "next journey tier mismatch");
  assert(tierJourney.amountToNextTier === 600000, "amount to next tier mismatch");
  assert(Math.round(tierJourney.progressPercent) === 40, "tier segment progress mismatch");
  assert(tierJourney.averageOrderValue === 150000, "average order value mismatch");
  assert(tierJourney.estimatedOrdersToNext === 4, "estimated orders to next tier mismatch");
  const topJourney = buildLoyaltyTierJourney({
    tierId: "ganh_legend",
    tierCycleYear: 2026,
    tierQualifyingSpend: 12000000
  }, program);
  assert(topJourney.nextTier === null, "highest tier must not have a next tier");
  assert(topJourney.progressPercent === 100, "highest tier progress must be complete");
  assert(
    resolvePartnerNetReceivedAmount({
      total_amount: 250000,
      raw_data: { finance_data: { real_received: 173550, net_received: 180000 } }
    }) === 173550,
    "partner real_received must have first priority"
  );
  assert(
    resolvePartnerNetReceivedAmount({ total_amount: 250000, raw_data: {} }) === null,
    "partner loyalty must not fall back to total_amount"
  );
  const waitingPartner = buildPartnerLoyaltyAmountSnapshot({
    point_status: "pending",
    total_amount: 250000,
    raw_data: {}
  });
  assert(waitingPartner.pointsBaseAmount === 0, "missing partner settlement must have zero point base");
  assert(waitingPartner.pointStatus === "waiting_data", "missing partner settlement must wait for reconciliation");

  const defaultRule = service.getLoyaltyRule();
  assert(defaultRule.currencyPerPoint === 100, "default currencyPerPoint mismatch");

  const savedRule = await service.saveLoyaltyRuleAsync({ currencyPerPoint: 2000, pointPerUnit: 2 });
  assert(savedRule.currencyPerPoint === 2000, "save async rule failed");

  const loadedRule = await service.getLoyaltyRuleAsync();
  assert(loadedRule.pointPerUnit === 2, "load async rule failed");

  const rows = await service.getLoyaltyRulesRowsAsync();
  assert(Array.isArray(rows) && rows.length > 0, "rules rows missing");

  const milestones = await service.getLoyaltyMilestonesAsync();
  assert(Array.isArray(milestones) && milestones.some((item) => item.id === "milestone-79k"), "milestones missing");

  console.log("Loyalty config smoke test passed.");
}

run().catch((error) => {
  console.error("Loyalty config smoke test failed:", error.message);
  process.exit(1);
});
