import { useState } from "react";
import { resolveBranchFromCandidates } from "../../../services/branchIdentityService.js";

export default function useMenuBranchPicker({ branches = [], checkoutPreset = {}, setCheckoutPreset, onSelected, requestBranchChange }) {
  const [open,setOpen] = useState(false);
  const delivery = checkoutPreset.fulfillmentType === "delivery";
  const availableBranches = branches.filter(branch=>delivery ? branch.shipEnabled !== false : branch.pickupEnabled !== false);
  const selectedBranch = resolveBranchFromCandidates([delivery ? checkoutPreset.selectedDeliveryBranch : checkoutPreset.selectedBranch],availableBranches);
  const selectBranch = id => {
    if (!availableBranches.some(branch=>branch.id === id)) return;
    const commit = () => {
      setCheckoutPreset?.(current=>({...current,...(delivery ? {selectedDeliveryBranch:id} : {selectedBranch:id})}));
      setOpen(false); onSelected?.();
    };
    if (selectedBranch?.id !== id && requestBranchChange) requestBranchChange(id,commit);
    else commit();
  };
  return {open,openPicker:()=>setOpen(true),closePicker:()=>setOpen(false),availableBranches,selectedBranchId:selectedBranch?.id,selectBranch};
}
