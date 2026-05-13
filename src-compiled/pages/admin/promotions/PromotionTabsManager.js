import { useMemo, useState } from "react";
import CouponManager from "./CouponManager.js";
import { AdminPanel } from "../ui/AdminCommon.js";
import StrikePriceTab from "./StrikePriceTab.js";
import GiftThresholdTab from "./GiftThresholdTab.js";
import FlashSaleTab from "./FlashSaleTab.js";
import FreeshipManager from "./FreeshipManager.js";
import { promoTabs } from "./promotionConfig.js";
import usePromotionTabsState from "./usePromotionTabsState.js";
import { catalogConfigRepository, syncPromotionCatalogToSupabase } from "../../../services/repositories/catalogConfigRepository.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function PromotionTabsManager({
  products,
  promos,
  campaigns,
  coupons,
  setCoupons,
  smartPromotions,
  setSmartPromotions,
  normalizeSmartPromotion
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const {
    activeTab,
    setActiveTab,
    nowTick,
    activeProducts,
    activeCategories,
    updatePromotion,
    createPromotion,
    strikePromos,
    selectedStrikePromo,
    setSelectedStrikePromoId,
    preview,
    flashSalePromos,
    selectedFlashPromo,
    setSelectedFlashPromoId,
    freeShippingPromo,
    giftPromo
  } = usePromotionTabsState({
    products,
    smartPromotions,
    setSmartPromotions,
    normalizeSmartPromotion
  });
  const currentSignature = useMemo(() => JSON.stringify({
    promos: promos || [],
    campaigns: campaigns || [],
    coupons: coupons || [],
    smartPromotions: smartPromotions || []
  }), [promos, campaigns, coupons, smartPromotions]);
  const [lastSavedSignature, setLastSavedSignature] = useState(currentSignature);
  const hasUnsavedChanges = currentSignature !== lastSavedSignature;
  const handleSavePromotions = async () => {
    if (!hasUnsavedChanges || isSaving) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      await Promise.all([catalogConfigRepository.setAsync("ghr_promos", promos || []), catalogConfigRepository.setAsync("ghr_campaigns", campaigns || []), catalogConfigRepository.setAsync("ghr_coupons", coupons || []), catalogConfigRepository.setAsync("ghr_smart_promotions", smartPromotions || [])]);
      await syncPromotionCatalogToSupabase({
        promos,
        campaigns,
        coupons,
        smartPromotions
      });
      setLastSavedSignature(currentSignature);
      setSaveMessage("Đã lưu khuyến mãi.");
    } catch (error) {
      console.warn("[PromotionTabsManager] save promotions failed", error);
      setSaveMessage("Lưu khuyến mãi thất bại. Kiểm tra RLS policy write cho catalog.");
    } finally {
      setIsSaving(false);
    }
  };
  const renderNotConfigured = type => /*#__PURE__*/_jsx(AdminPanel, {
    title: "Ch\u01B0a c\xF3 c\u1EA5u h\xECnh",
    children: /*#__PURE__*/_jsx("button", {
      className: "admin-cta",
      onClick: () => createPromotion(type),
      children: "T\u1EA1o c\u1EA5u h\xECnh m\u1EB7c \u0111\u1ECBnh"
    })
  });
  return /*#__PURE__*/_jsxs("section", {
    className: "admin-panel admin-promo-v2 admin-promo-page",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "admin-panel-head",
      children: [/*#__PURE__*/_jsx("h2", {
        children: "Khuy\u1EBFn m\xE3i"
      }), /*#__PURE__*/_jsx("button", {
        type: "button",
        className: `admin-cta ${!hasUnsavedChanges || isSaving ? "opacity-60 cursor-not-allowed" : ""}`,
        onClick: handleSavePromotions,
        disabled: !hasUnsavedChanges || isSaving,
        children: isSaving ? "Đang lưu..." : "Lưu khuyến mãi"
      })]
    }), saveMessage ? /*#__PURE__*/_jsx("p", {
      className: "text-sm text-slate-600",
      children: saveMessage
    }) : null, /*#__PURE__*/_jsx("div", {
      className: "admin-menu-tabs admin-promo-tabs",
      children: promoTabs.map(tab => /*#__PURE__*/_jsx("button", {
        onClick: () => setActiveTab(tab.id),
        className: activeTab === tab.id ? "active" : "",
        children: tab.label
      }, tab.id))
    }), activeTab === "coupon" && /*#__PURE__*/_jsx(CouponManager, {
      coupons: coupons,
      setCoupons: setCoupons
    }), activeTab === "free_shipping" && /*#__PURE__*/_jsx(FreeshipManager, {
      freeShippingPromo: freeShippingPromo,
      createPromotion: createPromotion,
      updatePromotion: updatePromotion
    }), activeTab === "strike_price" && (strikePromos.length ? /*#__PURE__*/_jsx(StrikePriceTab, {
      strikePromos: strikePromos,
      selectedStrikePromo: selectedStrikePromo,
      setSelectedStrikePromoId: setSelectedStrikePromoId,
      createPromotion: createPromotion,
      preview: preview,
      updatePromotion: updatePromotion,
      activeCategories: activeCategories,
      activeProducts: activeProducts,
      setSmartPromotions: setSmartPromotions,
      smartPromotions: smartPromotions
    }) : renderNotConfigured("strike_price")), activeTab === "flash_sale" && (flashSalePromos.length ? /*#__PURE__*/_jsx(FlashSaleTab, {
      flashSalePromos: flashSalePromos,
      selectedFlashPromo: selectedFlashPromo,
      setSelectedFlashPromoId: setSelectedFlashPromoId,
      createPromotion: createPromotion,
      nowTick: nowTick,
      updatePromotion: updatePromotion,
      activeCategories: activeCategories,
      activeProducts: activeProducts,
      setSmartPromotions: setSmartPromotions,
      smartPromotions: smartPromotions
    }) : renderNotConfigured("flash_sale")), activeTab === "gift_threshold" && (giftPromo ? /*#__PURE__*/_jsx(GiftThresholdTab, {
      giftPromo: giftPromo,
      updatePromotion: updatePromotion,
      activeProducts: activeProducts
    }) : renderNotConfigured("gift_threshold"))]
  });
}