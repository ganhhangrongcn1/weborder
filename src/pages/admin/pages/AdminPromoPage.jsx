import AdminBackofficeSections from "../AdminBackofficeSections.jsx";

export default function AdminPromoPage({
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
  onSaveLoyaltyRule,
  onSaveLoyaltyRulesRows,
  onSaveLoyaltyBonusDisplay,
  onSaveLoyaltyConfig
}) {
  return (
    <AdminBackofficeSections
      section="promo"
      uiDirty={uiDirty}
      activeSubSection={activeSubSection}
      activeCampaignTab={activeCampaignTab}
      setActiveCampaignTab={setActiveCampaignTab}
      promos={promos}
      setPromos={setPromos}
      homeContent={homeContent}
      setHomeContent={setHomeContent}
      onDirtyChange={onDirtyChange}
      products={products}
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
      branches={branches}
      setBranches={setBranches}
      hours={[]}
      setHours={() => {}}
      deliveryZones={[]}
      setDeliveryZones={() => {}}
      onSaveShipping={() => {}}
      zaloConfig={{}}
      setZaloConfig={() => {}}
      onSaveZalo={() => {}}
      onSaveLoyaltyRule={onSaveLoyaltyRule}
      onSaveLoyaltyRulesRows={onSaveLoyaltyRulesRows}
      onSaveLoyaltyBonusDisplay={onSaveLoyaltyBonusDisplay}
      onSaveLoyaltyConfig={onSaveLoyaltyConfig}
    />
  );
}
