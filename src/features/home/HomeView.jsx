import { useMemo, useRef, useState } from "react";
import React from "react";
import Icon from "../../components/Icon.jsx";
import HomeHero from "../../pages/customer/home/HomeHero.jsx";
import HomeFlashSale from "../../pages/customer/home/HomeFlashSale.jsx";
import HomeCategorySection from "../../pages/customer/home/HomeCategorySection.jsx";
import HomeFeaturedProducts from "../../pages/customer/home/HomeFeaturedProducts.jsx";
import { freeshipMinSubtotal } from "../../constants/storeConfig.js";
import { defaultPickupBranches } from "../../data/storeDefaults.js";
import { homeText, optionModalText } from "../../data/uiText.js";
import { loadShippingConfig } from "../../services/shippingService.js";
import { formatMoney } from "../../utils/format.js";
import { closeOnlyOnBackdrop } from "../../utils/uiEvents.js";
import {
  buildHomeCategories,
  formatCountdown,
  getCountdownParts
} from "../../utils/pureHelpers.js";
import HomeBranchPlannerModal from "./components/HomeBranchPlannerModal.jsx";
import HomePromoPopup from "./components/HomePromoPopup.jsx";
import HomeFulfillmentCard from "./components/HomeFulfillmentCard.jsx";
import HomeInfoCards from "./components/HomeInfoCards.jsx";
import useHomeComputed from "./useHomeComputed.js";
import { createHomeActionHandlers } from "./homeActions.js";
import { createHomeFulfillmentActions } from "./homeFulfillmentActions.js";
import useHomeEffects from "./useHomeEffects.js";
import {
  parseDateTime,
} from "./homeHelpers.js";

const FALLBACK_HOME_BLOCK_ORDER = [
  "hero",
  "deliveryApps",
  "fulfillment",
  "flashSale",
  "categorySection",
  "featuredProducts"
];

const SUPPORTED_HOME_BLOCK_KEYS = new Set([
  ...FALLBACK_HOME_BLOCK_ORDER,
  "popupCampaign"
]);

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

  const contentItems = Array.isArray(homeContent)
    ? homeContent
    : Array.isArray(homeContent?.items)
      ? homeContent.items
      : [];

  return contentItems.map(normalizeHomeBlockKey);
}

