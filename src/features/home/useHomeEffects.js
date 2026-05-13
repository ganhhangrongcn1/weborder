import { useEffect } from "react";

export default function useHomeEffects({
  selectedDeliveryBranchInfo,
  deliveryBranches,
  setSelectedDeliveryBranch,
  setActiveBanner,
  bannersLength,
  smartPromotions,
  parseDateTime,
  setSecondsLeft,
  setHomePopupOpen,
  showHomePopup,
  popupDelaySeconds,
  popupSessionKey,
  popupCooldownKey,
  popupCooldownHours
}) {
  useEffect(() => {
    if (!selectedDeliveryBranchInfo && deliveryBranches.length > 0) {
      setSelectedDeliveryBranch(deliveryBranches[0].id);
    }
  }, [deliveryBranches, selectedDeliveryBranchInfo, setSelectedDeliveryBranch]);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveBanner((index) => (index + 1) % Math.max(bannersLength, 1)), 4200);
    return () => window.clearInterval(timer);
  }, [bannersLength, setActiveBanner]);

  useEffect(() => {
    const getActiveFlashEnd = () => {
      const now = new Date();
      const activeEnds = (smartPromotions || [])
        .filter((promo) => promo?.type === "flash_sale" && promo?.active !== false)
        .filter((promo) => {
          const sold = Number(promo?.condition?.soldCount || 0);
          const total = Number(promo?.condition?.totalSlots || 0);
          return total <= 0 || sold < total;
        })
        .map((promo) => parseDateTime(promo?.endAt, promo?.condition?.endTime, "23:59"))
        .filter((date) => date && date.getTime() > now.getTime())
        .sort((a, b) => a.getTime() - b.getTime());
      return activeEnds[0] || null;
    };

    const syncCountdown = () => {
      const nextEnd = getActiveFlashEnd();
      if (!nextEnd) {
        setSecondsLeft(0);
        return;
      }
      setSecondsLeft(Math.max(0, Math.floor((nextEnd.getTime() - Date.now()) / 1000)));
    };

    syncCountdown();
    const timer = window.setInterval(syncCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [smartPromotions, parseDateTime, setSecondsLeft]);

  useEffect(() => {
    setHomePopupOpen(false);
    if (!showHomePopup) return undefined;
    try {
      if (sessionStorage.getItem(popupSessionKey) === "1") return undefined;
      const lastSeenAt = Number(localStorage.getItem(popupCooldownKey) || 0);
      const cooldownMs = Math.max(0, Number(popupCooldownHours || 0)) * 60 * 60 * 1000;
      if (cooldownMs > 0 && lastSeenAt > 0 && Date.now() - lastSeenAt < cooldownMs) return undefined;
    } catch {
      // ignore storage errors
    }
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(popupSessionKey, "1");
        localStorage.setItem(popupCooldownKey, String(Date.now()));
      } catch {
        // ignore storage errors
      }
      setHomePopupOpen(true);
    }, popupDelaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [showHomePopup, popupDelaySeconds, popupSessionKey, popupCooldownKey, popupCooldownHours, setHomePopupOpen]);
}
