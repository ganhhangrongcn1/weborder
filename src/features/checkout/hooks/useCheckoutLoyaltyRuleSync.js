import { useEffect } from "react";
import { getCheckoutLoyaltyRule, getCheckoutLoyaltyRuleAsync } from "../../../services/checkoutService.js";

export default function useCheckoutLoyaltyRuleSync({ setLoyaltyRule }) {
  useEffect(() => {
    let disposed = false;

    const syncRule = async () => {
      try {
        const remoteRule = await getCheckoutLoyaltyRuleAsync();
        if (disposed) return;
        if (remoteRule && typeof remoteRule === "object") {
          setLoyaltyRule(remoteRule);
        }
      } catch (_error) {
        // Keep current fallback rule.
      }
    };

    const handleLoyaltyChanged = () => {
      const localRule = getCheckoutLoyaltyRule();
      if (localRule && typeof localRule === "object") {
        setLoyaltyRule(localRule);
      }
      syncRule();
    };

    syncRule();
    window.addEventListener("ghr:customer-data-changed", handleLoyaltyChanged);
    return () => {
      disposed = true;
      window.removeEventListener("ghr:customer-data-changed", handleLoyaltyChanged);
    };
  }, [setLoyaltyRule]);
}

