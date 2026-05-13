import { useEffect } from "react";

export default function useCheckoutPickupBranchState({
  pickupBranches,
  selectedBranch,
  setSelectedBranch,
  fulfillmentType,
  setIsChangingBranch
}) {
  useEffect(() => {
    if (!pickupBranches.length) return;
    const stillExists = pickupBranches.some((branch) => branch.id === selectedBranch);
    if (!selectedBranch || !stillExists) {
      setSelectedBranch(pickupBranches[0].id);
    }
  }, [pickupBranches, selectedBranch, setSelectedBranch]);

  useEffect(() => {
    if (fulfillmentType !== "pickup") {
      setIsChangingBranch(false);
    }
  }, [fulfillmentType, setIsChangingBranch]);
}
