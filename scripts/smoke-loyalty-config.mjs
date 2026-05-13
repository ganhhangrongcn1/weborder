import { createLoyaltyConfigService } from "../src/services/loyaltyConfigService.js";
import { createLoyaltyConfigRepository } from "../src/services/repositories/loyaltyConfigRepository.js";

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
  const defaultRule = service.getLoyaltyRule();
  assert(defaultRule.currencyPerPoint === 1000, "default currencyPerPoint mismatch");

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
