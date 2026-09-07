import { getCheckoutLoyaltyRuleAsync } from "../../../services/checkoutService.js";
import { calculateCheckoutPricing } from "../checkoutPricing.js";

// Recalculate before submitting; a changed amount always needs a new confirmation.
export default function useCheckoutPricingRefresh({
  pricingInput,
  tierId,
  promoCodes,
  displayedPricing,
  setLoyaltyRule,
  setSelectedPromo
}) {
  return async () => {
    let timeoutId;
    const rule = await Promise.race([
      getCheckoutLoyaltyRuleAsync(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("checkout_pricing_refresh_timeout")), 8000);
      })
    ]).finally(() => clearTimeout(timeoutId));
    const tier = (Array.isArray(rule?.tiers) ? rule.tiers : [])
      .find((entry) => entry?.id === tierId);
    const selectedPromo = pricingInput.selectedPromo
      ? promoCodes.find((promo) => promo.id === pricingInput.selectedPromo.id) || null
      : null;
    const next = calculateCheckoutPricing({
      ...pricingInput,
      selectedPromo,
      loyaltyRule: tier ? { ...rule, ...tier } : rule
    });
    setLoyaltyRule(rule);
    setSelectedPromo(selectedPromo);
    return ["checkoutTotal", "promoDiscount", "pointsDiscount", "pointsSpent"]
      .some((field) => Number(next[field] || 0) !== Number(displayedPricing[field] || 0));
  };
}
