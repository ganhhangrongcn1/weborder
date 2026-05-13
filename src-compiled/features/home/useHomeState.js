import { useEffect, useState } from "react";

export default function useHomeState({
  checkoutPreset,
  bannersLength,
  smartPromotions,
  parseDateTime,
  showHomePopup,
  popupDelaySeconds,
  popupSessionKey,
  deliveryBranches
}) {
  const [activeBanner, setActiveBanner] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [flashModalOpen, setFlashModalOpen] = useState(false);
  const [homeFulfillment, setHomeFulfillment] = useState(checkoutPreset?.fulfillmentType || "delivery");
  const [deliveryPlannerOpen, setDeliveryPlannerOpen] = useState(false);
  const [pickupPlannerOpen, setPickupPlannerOpen] = useState(false);
  const [pickupBranch, setPickupBranch] = useState(checkoutPreset?.selectedBranch || "phu-hoa");
  const [selectedDeliveryBranch, setSelectedDeliveryBranch] = useState(checkoutPreset?.selectedDeliveryBranch || "");
  const [pickupMode, setPickupMode] = useState(checkoutPreset?.pickupMode || "soon");
  const [pickupDate, setPickupDate] = useState(checkoutPreset?.pickupDate || "2026-05-02");
  const [pickupClock, setPickupClock] = useState(checkoutPreset?.pickupClock || "12:30");
  const [homeCategory, setHomeCategory] = useState("");
  const [showAllHomeProducts, setShowAllHomeProducts] = useState(false);
  const [homePopupOpen, setHomePopupOpen] = useState(false);

  const selectedDeliveryBranchInfo = deliveryBranches.find((branch) => branch.id === selectedDeliveryBranch) || deliveryBranches[0] || null;

  useEffect(() => {
    if (!selectedDeliveryBranchInfo && deliveryBranches.length > 0) {
      setSelectedDeliveryBranch(deliveryBranches[0].id);
    }
  }, [deliveryBranches, selectedDeliveryBranchInfo]);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveBanner((index) => (index + 1) % Math.max(bannersLength, 1)), 4200);
    return () => window.clearInterval(timer);
  }, [bannersLength]);

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
  }, [smartPromotions, parseDateTime]);

  useEffect(() => {
    setHomePopupOpen(false);
    if (!showHomePopup) return undefined;
    try {
      if (sessionStorage.getItem(popupSessionKey) === "1") return undefined;
    } catch {
      // ignore storage errors
    }
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(popupSessionKey, "1");
      } catch {
        // ignore storage errors
      }
      setHomePopupOpen(true);
    }, popupDelaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [showHomePopup, popupDelaySeconds, popupSessionKey]);

  return {
    activeBanner,
    setActiveBanner,
    secondsLeft,
    flashModalOpen,
    setFlashModalOpen,
    homeFulfillment,
    setHomeFulfillment,
    deliveryPlannerOpen,
    setDeliveryPlannerOpen,
    pickupPlannerOpen,
    setPickupPlannerOpen,
    pickupBranch,
    setPickupBranch,
    selectedDeliveryBranch,
    setSelectedDeliveryBranch,
    pickupMode,
    setPickupMode,
    pickupDate,
    setPickupDate,
    pickupClock,
    setPickupClock,
    homeCategory,
    setHomeCategory,
    showAllHomeProducts,
    setShowAllHomeProducts,
    homePopupOpen,
    setHomePopupOpen,
    selectedDeliveryBranchInfo
  };
}
