import { useMemo } from "react";
import { freeshipMinSubtotal } from "../../constants/storeConfig.js";
import { defaultPickupBranches } from "../../data/storeDefaults.js";
import { DEFAULT_SHIPPING_CONFIG } from "../../services/shippingService.js";
import { formatMoney } from "../../utils/format.js";
import { buildHomeCategories } from "../../utils/pureHelpers.js";
import { calculateSalePrice, isTopBannerItem, toIdList } from "./homeHelpers.js";

const DEFAULT_DELIVERY_APPS = [
  { id: "grab", name: "GrabFood", active: true, url: "" },
  { id: "shopee", name: "ShopeeFood", active: true, url: "" },
  { id: "xanh-ngon", name: "Xanh Ngon", active: true, url: "" }
];

function getBranchRawKey(branch, index) {
  return String(branch?.id || branch?.name || `branch-${index}`);
}

function getBranchAppKey(branch, index) {
  return `${getBranchRawKey(branch, index)}::${index}`;
}

function buildDeliveryAppBranches(deliveryAppsBlock, deliveryBranches) {
  const savedBranchApps = Array.isArray(deliveryAppsBlock?.branchApps) ? deliveryAppsBlock.branchApps : [];
  const rawKeyCounts = deliveryBranches.reduce((counts, branch, index) => {
    const rawKey = getBranchRawKey(branch, index);
    counts[rawKey] = (counts[rawKey] || 0) + 1;
    return counts;
  }, {});

  return deliveryBranches.map((branch, index) => {
    const rawKey = getBranchRawKey(branch, index);
    const branchId = getBranchAppKey(branch, index);
    const savedBranch =
      savedBranchApps.find((item) => String(item?.branchId || "") === branchId) ||
      (rawKeyCounts[rawKey] === 1 || index === 0
        ? savedBranchApps.find((item) => String(item?.branchId || "") === rawKey)
        : null) ||
      {};
    const savedApps = Array.isArray(savedBranch.apps) ? savedBranch.apps : [];

    return {
      branchId,
      branchSourceId: rawKey,
      branchName: branch?.name || savedBranch.branchName || "Chi nhánh",
      apps: DEFAULT_DELIVERY_APPS.map((app) => {
        const savedApp = savedApps.find((item) => String(item?.id || "") === app.id || String(item?.name || "") === app.name);
        return {
          ...app,
          ...savedApp,
          id: app.id,
          name: savedApp?.name || app.name,
          active: savedApp?.active !== false
        };
      }).filter((app) => app.active !== false)
    };
  }).filter((branch) => branch.apps.length);
}

function hashPopupCampaign(value) {
  const input = String(value || "");
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index) | 0;
  }
  return Math.abs(hash).toString(36);
}

