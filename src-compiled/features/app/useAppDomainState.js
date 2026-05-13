import { categories, products as productSeed, promos as promoSeed, toppings as toppingSeed } from "../../data/products.js";
import { defaultHomeContent, defaultSmartPromotions, defaultUserProfile } from "../../data/defaultData.js";
import { defaultDeliveryZones } from "../../constants/storeConfig.js";
import { normalizeUserProfile } from "../../utils/profile.js";
import { normalizeSmartPromotion, buildHomePromoCards } from "../../utils/pureHelpers.js";
import { createAdminAppProps } from "../admin/adminBindings.js";
import { orderStorage } from "../../services/orderService.js";
import useUIState from "../../hooks/useUIState.js";
import useProductList from "../../hooks/useProductList.js";
import useAppCoreState from "../../hooks/useAppCoreState.js";

export default function useAppDomainState() {
  const uiState = useUIState({
    productSeed,
    toppingSeed
  });

  const productState = useProductList({
    productSeed,
    toppingSeed,
    promoSeed,
    defaultHomeContent,
    defaultSmartPromotions,
    categories,
    defaultDeliveryZones,
    normalizeSmartPromotion,
    buildHomePromoCards,
    activeCategory: uiState.activeCategory,
    currentPage: uiState.page
  });

  const coreState = useAppCoreState({
    normalizeUserProfile,
    defaultUserProfile
  });

  const adminAppProps = createAdminAppProps({
    storeProducts: productState.storeProducts,
    setStoreProducts: productState.setStoreProducts,
    storeToppings: productState.storeToppings,
    setStoreToppings: productState.setStoreToppings,
    storePromos: productState.storePromos,
    setStorePromos: productState.setStorePromos,
    homeBanners: productState.homeBanners,
    setHomeBanners: productState.setHomeBanners,
    homeContent: productState.homeContent,
    setHomeContent: productState.setHomeContent,
    adminCoupons: productState.adminCoupons,
    setAdminCoupons: productState.setAdminCoupons,
    smartPromotions: productState.smartPromotions,
    setSmartPromotions: productState.setSmartPromotions,
    campaigns: productState.campaigns,
    setCampaigns: productState.setCampaigns,
    branches: productState.branches,
    setBranches: productState.setBranches,
    hours: productState.hours,
    setHours: productState.setHours,
    deliveryZones: productState.deliveryZones,
    setDeliveryZones: productState.setDeliveryZones,
    adminCategories: productState.adminCategories,
    setAdminCategories: productState.setAdminCategories,
    normalizeSmartPromotion,
    orderStorage
  });

  return {
    uiState,
    productState,
    coreState,
    adminAppProps,
    shared: {
      productSeed,
      toppingSeed,
      defaultDeliveryZones,
      normalizeSmartPromotion
    }
  };
}
