import ZaloSettings from "./store/ZaloSettings.js";
import AppearanceSettings from "./store/AppearanceSettings.js";
import BranchSettings from "./store/BranchSettings.js";
import PromotionTabsManager from "./promotions/PromotionTabsManager.js";
import { AdminPlaceholder } from "./ui/AdminCommon.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function AdminBackofficeSections({
  section,
  uiDirty,
  activeSubSection,
  activeCampaignTab,
  setActiveCampaignTab,
  promos,
  setPromos,
  homeContent,
  setHomeContent,
  onDirtyChange,
  products,
  banners,
  setBanners,
  campaigns,
  setCampaigns,
  coupons,
  setCoupons,
  shippingConfig,
  setShippingConfig,
  smartPromotions,
  setSmartPromotions,
  normalizeSmartPromotion,
  branches,
  setBranches,
  hours,
  setHours,
  deliveryZones,
  setDeliveryZones,
  onSaveShipping,
  zaloConfig,
  setZaloConfig,
  onSaveZalo,
  onSaveLoyaltyRule,
  onSaveLoyaltyRulesRows,
  onSaveLoyaltyBonusDisplay,
  onSaveLoyaltyConfig
}) {
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [section === "promo" && /*#__PURE__*/_jsxs("div", {
      className: "admin-stack",
      children: [activeSubSection === "ui" && /*#__PURE__*/_jsx(AppearanceSettings, {
        uiDirty: uiDirty,
        homeContent: homeContent,
        setHomeContent: setHomeContent,
        banners: banners,
        promos: promos,
        setPromos: setPromos,
        branches: branches,
        products: products,
        smartPromotions: smartPromotions,
        onDirtyChange: onDirtyChange
      }), activeSubSection === "campaign" && /*#__PURE__*/_jsx(PromotionTabsManager, {
        activeCampaignTab: activeCampaignTab,
        setActiveCampaignTab: setActiveCampaignTab,
        products: products,
        promos: promos,
        banners: banners,
        setBanners: setBanners,
        campaigns: campaigns,
        setCampaigns: setCampaigns,
        coupons: coupons,
        setCoupons: setCoupons,
        shippingConfig: shippingConfig,
        setShippingConfig: setShippingConfig,
        smartPromotions: smartPromotions,
        setSmartPromotions: setSmartPromotions,
        normalizeSmartPromotion: normalizeSmartPromotion,
        onSaveLoyaltyRule: onSaveLoyaltyRule,
        onSaveLoyaltyRulesRows: onSaveLoyaltyRulesRows,
        onSaveLoyaltyBonusDisplay: onSaveLoyaltyBonusDisplay,
        onSaveLoyaltyConfig: onSaveLoyaltyConfig
      })]
    }), section === "store" && /*#__PURE__*/_jsxs("div", {
      className: "admin-stack",
      children: [activeSubSection === "branches" && /*#__PURE__*/_jsx(BranchSettings, {
        branches: branches,
        setBranches: setBranches,
        hours: hours,
        setHours: setHours,
        deliveryZones: deliveryZones,
        setDeliveryZones: setDeliveryZones,
        shippingConfig: shippingConfig,
        setShippingConfig: setShippingConfig,
        onSaveShippingConfig: onSaveShipping
      }), activeSubSection === "zalo" && /*#__PURE__*/_jsx(ZaloSettings, {
        zaloConfig: zaloConfig,
        setZaloConfig: setZaloConfig,
        onSave: onSaveZalo
      }), !["branches", "zalo"].includes(activeSubSection) && /*#__PURE__*/_jsx(AdminPlaceholder, {
        text: "\u0110ang ph\xE1t tri\u1EC3n"
      })]
    })]
  });
}