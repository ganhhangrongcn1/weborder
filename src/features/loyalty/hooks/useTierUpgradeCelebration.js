import { useEffect, useState } from "react";
import { getCustomerKey } from "../../../services/storageService.js";

const STORAGE_PREFIX = "ghr_loyalty_seen_tier";

function readSeenTier(storageKey) {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return "";
    const parsed = JSON.parse(saved);
    return String(parsed?.tierId || saved).trim();
  } catch {
    return "";
  }
}

function saveSeenTier(storageKey, tierId) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({
      tierId,
      seenAt: new Date().toISOString()
    }));
  } catch {
  }
}

export default function useTierUpgradeCelebration({ customerPhone, journey }) {
  const [celebratedTier, setCelebratedTier] = useState(null);
  const currentTier = journey?.currentTier || null;
  const cycleYear = Number(journey?.cycleYear || new Date().getFullYear());
  const tierIds = (journey?.tiers || []).map((tier) => tier.id);
  const tierSignature = tierIds.join("|");
  const customerKey = getCustomerKey(customerPhone);

  useEffect(() => {
    if (!customerKey || !currentTier?.id || tierIds.length === 0) return;

    const storageKey = `${STORAGE_PREFIX}:${customerKey}:${cycleYear}`;
    const seenTierId = readSeenTier(storageKey);
    const currentIndex = tierIds.indexOf(currentTier.id);
    const seenIndex = tierIds.indexOf(seenTierId);

    if (!seenTierId) {
      saveSeenTier(storageKey, currentTier.id);
      return;
    }

    if (currentIndex > seenIndex && seenIndex >= 0) {
      setCelebratedTier(currentTier);
    }

    if (currentIndex !== seenIndex) {
      saveSeenTier(storageKey, currentTier.id);
    }
  }, [customerKey, currentTier?.id, cycleYear, tierSignature]);

  return {
    celebratedTier,
    closeTierCelebration: () => setCelebratedTier(null)
  };
}
