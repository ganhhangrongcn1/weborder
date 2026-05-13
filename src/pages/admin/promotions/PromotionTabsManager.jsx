import { useMemo, useState } from "react";
import CouponManager from "./CouponManager.jsx";
import { AdminPanel } from "../ui/AdminCommon.jsx";
import StrikePriceTab from "./StrikePriceTab.jsx";
import GiftThresholdTab from "./GiftThresholdTab.jsx";
import FlashSaleTab from "./FlashSaleTab.jsx";
import FreeshipManager from "./FreeshipManager.jsx";
import { promoTabs } from "./promotionConfig.js";
import usePromotionTabsState from "./usePromotionTabsState.js";
import { catalogConfigRepository, syncPromotionCatalogToSupabase } from "../../../services/repositories/catalogConfigRepository.js";

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

  const currentSignature = useMemo(
    () => JSON.stringify({
      promos: promos || [],
      campaigns: campaigns || [],
      coupons: coupons || [],
      smartPromotions: smartPromotions || []
    }),
    [promos, campaigns, coupons, smartPromotions]
  );
  const [lastSavedSignature, setLastSavedSignature] = useState(currentSignature);
  const hasUnsavedChanges = currentSignature !== lastSavedSignature;

  const handleSavePromotions = async () => {
    if (!hasUnsavedChanges || isSaving) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      await Promise.all([
        catalogConfigRepository.setAsync("ghr_promos", promos || []),
        catalogConfigRepository.setAsync("ghr_campaigns", campaigns || []),
        catalogConfigRepository.setAsync("ghr_coupons", coupons || []),
        catalogConfigRepository.setAsync("ghr_smart_promotions", smartPromotions || [])
      ]);
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

  const renderNotConfigured = (type) => (
    <AdminPanel title="Chưa có cấu hình">
      <button className="admin-cta" onClick={() => createPromotion(type)}>
        Tạo cấu hình mặc định
      </button>
    </AdminPanel>
  );

  return (
    <section className="admin-panel admin-promo-v2 admin-promo-page">
      <div className="admin-panel-head">
        <h2>Khuyến mãi</h2>
        <button
          type="button"
          className={`admin-cta ${!hasUnsavedChanges || isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
          onClick={handleSavePromotions}
          disabled={!hasUnsavedChanges || isSaving}
        >
          {isSaving ? "Đang lưu..." : "Lưu khuyến mãi"}
        </button>
      </div>
      {saveMessage ? <p className="text-sm text-slate-600">{saveMessage}</p> : null}

      <div className="admin-menu-tabs admin-promo-tabs">
        {promoTabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={activeTab === tab.id ? "active" : ""}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "coupon" && <CouponManager coupons={coupons} setCoupons={setCoupons} />}

      {activeTab === "free_shipping" && (
        <FreeshipManager
          freeShippingPromo={freeShippingPromo}
          createPromotion={createPromotion}
          updatePromotion={updatePromotion}
        />
      )}

      {activeTab === "strike_price" && (
        strikePromos.length ? (
          <StrikePriceTab
            strikePromos={strikePromos}
            selectedStrikePromo={selectedStrikePromo}
            setSelectedStrikePromoId={setSelectedStrikePromoId}
            createPromotion={createPromotion}
            preview={preview}
            updatePromotion={updatePromotion}
            activeCategories={activeCategories}
            activeProducts={activeProducts}
            setSmartPromotions={setSmartPromotions}
            smartPromotions={smartPromotions}
          />
        ) : renderNotConfigured("strike_price")
      )}

      {activeTab === "flash_sale" && (
        flashSalePromos.length ? (
          <FlashSaleTab
            flashSalePromos={flashSalePromos}
            selectedFlashPromo={selectedFlashPromo}
            setSelectedFlashPromoId={setSelectedFlashPromoId}
            createPromotion={createPromotion}
            nowTick={nowTick}
            updatePromotion={updatePromotion}
            activeCategories={activeCategories}
            activeProducts={activeProducts}
            setSmartPromotions={setSmartPromotions}
            smartPromotions={smartPromotions}
          />
        ) : renderNotConfigured("flash_sale")
      )}

      {activeTab === "gift_threshold" && (
        giftPromo ? (
          <GiftThresholdTab
            giftPromo={giftPromo}
            updatePromotion={updatePromotion}
            activeProducts={activeProducts}
          />
        ) : renderNotConfigured("gift_threshold")
      )}
    </section>
  );
}
