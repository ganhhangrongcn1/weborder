import {
  loyaltyMilestoneDefaults,
  loyaltyBonusDisplay,
  loyaltyRulesRows,
  loyaltySimpleGuestRows,
  loyaltyText
} from "../data/loyaltyData.js";
import { createLocalStorageAdapter } from "./adapters/localStorageAdapter.js";
import { createLoyaltyConfigRepository } from "./repositories/loyaltyConfigRepository.js";

const LOYALTY_RULE_KEY = "ghr_loyalty";
const LOYALTY_UI_TEXT_KEY = "ghr_loyalty_ui_text";
const LOYALTY_RULE_ROWS_KEY = "ghr_loyalty_rule_rows";
const LOYALTY_BONUS_DISPLAY_KEY = "ghr_loyalty_bonus_display";
const LOYALTY_MILESTONES_KEY = "ghr_loyalty_milestones";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeLoyaltyText(value) {
  return {
    ...loyaltyText,
    ...(value || {})
  };
}

function normalizeBonusDisplay(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return clone(loyaltyBonusDisplay);
  const rows = Object.values(value)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      days: Math.max(1, Number(item.days || item.day || 0)),
      points: Math.max(1, Number(item.points || 0))
    }))
    .filter((item) => item.days > 0 && item.points > 0)
    .sort((a, b) => a.days - b.days);
  return rows.length ? rows : clone(loyaltyBonusDisplay);
}

function normalizeRulesRows(value) {
  if (!Array.isArray(value)) return clone(loyaltyRulesRows);
  const rows = value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      label: String(item.label || "").trim(),
      value: String(item.value || "").trim()
    }))
    .filter((item) => item.label && item.value);
  return rows.length ? rows : clone(loyaltyRulesRows);
}

export function createLoyaltyConfigService(repository = createLoyaltyConfigRepository(createLocalStorageAdapter())) {
  const service = {
    getLoyaltyRule() {
      return repository.get(LOYALTY_RULE_KEY, {
        currencyPerPoint: 1000,
        pointPerUnit: 1,
        checkinDailyPoints: 100,
        streakRewards: {
          7: 700,
          14: 1500,
          30: 3000
        },
        redeemPointUnit: 1,
        redeemValue: 1
      });
    },
    saveLoyaltyRule(rule) {
      return repository.set(LOYALTY_RULE_KEY, rule);
    },
    getLoyaltyMilestones() {
      return repository.get(LOYALTY_MILESTONES_KEY, clone(loyaltyMilestoneDefaults));
    },
    saveLoyaltyMilestones(milestones) {
      return repository.set(LOYALTY_MILESTONES_KEY, milestones);
    },
    getLoyaltyBonusDisplay() {
      return normalizeBonusDisplay(repository.get(LOYALTY_BONUS_DISPLAY_KEY, clone(loyaltyBonusDisplay)));
    },
    saveLoyaltyBonusDisplay(bonusDisplay) {
      return repository.set(LOYALTY_BONUS_DISPLAY_KEY, bonusDisplay);
    },
    getLoyaltyRulesRows() {
      return normalizeRulesRows(repository.get(LOYALTY_RULE_ROWS_KEY, clone(loyaltyRulesRows)));
    },
    saveLoyaltyRulesRows(rows) {
      return repository.set(LOYALTY_RULE_ROWS_KEY, rows);
    },
    getLoyaltyText() {
      return normalizeLoyaltyText(repository.get(LOYALTY_UI_TEXT_KEY, loyaltyText));
    },
    saveLoyaltyText(text) {
      return repository.set(LOYALTY_UI_TEXT_KEY, text);
    },
    getLoyaltySimpleGuestRows(currencyPerPoint, pointPerUnit) {
      return loyaltySimpleGuestRows(currencyPerPoint, pointPerUnit);
    }
  };

  return {
    ...service,
    getLoyaltyRuleAsync: async () => repository.getAsync(LOYALTY_RULE_KEY, {
      currencyPerPoint: 1000,
      pointPerUnit: 1,
      checkinDailyPoints: 100,
      streakRewards: {
        7: 700,
        14: 1500,
        30: 3000
      },
      redeemPointUnit: 1,
      redeemValue: 1
    }),
    saveLoyaltyRuleAsync: async (rule) => repository.setAsync(LOYALTY_RULE_KEY, rule),
    getLoyaltyMilestonesAsync: async () => repository.getAsync(LOYALTY_MILESTONES_KEY, clone(loyaltyMilestoneDefaults)),
    saveLoyaltyMilestonesAsync: async (milestones) => repository.setAsync(LOYALTY_MILESTONES_KEY, milestones),
    getLoyaltyBonusDisplayAsync: async () => normalizeBonusDisplay(await repository.getAsync(LOYALTY_BONUS_DISPLAY_KEY, clone(loyaltyBonusDisplay))),
    saveLoyaltyBonusDisplayAsync: async (bonusDisplay) => repository.setAsync(LOYALTY_BONUS_DISPLAY_KEY, bonusDisplay),
    getLoyaltyRulesRowsAsync: async () => normalizeRulesRows(await repository.getAsync(LOYALTY_RULE_ROWS_KEY, clone(loyaltyRulesRows))),
    saveLoyaltyRulesRowsAsync: async (rows) => repository.setAsync(LOYALTY_RULE_ROWS_KEY, rows),
    getLoyaltyTextAsync: async () => normalizeLoyaltyText(await repository.getAsync(LOYALTY_UI_TEXT_KEY, loyaltyText)),
    saveLoyaltyTextAsync: async (text) => repository.setAsync(LOYALTY_UI_TEXT_KEY, text)
  };
}

const loyaltyConfig = createLoyaltyConfigService();

export const {
  getLoyaltyRule,
  saveLoyaltyRule,
  getLoyaltyMilestones,
  saveLoyaltyMilestones,
  getLoyaltyBonusDisplay,
  saveLoyaltyBonusDisplay,
  getLoyaltyRulesRows,
  saveLoyaltyRulesRows,
  getLoyaltyText,
  saveLoyaltyText,
  getLoyaltySimpleGuestRows,
  getLoyaltyRuleAsync,
  saveLoyaltyRuleAsync,
  getLoyaltyMilestonesAsync,
  saveLoyaltyMilestonesAsync,
  getLoyaltyBonusDisplayAsync,
  saveLoyaltyBonusDisplayAsync,
  getLoyaltyRulesRowsAsync,
  saveLoyaltyRulesRowsAsync,
  getLoyaltyTextAsync,
  saveLoyaltyTextAsync
} = loyaltyConfig;
