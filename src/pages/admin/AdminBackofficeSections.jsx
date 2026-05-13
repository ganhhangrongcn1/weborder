import ZaloSettings from "./store/ZaloSettings.jsx";
import AppearanceSettings from "./store/AppearanceSettings.jsx";
import BranchSettings from "./store/BranchSettings.jsx";
import PromotionTabsManager from "./promotions/PromotionTabsManager.jsx";
import { AdminPlaceholder } from "./ui/AdminCommon.jsx";

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
  return (
    <>
      {section === "promo" && (
        <div className="admin-stack">
          {activeSubSection === "ui" && (
            <AppearanceSettings
              uiDirty={uiDirty}
              homeContent={homeContent}
              setHomeContent={setHomeContent}
              banners={banners}
              promos={promos}
              setPromos={setPromos}
              branches={branches}
              products={products}
              smartPromotions={smartPromotions}
              onDirtyChange={onDirtyChange}
            />
          )}

          {activeSubSection === "campaign" && (
            <PromotionTabsManager
              activeCampaignTab={activeCampaignTab}
              setActiveCampaignTab={setActiveCampaignTab}
              products={products}
              promos={promos}
              banners={banners}
              setBanners={setBanners}
              campaigns={campaigns}
              setCampaigns={setCampaigns}
              coupons={coupons}
              setCoupons={setCoupons}
              shippingConfig={shippingConfig}
              setShippingConfig={setShippingConfig}
              smartPromotions={smartPromotions}
              setSmartPromotions={setSmartPromotions}
              normalizeSmartPromotion={normalizeSmartPromotion}
              onSaveLoyaltyRule={onSaveLoyaltyRule}
              onSaveLoyaltyRulesRows={onSaveLoyaltyRulesRows}
              onSaveLoyaltyBonusDisplay={onSaveLoyaltyBonusDisplay}
              onSaveLoyaltyConfig={onSaveLoyaltyConfig}
            />
          )}
        </div>
      )}

      {section === "store" && (
        <div className="admin-stack">
          {activeSubSection === "branches" && (
            <BranchSettings
              branches={branches}
              setBranches={setBranches}
              hours={hours}
              setHours={setHours}
              deliveryZones={deliveryZones}
              setDeliveryZones={setDeliveryZones}
              shippingConfig={shippingConfig}
              setShippingConfig={setShippingConfig}
              onSaveShippingConfig={onSaveShipping}
            />
          )}

          {activeSubSection === "zalo" && (
            <ZaloSettings zaloConfig={zaloConfig} setZaloConfig={setZaloConfig} onSave={onSaveZalo} />
          )}

          {!["branches", "zalo"].includes(activeSubSection) && (
            <AdminPlaceholder text="Đang phát triển" />
          )}
        </div>
      )}
    </>
  );
}
