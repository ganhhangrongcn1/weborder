import { useMemo } from "react";
import { defaultPickupBranches } from "../../data/storeDefaults.js";
import { getActiveFlashSalePromotions } from "../../services/flashSaleService.js";
import { buildHomeVoucherCards } from "../../services/homeVoucherService.js";
import { calculateSalePrice, isTopBannerItem, toIdList } from "./homeHelpers.js";
import { buildDeliveryAppBranches } from "../../services/deliveryAppService.js";

function hashPopupCampaign(value) {
  const input = String(value || "");
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index) | 0;
  }
  return Math.abs(hash).toString(36);
}

function findMatchingFlashPromo(product = {}, flashPromos = []) {
  return flashPromos.find((promo) => {
    const scope = promo?.condition?.applyScope || "product";
    const categoryIds = toIdList(promo?.condition?.categoryIds);
    const productIds = toIdList(promo?.condition?.productIds);
    if (scope === "category") return categoryIds.includes(String(product?.category || ""));
    return productIds.includes(String(product?.id || ""));
  }) || null;
}

function applyFlashSaleToProduct(product = {}, flashPromos = []) {
  const matched = findMatchingFlashPromo(product, flashPromos);
  if (!matched) return product;
  const basePrice = Number(product?.originalPrice || product?.price || 0);
  const salePrice = calculateSalePrice(basePrice, matched);
  if (salePrice <= 0 || salePrice >= basePrice) return product;
  const discountPercent = Math.round(((basePrice - salePrice) / basePrice) * 100);
  return {
    ...product,
    price: salePrice,
    originalPrice: basePrice,
    salePrice,
    discountPercent,
    flashPromoId: matched.id,
    badge: product.badge || "Flash Sale"
  };
}

export default function useHomeComputed({
  smartPromotions,
  coupons = [],
  demoLoyalty = {},
  currentPhone = "",
  isRegisteredCustomer = false,
  products,
  currentTime,
  homeContent,
  homeText,
  branches,
  selectedDeliveryBranch
}) {
  const safeHomeContent = Array.isArray(homeContent) ? homeContent : [];
  const visibleProducts = products.filter((product) => product.visible !== false);

  const activeFlashPromos = useMemo(() => {
    return getActiveFlashSalePromotions(smartPromotions, currentTime);
  }, [smartPromotions, currentTime]);

  const flashProducts = useMemo(() => {
    if (!activeFlashPromos.length) return [];

    return visibleProducts
      .map((product) => {
        const saleProduct = applyFlashSaleToProduct(product, activeFlashPromos);
        return saleProduct.flashPromoId ? saleProduct : null;
      })
      .filter(Boolean)
      .slice(0, 10);
  }, [activeFlashPromos, visibleProducts]);

  const mainFlashProduct = flashProducts[0] || null;
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

  const siteBrandBlock = safeHomeContent.find((block) => block?.id === "siteBrand");
  const reviewRewardsBlock = safeHomeContent.find((block) => block?.id === "reviewRewards");
  const deliveryAppsBlock = safeHomeContent.find((block) => block?.id === "deliveryApps");
  const popupCampaignBlock = safeHomeContent.find((block) => block?.id === "popupCampaign");
  const promoVouchersBlock = safeHomeContent.find((block) => block?.id === "promoVouchers" || block?.id === "promo_vouchers");
  const fulfillmentBlock = safeHomeContent.find((block) => block?.id === "fulfillment");
  const flashSaleBlock = safeHomeContent.find((block) => block?.id === "flashSale" || block?.id === "flash_sale");
  const showReviewRewards = reviewRewardsBlock?.active !== false;
  const showDeliveryApps = deliveryAppsBlock?.active !== false;
  const voucherCards = buildHomeVoucherCards({
    coupons,
    smartPromotions,
    loyalty: demoLoyalty,
    products: visibleProducts,
    currentPhone,
    isRegisteredCustomer,
    now: currentTime
  });
  const showPromoVouchers = promoVouchersBlock?.active !== false && voucherCards.length > 0;
  const showFulfillment = fulfillmentBlock?.active !== false;
  const showFlashSale = flashSaleBlock?.active !== false && flashProducts.length > 0;
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
  const deliveryAppBranches = buildDeliveryAppBranches(
    deliveryAppsBlock,
    branches.length ? branches : defaultPickupBranches
  );

  return {
    visibleProducts,
    flashProducts,
    mainFlashProduct,
    banners,
    heroBlockEnabled,
    siteBrandBlock,
    reviewRewardsBlock,
    deliveryAppsBlock,
    popupCampaignBlock,
    promoVouchersBlock,
    voucherCards,
    showReviewRewards,
    showPromoVouchers,
    showDeliveryApps,
    showFulfillment,
    showFlashSale,
    popupDelaySeconds,
    showHomePopup,
    popupSessionKey,
    popupCooldownKey,
    popupCooldownHours,
    deliveryAppsList,
    deliveryAppBranches,
    pickupBranches,
    deliveryBranches,
    selectedDeliveryBranchInfo
  };
}

