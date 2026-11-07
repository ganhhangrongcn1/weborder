import { useState } from "react";
import { resolveBranchFromCandidates } from "../../../services/branchIdentityService.js";

export default function useMenuBranchPicker({ branches = [], checkoutPreset = {}, setCheckoutPreset, onSelected, requestBranchChange }) {
  const [destination,setDestination] = useState(null);
  const delivery = checkoutPreset.fulfillmentType === "delivery";
  const availableBranches = branches.filter(branch=>delivery ? branch.shipEnabled !== false : branch.pickupEnabled !== false);
  const selectedBranch = resolveBranchFromCandidates([delivery ? checkoutPreset.selectedDeliveryBranch : checkoutPreset.selectedBranch],availableBranches);
  const selectBranch = (id, schedule) => {
    if (!availableBranches.some(branch=>branch.id === id)) return;
    const commit = () => {
      setCheckoutPreset?.(current=>({...current,...(delivery ? {selectedDeliveryBranch:id} : {
        selectedBranch:id,
        pickupMode:schedule?.pickupMode || (destination !== "checkout" && selectedBranch?.id === id ? current?.pickupMode : "soon"),
        ...(schedule && { pickupDate:schedule.pickupDate, pickupClock:schedule.pickupClock })
      })}));
      setDestination(null); onSelected?.(destination);
    };
    if ((destination === "checkout" || selectedBranch?.id !== id) && requestBranchChange) requestBranchChange(id,commit);
    else commit();
  };
  return {open:Boolean(destination),destination,openPicker:(target)=>setDestination(target === "checkout" ? "checkout" : "menu"),closePicker:()=>setDestination(null),availableBranches,selectedBranchId:selectedBranch?.id,selectBranch,allowScheduledPickup:!delivery};
}
