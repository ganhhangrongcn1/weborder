import { useEffect } from "react";

function isSameCheckoutPreset(current, next) {
  return (
    String(current?.fulfillmentType || "") === String(next.fulfillmentType || "") &&
    String(current?.selectedBranch || "") === String(next.selectedBranch || "") &&
    String(current?.pickupMode || "") === String(next.pickupMode || "") &&
    String(current?.pickupDate || "") === String(next.pickupDate || "") &&
    String(current?.pickupClock || "") === String(next.pickupClock || "") &&
    String(current?.selectedDeliveryBranch || "") === String(next.selectedDeliveryBranch || "")
  );
}

export default function useCheckoutPresetSync({
  setCheckoutPreset,
  fulfillmentType,
  selectedBranch,
  pickupMode,
  pickupDate,
  pickupClock,
  selectedDeliveryBranch
}) {
  useEffect(() => {
    const nextFields = {
      fulfillmentType,
      selectedBranch,
      pickupMode,
      pickupDate,
      pickupClock,
      selectedDeliveryBranch: selectedDeliveryBranch || ""
    };

    setCheckoutPreset?.((current) => {
      const mergedPreset = {
        ...(current || {}),
        ...nextFields
      };
      return isSameCheckoutPreset(current, mergedPreset) ? current : mergedPreset;
    });
  }, [
    fulfillmentType,
    selectedBranch,
    pickupMode,
    pickupDate,
    pickupClock,
    selectedDeliveryBranch,
    setCheckoutPreset
  ]);
}
