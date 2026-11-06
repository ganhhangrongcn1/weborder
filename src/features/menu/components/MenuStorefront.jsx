import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { getBranchHours } from "../../home/homeHelpers.js";
import { resolveBranchFromCandidates } from "../../../services/branchIdentityService.js";
import { buildHomeVoucherCards } from "../../../services/homeVoucherService.js";
import MenuVoucherRail from "./MenuVoucherRail.jsx";
import HomeBranchPlannerModal from "../../home/components/HomeBranchPlannerModal.jsx";
import useMenuBranchPicker from "../hooks/useMenuBranchPicker.js";

export default function MenuStorefront({ homeContent = [], branches = [], checkoutPreset = {}, setCheckoutPreset, products = [], coupons = [], smartPromotions = [], demoLoyalty = {}, currentPhone = "", isRegisteredCustomer = false, requestBranchChange }) {
  const [now, setNow] = useState(() => new Date());
  const branchPicker = useMenuBranchPicker({branches,checkoutPreset,setCheckoutPreset,requestBranchChange});
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(timer); }, []);
  const brand = homeContent.find((block) => block.id === "siteBrand");
  const branch = resolveBranchFromCandidates([checkoutPreset.qrBranchId, checkoutPreset.fulfillmentType === "delivery" ? checkoutPreset.selectedDeliveryBranch : checkoutPreset.selectedBranch], branches);
  const vouchers = useMemo(() => buildHomeVoucherCards({ coupons, smartPromotions, loyalty: demoLoyalty, products, currentPhone, isRegisteredCustomer, now }), [coupons, smartPromotions, demoLoyalty, products, currentPhone, isRegisteredCustomer, now]);
  return (
    <header className="menu-storefront">
      <div className="menu-storefront__identity">
        {brand?.logo ? <img src={brand.logo} alt="Logo Gánh Hàng Rong" width="54" height="54" /> : <span className="menu-storefront__logo">G</span>}
        <CustomerControl type="button" className="menu-storefront__branch-copy" aria-haspopup="dialog" onClick={branchPicker.openPicker}>
          <span className="menu-storefront__branch-heading"><h2>{branch?.name || "Chọn chi nhánh"}</h2><Icon name="back" size={18} /></span>
          {branch ? <><p>{branch.address || branch.name}</p><p>Giờ mở cửa: {getBranchHours(branch).label}</p></> : <p>Chọn quán để xem thực đơn</p>}
        </CustomerControl>
      </div>
      <MenuVoucherRail vouchers={vouchers} />
      <HomeBranchPlannerModal open={branchPicker.open} onClose={branchPicker.closePicker}
        title="Chọn chi nhánh" subtitle="Thực đơn sẽ cập nhật theo quán bạn chọn." iconName="store" enableNearby
        branches={branchPicker.availableBranches} selectedBranchId={branchPicker.selectedBranchId}
        onSelectBranch={()=>{}} onConfirm={branchPicker.selectBranch} />
    </header>
  );
}