function resolveHomeBlockOrder(homeContent) {
  const configuredOrder = getHomeContentOrder(homeContent)
    .filter((key) => SUPPORTED_HOME_BLOCK_KEYS.has(key) && key !== "popupCampaign");

  const uniqueConfiguredOrder = Array.from(new Set(configuredOrder));
  const baseOrder = uniqueConfiguredOrder.length ? uniqueConfiguredOrder : FALLBACK_HOME_BLOCK_ORDER;
  return [
    ...baseOrder,
    ...FALLBACK_HOME_BLOCK_ORDER.filter((key) => !baseOrder.includes(key))
  ];
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

  const { handleAction } = createHomeActionHandlers({
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
    hero: () => heroBlockEnabled ? (
      <HomeHero
        subtitle={t.subtitle}
        searchText={t.search}
        bannerAria={t.bannerAria}
        navigate={navigate}
        onSearch={() => navigate("menu", "menu")}
        bannerRef={bannerRef}
        handleBannerScroll={() => {}}
        banners={banners}
        activeBanner={activeBanner}
        setActiveBanner={setActiveBanner}
        onBannerClick={(banner) => handleAction(banner)}
      />
    ) : null,
    deliveryApps: () => (
      <HomeInfoCards
        showCashback={false}
        cashbackRef={cashbackRef}
        cashbackBlock={cashbackBlock}
        showDeliveryApps={showDeliveryApps}
        deliveryAppsRef={deliveryAppsRef}
        deliveryAppsBlock={deliveryAppsBlock}
        deliveryAppsList={deliveryAppsList}
        deliveryAppBranches={deliveryAppBranches}
        deliveryBranches={deliveryBranches}
      />
    ),
    fulfillment: () => showFulfillment ? (
      <section ref={fulfillmentRef} className="home2026-section">
        <HomeFulfillmentCard
          homeFulfillment={homeFulfillment}
          onDelivery={openMenuWithDelivery}
          onPickup={openPickupPlanner}
          selectedDeliveryBranchInfo={selectedDeliveryBranchInfo}
        />
      </section>
    ) : null,
    flashSale: () => showFlashSale ? (
      <section ref={flashSaleRef}><HomeFlashSale
        dealTitle={t.dealTitle}
        endAfter={t.endAfter}
        viewAll={t.viewAll}
        flashTitle={t.flashTitle}
        flashSub={t.flashSub}
        buyText={t.buyNow}
        closeText={optionModalText.close}
        secondsLeft={secondsLeft}
        setFlashModalOpen={setFlashModalOpen}
        mainFlashProduct={mainFlashProduct}
        openOptionModal={openOptionModal}
        flashModalOpen={flashModalOpen}
        flashProducts={flashProducts}
        getCountdownParts={getCountdownParts}
        formatCountdown={formatCountdown}
      /></section>
    ) : null,
    categorySection: () => showCategorySection ? (
      <section ref={categorySectionRef}><HomeCategorySection
        categoryTitle={t.categoryTitle}
        viewAll={t.viewAll}
        homeCategories={homeCategories}
        activeHomeCategory={activeHomeCategory}
        onSelectCategory={(category) => {
          setHomeCategory(category);
          setShowAllHomeProducts(false);
        }}
        onViewAll={() => {
          setHomeCategory(homeCategories[0]?.value);
          setShowAllHomeProducts(true);
        }}
      /></section>
    ) : null,
    featuredProducts: () => showFeaturedProducts ? (
      <section ref={featuredProductsRef}><HomeFeaturedProducts
        featuredTitle={t.featuredTitle}
        viewMore={t.viewMore}
        collapse={t.collapse}
        showAllHomeProducts={showAllHomeProducts}
        setShowAllHomeProducts={setShowAllHomeProducts}
        featuredProducts={featuredProducts}
        openOptionModal={openOptionModal}
      /></section>
    ) : null
  };

  return (
    <section className="home2026-shell">
      {homeBlockOrder.map((blockKey) => (
        <React.Fragment key={blockKey}>
          {homeBlockRenderers[blockKey]?.()}
        </React.Fragment>
      ))}

      <HomePromoPopup
        open={homePopupOpen && showHomePopup}
        popup={popupCampaignBlock}
        onClose={() => setHomePopupOpen(false)}
        onClickPopup={() => {
          setHomePopupOpen(false);
          handleAction(popupCampaignBlock);
        }}
      />

      <HomeBranchPlannerModal
        open={pickupPlannerOpen}
        onBackdropClose={(event) => closeOnlyOnBackdrop(event, () => setPickupPlannerOpen(false))}
        onClose={() => setPickupPlannerOpen(false)}
        title="Tự đến lấy"
        subtitle="Chọn chi nhánh và giờ lấy trước khi xem menu."
        ariaLabel="Chọn chi nhánh và giờ lấy"
        branches={pickupBranches}
        selectedBranchId={pickupBranch}
        onSelectBranch={setPickupBranch}
        onConfirm={confirmPickupAndOpenMenu}
        iconName="home"
      />

      <HomeBranchPlannerModal
        open={deliveryPlannerOpen}
        onBackdropClose={(event) => closeOnlyOnBackdrop(event, () => setDeliveryPlannerOpen(false))}
        onClose={() => setDeliveryPlannerOpen(false)}
        title="Chọn chi nhánh giao hàng"
        subtitle="Giá ship sẽ tính theo chi nhánh bạn chọn."
        ariaLabel="Chọn chi nhánh giao hàng"
        branches={deliveryBranches}
        selectedBranchId={selectedDeliveryBranchInfo?.id || ""}
        onSelectBranch={setSelectedDeliveryBranch}
        onConfirm={confirmDeliveryAndOpenMenu}
        iconName="bike"
        disabledConfirm={!selectedDeliveryBranchInfo}
      />

    </section>
  );
}











