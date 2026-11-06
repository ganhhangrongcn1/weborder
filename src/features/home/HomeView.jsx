import { useEffect, useRef, useState } from "react";
import StampCard from "../loyalty/components/StampCard.jsx";
import HomeBranchPlannerModal from "./components/HomeBranchPlannerModal.jsx";
import HomeMemberCard from "./components/HomeMemberCard.jsx";
import HomeServiceTiles from "./components/HomeServiceTiles.jsx";
import HomeDeliveryOptions from "./components/HomeDeliveryOptions.jsx";
import HomeBannerRail from "./components/HomeBannerRail.jsx";
import HomePromoPopup from "./components/HomePromoPopup.jsx";
import HomeReviewRewardBanner from "./components/HomeReviewRewardBanner.jsx";
import HomeReviewRewardPopup from "./components/HomeReviewRewardPopup.jsx";
import DeliveryAppOrderingModal from "../../components/customer/DeliveryAppOrderingModal.jsx";
import useHomeComputed from "./useHomeComputed.js";
import useHomeEffects from "./useHomeEffects.js";
import useHomeMembership from "./hooks/useHomeMembership.js";
import { createHomeActionHandlers } from "./homeActions.js";
import { createHomeFulfillmentActions } from "./homeFulfillmentActions.js";
import { closeOnlyOnBackdrop } from "../../utils/uiEvents.js";
import { homeText } from "../../data/uiText.js";
import { normalizePickupClock, normalizePickupDate } from "../../utils/dateTimeDefaults.js";

