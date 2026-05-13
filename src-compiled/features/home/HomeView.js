import { useMemo, useRef, useState } from "react";
import React from "react";
import Icon from "../../components/Icon.js";
import HomeHero from "../../pages/customer/home/HomeHero.js";
import HomeFlashSale from "../../pages/customer/home/HomeFlashSale.js";
import HomeCategorySection from "../../pages/customer/home/HomeCategorySection.js";
import HomeFeaturedProducts from "../../pages/customer/home/HomeFeaturedProducts.js";
import { freeshipMinSubtotal } from "../../constants/storeConfig.js";
import { defaultPickupBranches } from "../../data/storeDefaults.js";
import { homeText, optionModalText } from "../../data/uiText.js";
import { loadShippingConfig } from "../../services/shippingService.js";
import { formatMoney } from "../../utils/format.js";
import { closeOnlyOnBackdrop } from "../../utils/uiEvents.js";
import { buildHomeCategories, formatCountdown, getCountdownParts } from "../../utils/pureHelpers.js";
import HomeBranchPlannerModal from "./components/HomeBranchPlannerModal.js";
import HomePromoPopup from "./components/HomePromoPopup.js";
import HomeFulfillmentCard from "./components/HomeFulfillmentCard.js";
import HomeInfoCards from "./components/HomeInfoCards.js";
import useHomeComputed from "./useHomeComputed.js";
import { createHomeActionHandlers } from "./homeActions.js";
import { createHomeFulfillmentActions } from "./homeFulfillmentActions.js";
import useHomeEffects from "./useHomeEffects.js";
import { parseDateTime } from "./homeHelpers.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const FALLBACK_HOME_BLOCK_ORDER = ["hero", "deliveryApps", "fulfillment", "flashSale", "categorySection", "featuredProducts"];
const SUPPORTED_HOME_BLOCK_KEYS = new Set([...FALLBACK_HOME_BLOCK_ORDER, "popupCampaign"]);
function normalizeHomeBlockKey(block) {
  const id = String(block?.id || block || "");
  const zone = String(block?.bannerZone || "").toLowerCase();
  const placement = String(block?.placement || "").toLowerCase();
  if (zone === "home-hero" || id === "hero" || placement.includes("banner lớn đầu trang")) return "hero";
  if (id === "flashSale" || id === "flash_sale") return "flashSale";
  return id;
}
function getHomeContentOrder(homeContent) {
  if (homeContent && !Array.isArray(homeContent) && Array.isArray(homeContent.order)) {
    return homeContent.order.map(normalizeHomeBlockKey);
  }
  const contentItems = Array.isArray(homeContent) ? homeContent : Array.isArray(homeContent?.items) ? homeContent.items : [];
  return contentItems.map(normalizeHomeBlockKey);
}
function resolveHomeBlockOrder(homeContent) {
  const configuredOrder = getHomeContentOrder(homeContent).filter(key => SUPPORTED_HOME_BLOCK_KEYS.has(key) && key !== "popupCampaign");
  const uniqueConfiguredOrder = Array.from(new Set(configuredOrder));
  const baseOrder = uniqueConfiguredOrder.length ? uniqueConfiguredOrder : FALLBACK_HOME_BLOCK_ORDER;
  return [...baseOrder, ...FALLBACK_HOME_BLOCK_ORDER.filter(key => !baseOrder.includes(key))];
}
export default function Home({
  navigate,
  openProduct,
  openOptionModal,
  products,
  promos,
  coupons = [],
  smartPromotions = [],
  categories,
  homeContent,
  branches = [],
  checkoutPreset,
  setCheckoutPreset,
  setServiceNotice,
  getStoreBlockNotice,
  isBranchOpenNow,
  buildStoreOfflineNotice,
  buildDeliveryDisabledNotice,
  buildPickupDisabledNotice,
  buildOutOfHoursNotice,
  setActiveCategory,
  userProfile,
  isRegisteredCustomer
}) {
  const t = homeText;
  const bannerRef = useRef(null);
  const [activeBanner, setActiveBanner] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [flashModalOpen, setFlashModalOpen] = useState(false);
  const [homeFulfillment, setHomeFulfillment] = useState(checkoutPreset?.fulfillmentType || "delivery");
  const [deliveryPlannerOpen, setDeliveryPlannerOpen] = useState(false);
  const [pickupPlannerOpen, setPickupPlannerOpen] = useState(false);
  const [pickupBranch, setPickupBranch] = useState(checkoutPreset?.selectedBranch || "phu-hoa");
  const [selectedDeliveryBranch, setSelectedDeliveryBranch] = useState(checkoutPreset?.selectedDeliveryBranch || "");
  const [pickupMode, setPickupMode] = useState(checkoutPreset?.pickupMode || "soon");
  const [pickupDate, setPickupDate] = useState(checkoutPreset?.pickupDate || "2026-05-02");
  const [pickupClock, setPickupClock] = useState(checkoutPreset?.pickupClock || "12:30");
  const [homeCategory, setHomeCategory] = useState("");
  const [showAllHomeProducts, setShowAllHomeProducts] = useState(false);
  const [homePopupOpen, setHomePopupOpen] = useState(false);
  const cashbackRef = useRef(null);
  const deliveryAppsRef = useRef(null);
  const fulfillmentRef = useRef(null);
  const flashSaleRef = useRef(null);
  const categorySectionRef = useRef(null);
  const featuredProductsRef = useRef(null);
  const displayName = userProfile?.name?.trim();
  const greeting = isRegisteredCustomer && displayName ? `${t.morning}, ${displayName} 👋` : `${t.hello} 👋`;
  const {
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
  } = useHomeComputed({
    smartPromotions,
    products,
    parseDateTime,
    homeContent,
    homeText: t,
    categories,
    homeCategory,
    showAllHomeProducts,
    branches,
    selectedDeliveryBranch
  });
  useHomeEffects({
    selectedDeliveryBranchInfo,
    deliveryBranches,
    setSelectedDeliveryBranch,
    setActiveBanner,
    bannersLength: banners.length,
    smartPromotions,
    parseDateTime,
    setSecondsLeft,
    setHomePopupOpen,
    showHomePopup,
    popupDelaySeconds,
    popupSessionKey,
    popupCooldownKey,
    popupCooldownHours
  });
  const {
    handleAction
  } = createHomeActionHandlers({
    navigate,
    refs: {
      cashbackRef,
      deliveryAppsRef,
      fulfillmentRef,
      flashSaleRef,
      categorySectionRef,
      featuredProductsRef
    }
  });
  const {
    openMenuWithDelivery,
    confirmDeliveryAndOpenMenu,
    openPickupPlanner,
    confirmPickupAndOpenMenu
  } = createHomeFulfillmentActions({
    deliveryBranches,
    pickupBranches,
    setServiceNotice,
    buildDeliveryDisabledNotice,
    buildPickupDisabledNotice,
    buildStoreOfflineNotice,
    buildOutOfHoursNotice,
    setHomeFulfillment,
    setDeliveryPlannerOpen,
    setPickupPlannerOpen,
    selectedDeliveryBranchInfo,
    isBranchOpenNow,
    setCheckoutPreset,
    pickupBranch,
    pickupMode,
    pickupDate,
    pickupClock,
    navigate
  });
  const homeBlockOrder = useMemo(() => resolveHomeBlockOrder(homeContent), [homeContent]);
  const homeBlockRenderers = {
    hero: () => heroBlockEnabled ? /*#__PURE__*/_jsx(HomeHero, {
      subtitle: t.subtitle,
      searchText: t.search,
      bannerAria: t.bannerAria,
      navigate: navigate,
      onSearch: () => navigate("menu", "menu"),
      bannerRef: bannerRef,
      handleBannerScroll: () => {},
      banners: banners,
      activeBanner: activeBanner,
      setActiveBanner: setActiveBanner,
      onBannerClick: banner => handleAction(banner)
    }) : null,
    deliveryApps: () => /*#__PURE__*/_jsx(HomeInfoCards, {
      showCashback: false,
      cashbackRef: cashbackRef,
      cashbackBlock: cashbackBlock,
      showDeliveryApps: showDeliveryApps,
      deliveryAppsRef: deliveryAppsRef,
      deliveryAppsBlock: deliveryAppsBlock,
      deliveryAppsList: deliveryAppsList,
      deliveryAppBranches: deliveryAppBranches
    }),
    fulfillment: () => showFulfillment ? /*#__PURE__*/_jsx("section", {
      ref: fulfillmentRef,
      className: "home2026-section",
      children: /*#__PURE__*/_jsx(HomeFulfillmentCard, {
        homeFulfillment: homeFulfillment,
        onDelivery: openMenuWithDelivery,
        onPickup: openPickupPlanner,
        selectedDeliveryBranchInfo: selectedDeliveryBranchInfo
      })
    }) : null,
    flashSale: () => showFlashSale ? /*#__PURE__*/_jsx("section", {
      ref: flashSaleRef,
      children: /*#__PURE__*/_jsx(HomeFlashSale, {
        dealTitle: t.dealTitle,
        endAfter: t.endAfter,
        viewAll: t.viewAll,
        flashTitle: t.flashTitle,
        flashSub: t.flashSub,
        buyText: t.buyNow,
        closeText: optionModalText.close,
        secondsLeft: secondsLeft,
        setFlashModalOpen: setFlashModalOpen,
        mainFlashProduct: mainFlashProduct,
        openOptionModal: openOptionModal,
        flashModalOpen: flashModalOpen,
        flashProducts: flashProducts,
        getCountdownParts: getCountdownParts,
        formatCountdown: formatCountdown
      })
    }) : null,
    categorySection: () => showCategorySection ? /*#__PURE__*/_jsx("section", {
      ref: categorySectionRef,
      children: /*#__PURE__*/_jsx(HomeCategorySection, {
        categoryTitle: t.categoryTitle,
        viewAll: t.viewAll,
        homeCategories: homeCategories,
        activeHomeCategory: activeHomeCategory,
        onSelectCategory: category => {
          setHomeCategory(category);
          setShowAllHomeProducts(false);
        },
        onViewAll: () => {
          setHomeCategory(homeCategories[0]?.value);
          setShowAllHomeProducts(true);
        }
      })
    }) : null,
    featuredProducts: () => showFeaturedProducts ? /*#__PURE__*/_jsx("section", {
      ref: featuredProductsRef,
      children: /*#__PURE__*/_jsx(HomeFeaturedProducts, {
        featuredTitle: t.featuredTitle,
        viewMore: t.viewMore,
        collapse: t.collapse,
        showAllHomeProducts: showAllHomeProducts,
        setShowAllHomeProducts: setShowAllHomeProducts,
        featuredProducts: featuredProducts,
        openOptionModal: openOptionModal
      })
    }) : null
  };
  return /*#__PURE__*/_jsxs("section", {
    className: "home2026-shell",
    children: [homeBlockOrder.map(blockKey => /*#__PURE__*/_jsx(React.Fragment, {
      children: homeBlockRenderers[blockKey]?.()
    }, blockKey)), /*#__PURE__*/_jsx(HomePromoPopup, {
      open: homePopupOpen && showHomePopup,
      popup: popupCampaignBlock,
      onClose: () => setHomePopupOpen(false),
      onClickPopup: () => {
        setHomePopupOpen(false);
        handleAction(popupCampaignBlock);
      }
    }), /*#__PURE__*/_jsx(HomeBranchPlannerModal, {
      open: pickupPlannerOpen,
      onBackdropClose: event => closeOnlyOnBackdrop(event, () => setPickupPlannerOpen(false)),
      onClose: () => setPickupPlannerOpen(false),
      title: "T\u1EF1 \u0111\u1EBFn l\u1EA5y",
      subtitle: "Ch\u1ECDn chi nh\xE1nh v\xE0 gi\u1EDD l\u1EA5y tr\u01B0\u1EDBc khi xem menu.",
      ariaLabel: "Ch\u1ECDn chi nh\xE1nh v\xE0 gi\u1EDD l\u1EA5y",
      branches: pickupBranches,
      selectedBranchId: pickupBranch,
      onSelectBranch: setPickupBranch,
      onConfirm: confirmPickupAndOpenMenu,
      iconName: "home"
    }), /*#__PURE__*/_jsx(HomeBranchPlannerModal, {
      open: deliveryPlannerOpen,
      onBackdropClose: event => closeOnlyOnBackdrop(event, () => setDeliveryPlannerOpen(false)),
      onClose: () => setDeliveryPlannerOpen(false),
      title: "Ch\u1ECDn chi nh\xE1nh giao h\xE0ng",
      subtitle: "Gi\xE1 ship s\u1EBD t\xEDnh theo chi nh\xE1nh b\u1EA1n ch\u1ECDn.",
      ariaLabel: "Ch\u1ECDn chi nh\xE1nh giao h\xE0ng",
      branches: deliveryBranches,
      selectedBranchId: selectedDeliveryBranchInfo?.id || "",
      onSelectBranch: setSelectedDeliveryBranch,
      onConfirm: confirmDeliveryAndOpenMenu,
      iconName: "bike",
      disabledConfirm: !selectedDeliveryBranchInfo
    })]
  });
}