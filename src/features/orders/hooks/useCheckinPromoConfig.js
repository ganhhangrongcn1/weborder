import { useEffect, useMemo, useState } from "react";
import {
  getLoyaltyRuleConfig,
  getLoyaltyRuleConfigAsync
} from "../../../services/loyaltyService.js";

function normalizePromoConfig(config = {}) {
  const dailyPoints = Math.max(0, Math.floor(Number(config?.checkinDailyPoints || 0)));
  const cycleDays = Math.max(1, Math.floor(Number(config?.checkinCycleDays || 30)));
  const milestonePoints = Object.entries(config?.streakRewards || {})
    .filter(([days]) => Number(days) <= cycleDays)
    .reduce((sum, [, points]) => sum + Math.max(0, Math.floor(Number(points || 0))), 0);

  return {
    enabled: config?.checkinEnabled !== false && dailyPoints > 0,
    dailyPoints,
    cycleDays,
    cyclePoints: dailyPoints * cycleDays + milestonePoints
  };
}

export default function useCheckinPromoConfig() {
  const [config, setConfig] = useState(() => getLoyaltyRuleConfig());

  useEffect(() => {
    let active = true;

    getLoyaltyRuleConfigAsync()
      .then((nextConfig) => {
        if (active && nextConfig) setConfig(nextConfig);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => normalizePromoConfig(config), [config]);
}
