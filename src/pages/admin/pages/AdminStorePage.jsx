import AdminBackofficeSections from "../AdminBackofficeSections.jsx";

export default function AdminStorePage({
  activeSubSection,
  branches,
  setBranches,
  hours,
  setHours,
  deliveryZones,
  setDeliveryZones,
  shippingConfig,
  setShippingConfig,
  onSaveShipping,
  zaloConfig,
  setZaloConfig,
  onSaveZalo
}) {
  return (
    <AdminBackofficeSections
      section="store"
      activeSubSection={activeSubSection}
      activeCampaignTab="coupon"
      setActiveCampaignTab={() => {}}
      promos={[]}
      setPromos={() => {}}
      homeContent={[]}
      setHomeContent={() => {}}
      onDirtyChange={() => {}}
      products={[]}
      banners={[]}
      setBanners={() => {}}
      campaigns={[]}
      setCampaigns={() => {}}
      coupons={[]}
      setCoupons={() => {}}
      shippingConfig={shippingConfig}
      setShippingConfig={setShippingConfig}
      smartPromotions={[]}
      setSmartPromotions={() => {}}
      normalizeSmartPromotion={(item) => item}
      branches={branches}
      setBranches={setBranches}
      hours={hours}
      setHours={setHours}
      deliveryZones={deliveryZones}
      setDeliveryZones={setDeliveryZones}
      onSaveShipping={onSaveShipping}
      zaloConfig={zaloConfig}
      setZaloConfig={setZaloConfig}
      onSaveZalo={onSaveZalo}
      onSaveLoyaltyRule={() => {}}
      onSaveLoyaltyRulesRows={() => {}}
      onSaveLoyaltyBonusDisplay={() => {}}
      onSaveLoyaltyConfig={() => {}}
    />
  );
}
