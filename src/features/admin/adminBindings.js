import { catalogConfigRepository, CATALOG_CONFIG_KEYS } from "../../services/repositories/catalogConfigRepository.js";
import { isSupabaseConfigSyncEnabled } from "../../services/supabase/runtimeFlags.js";

function isStorageQuotaError(error) {
  if (!error) return false;
  const name = String(error.name || "");
  const message = String(error.message || "").toLowerCase();
  const code = Number(error.code || 0);
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014 ||
    message.includes("exceeded the quota") ||
    message.includes("quota")
  );
}

export function createAdminAppProps({
  storeProducts,
  setStoreProducts,
  storeToppings,
  setStoreToppings,
  storePromos,
  setStorePromos,
  homeBanners,
  setHomeBanners,
  homeContent,
  setHomeContent,
  adminCoupons,
  setAdminCoupons,
  smartPromotions,
  setSmartPromotions,
  campaigns,
  setCampaigns,
  branches,
  setBranches,
  hours,
  setHours,
  deliveryZones,
  setDeliveryZones,
  adminCategories,
  setAdminCategories,
  normalizeSmartPromotion,
  orderStorage
}) {
  const resolveNextValue = (currentValue, valueOrUpdater) =>
    typeof valueOrUpdater === "function" ? valueOrUpdater(currentValue) : valueOrUpdater;
  const supabaseConfigSyncEnabled = isSupabaseConfigSyncEnabled();

  const persistCatalogValue = (storageKey, nextValue, stateSetter) => {
    try {
      const savedLocal = catalogConfigRepository.set(storageKey, nextValue);
      stateSetter(savedLocal);
      if (supabaseConfigSyncEnabled) {
        catalogConfigRepository.setAsync(storageKey, savedLocal).catch((error) => {
          console.warn(`[adminBindings] async sync failed for key "${storageKey}"`, error);
        });
      }
    } catch (error) {
      if (isStorageQuotaError(error)) {
        window.alert("Bộ nhớ trình duyệt đã đầy. Hãy giảm số lượng/kích thước ảnh banner hoặc xóa bớt dữ liệu cũ.");
        return;
      }
      throw error;
    }
  };

  return {
    products: storeProducts,
    setProducts: value => {
      const nextValue = resolveNextValue(storeProducts, value);
      persistCatalogValue(CATALOG_CONFIG_KEYS.products, nextValue, setStoreProducts);
    },
    toppings: storeToppings,
    setToppings: value => {
      const nextValue = resolveNextValue(storeToppings, value);
      persistCatalogValue(CATALOG_CONFIG_KEYS.toppings, nextValue, setStoreToppings);
    },
    promos: storePromos,
    setPromos: value => {
      const nextValue = resolveNextValue(storePromos, value);
      persistCatalogValue(CATALOG_CONFIG_KEYS.promos, nextValue, setStorePromos);
    },
    banners: homeBanners,
    setBanners: value => {
      const nextValue = resolveNextValue(homeBanners, value);
      persistCatalogValue(CATALOG_CONFIG_KEYS.banners, nextValue, setHomeBanners);
    },
    homeContent: homeContent,
    setHomeContent: value => {
      const nextValue = resolveNextValue(homeContent, value);
      persistCatalogValue(CATALOG_CONFIG_KEYS.homeContent, nextValue, setHomeContent);
    },
    coupons: adminCoupons,
    setCoupons: value => {
      const nextValue = resolveNextValue(adminCoupons, value);
      persistCatalogValue(CATALOG_CONFIG_KEYS.coupons, nextValue, setAdminCoupons);
    },
    smartPromotions: smartPromotions,
    setSmartPromotions: value => {
      const nextValue = resolveNextValue(smartPromotions, value).map(normalizeSmartPromotion);
      persistCatalogValue(CATALOG_CONFIG_KEYS.smartPromotions, nextValue, setSmartPromotions);
    },
    campaigns: campaigns,
    setCampaigns: value => {
      const nextValue = resolveNextValue(campaigns, value);
      persistCatalogValue(CATALOG_CONFIG_KEYS.campaigns, nextValue, setCampaigns);
    },
    branches: branches,
    setBranches: value => {
      const nextValue = resolveNextValue(branches, value);
      persistCatalogValue(CATALOG_CONFIG_KEYS.branches, nextValue, setBranches);
    },
    hours: hours,
    setHours: value => {
      const nextValue = resolveNextValue(hours, value);
      persistCatalogValue(CATALOG_CONFIG_KEYS.hours, nextValue, setHours);
    },
    deliveryZones: deliveryZones,
    setDeliveryZones: value => {
      const nextValue = resolveNextValue(deliveryZones, value);
      persistCatalogValue(CATALOG_CONFIG_KEYS.zones, nextValue, setDeliveryZones);
    },
    adminCategories: adminCategories,
    setAdminCategories: value => {
      const nextValue = resolveNextValue(adminCategories, value);
      persistCatalogValue(CATALOG_CONFIG_KEYS.categories, nextValue, setAdminCategories);
    },
    normalizeSmartPromotion: normalizeSmartPromotion,
    orderStorage: orderStorage
  };
}
