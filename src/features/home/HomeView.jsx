import { useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import Icon from "../../components/Icon.jsx";
import HomeHero from "../../pages/customer/home/HomeHero.jsx";
import HomeFlashSale from "../../pages/customer/home/HomeFlashSale.jsx";
import StampCard from "../loyalty/components/StampCard.jsx";
import HomeVoucherCarousel from "../../pages/customer/home/HomeVoucherCarousel.jsx";
import { defaultPickupBranches } from "../../data/storeDefaults.js";
import { closeOnlyOnBackdrop } from "../../utils/uiEvents.js";
import { homeText, optionModalText } from "../../data/uiText.js";
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
import HomeReviewRewardBanner from "./components/HomeReviewRewardBanner.jsx";
import HomeReviewRewardPopup from "./components/HomeReviewRewardPopup.jsx";
import DeliveryAppOrderingModal from "../../components/customer/DeliveryAppOrderingModal.jsx";
import { createHomeActionHandlers } from "./homeActions.js";
import { createHomeFulfillmentActions } from "./homeFulfillmentActions.js";
import useHomeEffects from "./useHomeEffects.js";


import { HOME_BLOCK_RENDER_ORDER } from "../../constants/homeLayout.js";

export default function Home({
  navigate,
  openProduct,
  openOptionModal,
  products,
  coupons = [],
  smartPromotions = [],
  homeContent,
  branches = [],
  checkoutPreset,
  setCheckoutPreset,
  userProfile,
  demoUser,
  demoLoyalty,
  currentPhone,
  hasCustomerAuthSession = false,
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
  const [homeFulfillment, setHomeFulfillment] = useState(checkoutPreset?.fulfillmentType || "pickup");
  const [deliveryPlannerOpen, setDeliveryPlannerOpen] = useState(false);
  const [pickupPlannerOpen, setPickupPlannerOpen] = useState(false);
  const [pickupBranch, setPickupBranch] = useState(checkoutPreset?.selectedBranch || "phu-hoa");
  const [selectedDeliveryBranch, setSelectedDeliveryBranch] = useState(checkoutPreset?.selectedDeliveryBranch || "");
  const [pickupMode, setPickupMode] = useState(checkoutPreset?.pickupMode || "soon");
  const [pickupDate, setPickupDate] = useState(() => normalizePickupDate(checkoutPreset?.pickupDate));
  const [pickupClock, setPickupClock] = useState(() => normalizePickupClock(checkoutPreset?.pickupClock));
  const [homePopupOpen, setHomePopupOpen] = useState(false);
  const [reviewRewardPopupOpen, setReviewRewardPopupOpen] = useState(false);
  const [deliveryAppOrderingOpen, setDeliveryAppOrderingOpen] = useState(false);
  const [homeClockTick, setHomeClockTick] = useState(() => Date.now());
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
    siteBrandBlock,
    reviewRewardsBlock,
    deliveryAppsBlock,
    popupCampaignBlock,
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
    openDeliveryApps: () => {
      setHomePopupOpen(false);
      setReviewRewardPopupOpen(false);
      setDeliveryAppOrderingOpen(true);
    },
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
        showDeliveryApps={showDeliveryApps && deliveryBranches.length > 0}
        deliveryAppsRef={deliveryAppsRef}
        deliveryAppsBlock={deliveryAppsBlock}
        deliveryAppsList={deliveryAppsList}
        deliveryAppBranches={deliveryAppBranches}
        deliveryBranches={branches.length ? branches : defaultPickupBranches}
      />
    ),
    promoVouchers: () => showPromoVouchers ? (
      <section ref={promoVouchersRef}>
        <HomeVoucherCarousel vouchers={voucherCards} />
      </section>
    ) : null,
    reviewRewards: () => showReviewRewards ? (
      <HomeReviewRewardBanner
        block={reviewRewardsBlock}
        image={siteBrandBlock?.logo || products.find((product) => product?.image)?.image || ""}
        onOpen={() => setReviewRewardPopupOpen(true)}
      />
    ) : null,
    fulfillment: () => showFulfillment ? (
      <section ref={fulfillmentRef} className="home2026-section">
        <HomeFulfillmentCard
          deliveryEnabled={deliveryBranches.length > 0}
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
    featuredProducts: () => <section ref={featuredProductsRef}><StampCard phone={hasCustomerAuthSession ? currentPhone : ""} navigate={navigate} /></section>
  };

  return (
    <section className="home2026-shell">
      {HOME_BLOCK_RENDER_ORDER.map((blockKey) => (
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

      <HomeReviewRewardPopup
        open={reviewRewardPopupOpen}
        block={reviewRewardsBlock}
        onClose={() => setReviewRewardPopupOpen(false)}
        onContinue={() => {
          setReviewRewardPopupOpen(false);
          navigate("reviewRewards", "account");
        }}
      />

      <DeliveryAppOrderingModal
        open={deliveryAppOrderingOpen}
        branches={deliveryAppBranches}
        onClose={() => setDeliveryAppOrderingOpen(false)}
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















