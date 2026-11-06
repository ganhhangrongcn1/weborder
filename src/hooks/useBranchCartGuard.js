import { useEffect, useState } from "react";
import { resolveBranchFromCandidates } from "../services/branchIdentityService.js";
import { branchCartItemKey, getUnavailableBranchCartItems } from "../services/branchCartCompatibilityService.js";
export default function useBranchCartGuard({ cart = [], catalog = [], branches = [], setCart, catalogReady = true }) {
  const [pending, setPending] = useState(null);
  const requestChange = (branchId, commit) => {
    const branch = resolveBranchFromCandidates([branchId], branches);
    if (!branch) return;
    if (!catalogReady && cart.length) { setPending({branch,items:[],commit,waiting:true}); return; }
    const items = getUnavailableBranchCartItems(cart, catalog, branch);
    if (!items.length) { commit(); return; }
    setPending({ branch, items, commit });
  };
  const confirm = () => {
    if (!pending || pending.waiting) return;
    const items = getUnavailableBranchCartItems(cart, catalog, pending.branch);
    const approved = new Set(pending.items.map(branchCartItemKey));
    if (items.some(item => !approved.has(branchCartItemKey(item)))) { setPending({ ...pending, items }); return; }
    const remove = new Set(items.map(branchCartItemKey));
    setCart(current => current.filter(item => !remove.has(branchCartItemKey(item))));
    pending.commit(); setPending(null);
  };
  useEffect(()=>{
    if (!pending?.waiting || !catalogReady) return;
    const items=getUnavailableBranchCartItems(cart,catalog,pending.branch);
    if(items.length) setPending({...pending,items,waiting:false});
    else {pending.commit();setPending(null);}
  },[pending,catalogReady,cart,catalog]);
  return { pending, requestChange, confirm, cancel: () => setPending(null) };
}
