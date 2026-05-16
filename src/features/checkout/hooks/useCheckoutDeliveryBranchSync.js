import { useEffect, useRef } from "react";

export default function useCheckoutDeliveryBranchSync({
  syncSelectedDeliveryBranch,
  deliveryEligibleBranches,
  selectedDeliveryBranchId,
  checkoutPreset,
  setSelectedDeliveryBranchId
}) {
  const lastPresetBranchRef = useRef("");

  useEffect(() => {
    syncSelectedDeliveryBranch();
  }, [syncSelectedDeliveryBranch, deliveryEligibleBranches, selectedDeliveryBranchId]);

  useEffect(() => {
    const presetDeliveryBranchId = String(checkoutPreset?.selectedDeliveryBranch || "");
    if (!presetDeliveryBranchId) return;

    // Only apply preset when it truly changes from outside.
    // Prevents jitter when user is actively switching branch in Address modal.
    if (lastPresetBranchRef.current === presetDeliveryBranchId) return;
    lastPresetBranchRef.current = presetDeliveryBranchId;

    if (presetDeliveryBranchId === String(selectedDeliveryBranchId || "")) return;
    setSelectedDeliveryBranchId(presetDeliveryBranchId);
  }, [checkoutPreset?.selectedDeliveryBranch, selectedDeliveryBranchId, setSelectedDeliveryBranchId]);
}
