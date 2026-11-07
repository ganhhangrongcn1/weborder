import { isValidPickupSchedule } from "../../utils/dateTimeDefaults.js";

export function createHomeFulfillmentActions({
  deliveryBranches,
  pickupBranches,
  setServiceNotice,
  buildDeliveryDisabledNotice,
  buildPickupDisabledNotice,
  buildStoreOfflineNotice,
  buildOutOfHoursNotice,
  setHomeFulfillment,
  setDeliveryPlannerOpen,
  openDeliveryApps,
  setPickupPlannerOpen,
  selectedDeliveryBranchInfo,
  isBranchOpenNow,
  setCheckoutPreset,
  pickupBranch,
  pickupMode,
  pickupDate,
  pickupClock,
  navigate
}) {
  const openMenuWithDelivery = () => {
    if (!deliveryBranches.length) {
      if (openDeliveryApps) {
        openDeliveryApps();
      } else {
        setServiceNotice?.(buildDeliveryDisabledNotice?.() || buildStoreOfflineNotice?.());
      }
      return;
    }
    setHomeFulfillment("delivery");
    setDeliveryPlannerOpen(true);
  };

  const confirmDeliveryAndOpenMenu = (branchId = "") => {
    const selectedBranchInfo = branchId
      ? deliveryBranches.find((branch) => branch.id === branchId) || null
      : selectedDeliveryBranchInfo;

    if (!selectedBranchInfo) {
      setServiceNotice?.(buildStoreOfflineNotice?.());
      return;
    }
    if (!isBranchOpenNow(selectedBranchInfo)) {
      setServiceNotice?.(buildOutOfHoursNotice?.(selectedBranchInfo));
      return;
    }
    setCheckoutPreset?.({
      fulfillmentType: "delivery",
      selectedBranch: pickupBranch,
      selectedDeliveryBranch: selectedBranchInfo.id || "",
      pickupMode,
      pickupDate,
      pickupClock
    });
    setDeliveryPlannerOpen(false);
    navigate("menu", "menu");
  };

  const openPickupPlanner = () => {
    if (!pickupBranches.length) {
      setServiceNotice?.(buildPickupDisabledNotice?.() || buildStoreOfflineNotice?.());
      return;
    }
    setHomeFulfillment("pickup");
    setPickupPlannerOpen(true);
    setDeliveryPlannerOpen(false);
  };

  const confirmPickupAndOpenMenu = (branchId = "", schedule) => {
    const selectedPickupBranchInfo = branchId
      ? pickupBranches.find((branch) => branch.id === branchId) || null
      : pickupBranches.find((branch) => branch.id === pickupBranch) || pickupBranches[0] || null;

    if (!selectedPickupBranchInfo) {
      setServiceNotice?.(buildPickupDisabledNotice?.() || buildStoreOfflineNotice?.());
      return;
    }
    if (!isBranchOpenNow(selectedPickupBranchInfo) && !isValidPickupSchedule(schedule?.pickupDate, schedule?.pickupClock, selectedPickupBranchInfo)) {
      setServiceNotice?.(buildOutOfHoursNotice?.(selectedPickupBranchInfo));
      return;
    }
    setCheckoutPreset?.({
      fulfillmentType: "pickup",
      selectedBranch: selectedPickupBranchInfo.id || pickupBranch,
      selectedDeliveryBranch: selectedDeliveryBranchInfo?.id || "",
      pickupMode: schedule?.pickupMode || pickupMode,
      pickupDate: schedule?.pickupDate || pickupDate,
      pickupClock: schedule?.pickupClock || pickupClock
    });
    setPickupPlannerOpen(false);
    navigate("menu", "menu");
  };

  return {
    openMenuWithDelivery,
    confirmDeliveryAndOpenMenu,
    openPickupPlanner,
    confirmPickupAndOpenMenu
  };
}
