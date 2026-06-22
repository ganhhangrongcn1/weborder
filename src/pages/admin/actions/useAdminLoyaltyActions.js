import { recalculateAllLoyaltyFromOrders, saveLoyaltyConfigAsync } from "../../../services/crmService.js";
import { getDataSource } from "../../../services/repositories/dataSource.js";
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

  const handleSaveLoyaltyConfig = async (payload) => {
    const result = await saveLoyaltyConfigAsync(payload);
    if (getDataSource() !== "supabase") {
      recalculateAllLoyaltyFromOrders(orderStorage);
    }
    return result;
  };

  return {
    handleSaveLoyaltyRule,
    handleSaveLoyaltyRulesRows,
    handleSaveLoyaltyBonusDisplay,
    handleSaveLoyaltyConfig
  };
}
