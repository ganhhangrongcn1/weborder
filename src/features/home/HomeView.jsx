import { useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import Icon from "../../components/Icon.jsx";
import HomeHero from "../../pages/customer/home/HomeHero.jsx";
import HomeFlashSale from "../../pages/customer/home/HomeFlashSale.jsx";
import HomeFeaturedProducts from "../../pages/customer/home/HomeFeaturedProducts.jsx";
import HomeVoucherCarousel from "../../pages/customer/home/HomeVoucherCarousel.jsx";
import { freeshipMinSubtotal } from "../../constants/storeConfig.js";
import { defaultPickupBranches } from "../../data/storeDefaults.js";
import { homeText, optionModalText } from "../../data/uiText.js";
import { closeOnlyOnBackdrop } from "../../utils/uiEvents.js";
import { normalizePickupClock, normalizePickupDate } from "../../utils/dateTimeDefaults.js";
import {
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
import useHomePopularProducts from "./useHomePopularProducts.js";

const FALLBACK_HOME_BLOCK_ORDER = [
  "hero",
  "fulfillment",
  "promoVouchers",
  "flashSale",
  "featuredProducts",
  "deliveryApps"
];

const HOME_ORDERING_BLOCKS = [
  "fulfillment",
  "promoVouchers",
  "flashSale",
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
  if (id === "promoVouchers" || id === "promo_vouchers") return "promoVouchers";
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
  const supportingOrder = uniqueConfiguredOrder.filter(
    (key) => key !== "hero" && key !== "deliveryApps" && !HOME_ORDERING_BLOCKS.includes(key)
  );

  return [
    "hero",
    ...HOME_ORDERING_BLOCKS,
    ...supportingOrder,
    ...FALLBACK_HOME_BLOCK_ORDER.filter(
      (key) =>
        key !== "hero" &&
        key !== "deliveryApps" &&
        !HOME_ORDERING_BLOCKS.includes(key) &&
        !supportingOrder.includes(key)
    ),
    "deliveryApps"
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
  userProfile,
  demoUser,
  demoLoyalty,
  currentPhone,
  isRegisteredCustomer,
  setServiceNotice,
  getStoreBlockNotice,
  isBranchOpenNow,
  buildStoreOfflineNotice,
  buildDeliveryDisabledNotice,
  buildPickupDisabledNotice,
  buildOutOfHoursNotice
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
  const [pickupDate, setPickupDate] = useState(() => normalizePickupDate(checkoutPreset?.pickupDate));
  const [pickupClock, setPickupClock] = useState(() => normalizePickupClock(checkoutPreset?.pickupClock));
  const [homePopupOpen, setHomePopupOpen] = useState(false);
  const [homeClockTick, setHomeClockTick] = useState(() => Date.now());
  const popularProductIds = useHomePopularProducts({
    enabled: products.length > 0,
    days: 30,
    limit: 12
  });
  const cashbackRef = useRef(null);
  const promoVouchersRef = useRef(null);
  const deliveryAppsRef = useRef(null);
  const fulfillmentRef = useRef(null);
  const flashSaleRef = useRef(null);
  const featuredProductsRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setHomeClockTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const {
    flashProducts,
    mainFlashProduct,
    banners,
    cashbackBlock,
    siteBrandBlock,
    deliveryAppsBlock,
    popupCampaignBlock,
    voucherCards,
    showCashback,
    showPromoVouchers,
    showDeliveryApps,
    showFulfillment,
    showFlashSale,
    showFeaturedProducts,
    popupDelaySeconds,
    showHomePopup,
    popupSessionKey,
    popupCooldownKey,
    popupCooldownHours,
    deliveryAppsList,
    deliveryAppBranches,
    featuredProducts,
    pickupBranches,
    deliveryBranches,
    selectedDeliveryBranchInfo
  } = useHomeComputed({
    smartPromotions,
    coupons,
    demoLoyalty,
    currentPhone,
    isRegisteredCustomer,
    products,
    currentTime: new Date(homeClockTick),
    homeContent,
    homeText: t,
    categories,
    homeCategory: "",
    popularProductIds,
    showAllHomeProducts: false,
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
      promoVouchersRef,
      deliveryAppsRef,
      fulfillmentRef,
      flashSaleRef,
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
  const pickupBranchInfo = useMemo(
    () => pickupBranches.find((branch) => branch.id === pickupBranch) || pickupBranches[0] || null,
    [pickupBranches, pickupBranch]
  );
  const handleBannerScroll = (event) => {
    const track = event.currentTarget;
    const slideWidth = track.clientWidth;
    if (!slideWidth) return;
    const nextIndex = Math.round(track.scrollLeft / slideWidth);
    setActiveBanner((current) => (current === nextIndex ? current : nextIndex));
  };

  const homeBlockRenderers = {
    hero: () => (
      <HomeHero
        subtitle={t.subtitle}
        bannerAria={t.bannerAria}
        navigate={navigate}
        bannerRef={bannerRef}
        handleBannerScroll={handleBannerScroll}
        banners={banners}
        activeBanner={activeBanner}
        setActiveBanner={setActiveBanner}
        onBannerClick={(banner) => handleAction(banner)}
        homeFulfillment={homeFulfillment}
        selectedDeliveryBranchInfo={selectedDeliveryBranchInfo}
        pickupBranchInfo={pickupBranchInfo}
        userProfile={userProfile}
        demoUser={demoUser}
        demoLoyalty={demoLoyalty}
        siteBrand={siteBrandBlock}
      />
    ),
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
    promoVouchers: () => showPromoVouchers ? (
      <section ref={promoVouchersRef}>
        <HomeVoucherCarousel vouchers={voucherCards} />
      </section>
    ) : null,
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
    featuredProducts: () => showFeaturedProducts ? (
      <section ref={featuredProductsRef}><HomeFeaturedProducts
        featuredTitle={t.featuredTitle}
        viewMore={t.viewMore}
        featuredProducts={featuredProducts}
        openOptionModal={openOptionModal}
        onViewAll={() => navigate("menu", "menu")}
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