export default function Home({
  navigate, products = [], coupons = [], smartPromotions = [], homeContent,
  branches = [], checkoutPreset, setCheckoutPreset, userProfile, demoUser, requestBranchChange,
  demoLoyalty = {}, currentPhone, hasCustomerAuthSession = false, isRegisteredCustomer,
  setServiceNotice, isBranchOpenNow, buildStoreOfflineNotice, buildDeliveryDisabledNotice,
  buildPickupDisabledNotice, buildOutOfHoursNotice
}) {
  const bannerRef = useRef(null);
  const fulfillmentRef = useRef(null);
  const featuredProductsRef = useRef(null);
  const [activeBanner,setActiveBanner] = useState(0);
  const [,setHomeFulfillment] = useState(checkoutPreset?.fulfillmentType || "pickup");
  const [pickupPlannerOpen,setPickupPlannerOpen] = useState(false);
  const [deliveryOptionsOpen,setDeliveryOptionsOpen] = useState(false);
  const [deliveryAppOrderingOpen,setDeliveryAppOrderingOpen] = useState(false);
  const [pickupBranch,setPickupBranch] = useState(checkoutPreset?.selectedBranch || "");
  const [selectedDeliveryBranch,setSelectedDeliveryBranch] = useState(checkoutPreset?.selectedDeliveryBranch || "");
  const [homePopupOpen,setHomePopupOpen] = useState(false);
  const [reviewRewardPopupOpen,setReviewRewardPopupOpen] = useState(false);
  const [homeClockTick,setHomeClockTick] = useState(Date.now);
  const pickupMode = checkoutPreset?.pickupMode || "soon";
  const pickupDate = normalizePickupDate(checkoutPreset?.pickupDate);
  const pickupClock = normalizePickupClock(checkoutPreset?.pickupClock);
  const signedIn = Boolean(hasCustomerAuthSession && currentPhone);
  const membership = useHomeMembership(demoLoyalty,userProfile || demoUser || {},signedIn);

  useEffect(()=>{
    const timer=window.setInterval(()=>setHomeClockTick(Date.now()),30000);
    return ()=>window.clearInterval(timer);
  },[]);

  const {
    banners,siteBrandBlock,reviewRewardsBlock,popupCampaignBlock,showReviewRewards,
    showFulfillment,showDeliveryApps,showHomePopup,popupDelaySeconds,popupSessionKey,
    popupCooldownKey,popupCooldownHours,deliveryAppBranches,pickupBranches,
    deliveryBranches,selectedDeliveryBranchInfo
  } = useHomeComputed({
    smartPromotions,coupons,demoLoyalty,currentPhone,isRegisteredCustomer,products,
    currentTime:new Date(homeClockTick),homeContent,homeText,branches,selectedDeliveryBranch
  });

  useHomeEffects({
    selectedDeliveryBranchInfo,deliveryBranches,setSelectedDeliveryBranch,setActiveBanner,
    bannersLength:banners.length,autoRotateBanners:false,smartPromotions,
    setHomePopupOpen,showHomePopup,popupDelaySeconds,popupSessionKey,popupCooldownKey,popupCooldownHours
  });

  const { openPickupPlanner,confirmPickupAndOpenMenu } = createHomeFulfillmentActions({
    deliveryBranches,pickupBranches,setServiceNotice,buildDeliveryDisabledNotice,
    buildPickupDisabledNotice,buildStoreOfflineNotice,buildOutOfHoursNotice,
    setHomeFulfillment,setDeliveryPlannerOpen:()=>{},setPickupPlannerOpen,
    selectedDeliveryBranchInfo,isBranchOpenNow,setCheckoutPreset,pickupBranch,
    pickupMode,pickupDate,pickupClock,navigate
  });
  const { handleAction } = createHomeActionHandlers({
    navigate,refs:{fulfillmentRef,featuredProductsRef},
    onDeliveryApps:()=>setDeliveryOptionsOpen(true)
  });
  const handleBannerScroll = event => {
    const track=event.currentTarget;
    if (track.clientWidth) setActiveBanner(Math.round(track.scrollLeft/track.clientWidth));
  };

  return <section className="home2026-shell home-native-home">
    <HomeMemberCard membership={membership} navigate={navigate} brand={siteBrandBlock} />
    <section ref={featuredProductsRef} aria-label="Tem tích được">
      <StampCard phone={signedIn ? currentPhone : ""} navigate={navigate} />
    </section>
    {showFulfillment && <section ref={fulfillmentRef}>
      <HomeServiceTiles onPickup={openPickupPlanner} onDelivery={()=>setDeliveryOptionsOpen(true)} />
    </section>}
    <HomeBannerRail banners={banners} bannerRef={bannerRef} activeBanner={activeBanner}
      setActiveBanner={setActiveBanner} onScroll={handleBannerScroll} onBannerClick={handleAction} />
    {showReviewRewards && <HomeReviewRewardBanner block={reviewRewardsBlock} image={siteBrandBlock?.logo || ""}
      onOpen={()=>setReviewRewardPopupOpen(true)} />}

    <HomePromoPopup open={homePopupOpen && showHomePopup && !pickupPlannerOpen && !deliveryOptionsOpen && !deliveryAppOrderingOpen && !reviewRewardPopupOpen}
      popup={popupCampaignBlock} onClose={()=>setHomePopupOpen(false)} onClickPopup={()=>{setHomePopupOpen(false);openPickupPlanner();}} />
    <HomeReviewRewardPopup open={reviewRewardPopupOpen} onClose={()=>setReviewRewardPopupOpen(false)}
      onContinue={()=>{setReviewRewardPopupOpen(false);navigate("reviewRewards","account");}} />
    <HomeDeliveryOptions open={deliveryOptionsOpen} onClose={()=>setDeliveryOptionsOpen(false)}
      appsEnabled={showDeliveryApps} onOrderViaApp={()=>{setDeliveryOptionsOpen(false);setDeliveryAppOrderingOpen(true);}} />
    <DeliveryAppOrderingModal open={deliveryAppOrderingOpen} branches={deliveryAppBranches} onClose={()=>setDeliveryAppOrderingOpen(false)} />
    <HomeBranchPlannerModal open={pickupPlannerOpen}
      onBackdropClose={event=>closeOnlyOnBackdrop(event,()=>setPickupPlannerOpen(false))}
      onClose={()=>setPickupPlannerOpen(false)} title="Đặt trước ghé lấy"
      subtitle="Chọn quán để xem các món đang bán tại quán đó."
      ariaLabel="Chọn quán ghé lấy" branches={pickupBranches}
      selectedBranchId={pickupBranch} onSelectBranch={()=>{}}
      onConfirm={id=>{const commit=()=>{setPickupBranch(id);confirmPickupAndOpenMenu(id);};requestBranchChange ? requestBranchChange(id,commit) : commit();}} iconName="store" enableNearby />
  </section>;
}