export default function useHomeComputed({
  smartPromotions,
  products,
  parseDateTime,
  homeContent,
  homeText,
  categories,
  homeCategory,
  showAllHomeProducts,
  branches,
  selectedDeliveryBranch
}) {
  const safeHomeContent = Array.isArray(homeContent) ? homeContent : [];
  const visibleProducts = products.filter((product) => product.visible !== false);

  const flashProducts = useMemo(() => {
    const now = new Date();
    const flashPromos = [...(smartPromotions || [])]
      .filter((promo) => promo?.type === "flash_sale" && promo?.active !== false)
      .filter((promo) => {
        const sold = Number(promo?.condition?.soldCount || 0);
        const total = Number(promo?.condition?.totalSlots || 0);
        return total <= 0 || sold < total;
      })
      .filter((promo) => {
        const start = parseDateTime(promo?.startAt, promo?.condition?.startTime, "00:00");
        const end = parseDateTime(promo?.endAt, promo?.condition?.endTime, "23:59");
        if (start && now.getTime() < start.getTime()) return false;
        if (end && now.getTime() > end.getTime()) return false;
        return true;
      })
      .sort((a, b) => Number(a?.priority || 99) - Number(b?.priority || 99));

    if (!flashPromos.length) return [];

    return visibleProducts
      .map((product) => {
        const matched = flashPromos.find((promo) => {
          const scope = promo?.condition?.applyScope || "product";
          const categoryIds = toIdList(promo?.condition?.categoryIds);
          const productIds = toIdList(promo?.condition?.productIds);
          if (scope === "category") return categoryIds.includes(String(product?.category || ""));
          return productIds.includes(String(product?.id || ""));
        });
        if (!matched) return null;
        const basePrice = Number(product?.originalPrice || product?.price || 0);
        const salePrice = calculateSalePrice(basePrice, matched);
        if (salePrice <= 0 || salePrice >= basePrice) return null;
        const discountPercent = Math.round(((basePrice - salePrice) / basePrice) * 100);
        return {
          ...product,
          price: salePrice,
          originalPrice: basePrice,
          salePrice,
          discountPercent,
          flashPromoId: matched.id
        };
      })
      .filter(Boolean)
      .slice(0, 10);
  }, [smartPromotions, visibleProducts, parseDateTime]);

  const mainFlashProduct = flashProducts[0] || null;
  const homeShippingConfig = DEFAULT_SHIPPING_CONFIG;
  const homeFreeShipThreshold = Number(homeShippingConfig.freeShipThreshold || freeshipMinSubtotal);
  const homeFreeShipTitle = `Freeship ${Math.round(homeFreeShipThreshold / 1000)}K`;
  const homeFreeShipText = `Giảm phí ship từ đơn ${formatMoney(homeFreeShipThreshold)}.`;

  const bannersFromAdmin = safeHomeContent
    .filter((block) => isTopBannerItem(block) && block?.active !== false && String(block?.image || "").trim())
    .map((block, index) => ({
      id: `home-banner-${block.id || index}`,
      title: "",
      text: "",
      cta: "",
      image: block.image,
      actionType: block.actionType || (block.actionUrl ? "url" : "block"),
      actionTarget: block.actionTarget || "home",
      actionUrl: block.actionUrl || ""
    }));

  const heroBlockEnabled = safeHomeContent.some(
    (block) => isTopBannerItem(block) && block?.active !== false
  );

  const banners = !heroBlockEnabled
    ? []
    : bannersFromAdmin.length
      ? bannersFromAdmin
      : [
          {
            id: "home-banner-tiktok",
            title: homeText.bannerTiktokTitle,
            text: homeText.bannerTiktokText,
            cta: homeText.bannerTiktokCta,
            image: products[0]?.image,
            actionType: "block",
            actionTarget: "menu",
            actionUrl: ""
          }
        ];

  const cashbackBlock = safeHomeContent.find((block) => block?.id === "cashback");
  const deliveryAppsBlock = safeHomeContent.find((block) => block?.id === "deliveryApps");
  const popupCampaignBlock = safeHomeContent.find((block) => block?.id === "popupCampaign");
  const fulfillmentBlock = safeHomeContent.find((block) => block?.id === "fulfillment");
  const flashSaleBlock = safeHomeContent.find((block) => block?.id === "flashSale" || block?.id === "flash_sale");
  const categoryBlock = safeHomeContent.find((block) => block?.id === "categorySection");
  const featuredBlock = safeHomeContent.find((block) => block?.id === "featuredProducts");
  const showCashback = cashbackBlock?.active !== false;
  const showDeliveryApps = deliveryAppsBlock?.active !== false;
  const showFulfillment = fulfillmentBlock?.active !== false;
  const showFlashSale = flashSaleBlock?.active !== false && flashProducts.length > 0;
  const showCategorySection = categoryBlock?.active !== false;
  const showFeaturedProducts = featuredBlock?.active !== false;
  const popupDelaySeconds = Math.max(0, Number(popupCampaignBlock?.delaySeconds ?? 3));
  const popupCooldownHours = Math.max(0, Number(popupCampaignBlock?.cooldownHours ?? 6));
  const showHomePopup = popupCampaignBlock?.active !== false && String(popupCampaignBlock?.image || "").trim().length > 0;
  const popupCampaignSignature = hashPopupCampaign([
    popupCampaignBlock?.title || "",
    popupCampaignBlock?.subtitle || "",
    popupCampaignBlock?.image || "",
    popupCampaignBlock?.actionType || "",
    popupCampaignBlock?.actionTarget || "",
    popupCampaignBlock?.actionUrl || ""
  ].join("|"));
  const popupSessionKey = `ghr_home_popup_seen_${popupCampaignSignature}`;
  const popupCooldownKey = `ghr_home_popup_last_seen_${popupCampaignSignature}`;
  const deliveryAppsList = String(deliveryAppsBlock?.subtitle || "").split(",").map((item) => item.trim()).filter(Boolean);
  const pickupBranches = (branches.length ? branches : defaultPickupBranches).filter(
    (branch) => branch?.pickupEnabled !== false
  );
  const deliveryBranches = (branches.length ? branches : defaultPickupBranches).filter(
    (branch) => branch?.shipEnabled !== false
  );
  const selectedDeliveryBranchInfo = deliveryBranches.find((branch) => branch.id === selectedDeliveryBranch) || deliveryBranches[0] || null;
  const deliveryAppBranches = buildDeliveryAppBranches(deliveryAppsBlock, deliveryBranches);

  const visibleCategoryNames = categories.filter((category) => {
    if (category === homeText.all) return true;
    return visibleProducts.some((product) => product.category === category);
  });
  const homeCategories = buildHomeCategories(visibleCategoryNames, homeText);
  const activeHomeCategory = homeCategories.some((category) => category.value === homeCategory)
    ? homeCategory
    : homeCategories[0]?.value || categories[0] || homeText.all;
  const filteredHomeProducts = activeHomeCategory === homeCategories[0]?.value
    ? visibleProducts
    : visibleProducts.filter((product) => product.category === activeHomeCategory);
  const featuredProducts = (filteredHomeProducts.length ? filteredHomeProducts : visibleProducts).slice(0, showAllHomeProducts ? 8 : 4);

  return {
    visibleProducts,
    flashProducts,
    mainFlashProduct,
    homeShippingConfig,
    homeFreeShipThreshold,
    homeFreeShipTitle,
    homeFreeShipText,
    banners,
    heroBlockEnabled,
    cashbackBlock,
    deliveryAppsBlock,
    popupCampaignBlock,
    showCashback,
    showDeliveryApps,
    showFulfillment,
    showFlashSale,
    showCategorySection,
    showFeaturedProducts,
    popupDelaySeconds,
    showHomePopup,
    popupSessionKey,
    popupCooldownKey,
    popupCooldownHours,
    deliveryAppsList,
    deliveryAppBranches,
    homeCategories,
    activeHomeCategory,
    featuredProducts,
    pickupBranches,
    deliveryBranches,
    selectedDeliveryBranchInfo
  };
}

