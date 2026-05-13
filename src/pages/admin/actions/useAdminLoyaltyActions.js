import { recalculateAllLoyaltyFromOrders, saveLoyaltyConfig } from "../../../services/crmService.js";
import { saveLoyaltyBonusDisplay, saveLoyaltyRule, saveLoyaltyRulesRows } from "../../../services/loyaltyConfigService.js";

export default function useAdminLoyaltyActions({ orderStorage } = {}) {
  const handleSaveLoyaltyRule = (rule) => {
    saveLoyaltyRule(rule);
  };

  const handleSaveLoyaltyRulesRows = (rows) => {
    saveLoyaltyRulesRows(rows);
  };

  const handleSaveLoyaltyBonusDisplay = (payload) => {
    saveLoyaltyBonusDisplay(payload);
  };

  const handleSaveLoyaltyConfig = (payload) => {
    saveLoyaltyConfig(payload);
    recalculateAllLoyaltyFromOrders(orderStorage);
  };

  return {
    handleSaveLoyaltyRule,
    handleSaveLoyaltyRulesRows,
    handleSaveLoyaltyBonusDisplay,
    handleSaveLoyaltyConfig
  };
}
