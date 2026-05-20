import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";
import AppHeader from "../../components/app/Header.jsx";
import AppCart from "../../components/app/Cart.jsx";
import CheckoutCard from "./components/CheckoutCard.jsx";
import CheckoutFulfillmentSection from "./components/CheckoutFulfillmentSection.jsx";
import CheckoutPricingSection from "./components/CheckoutPricingSection.jsx";
import CheckoutModals from "./components/CheckoutModals.jsx";
import { getCheckoutLoyaltyRule } from "../../services/checkoutService.js";
import { deliveryFee, freeshipMinSubtotal } from "../../constants/storeConfig.js";
import { checkoutFallbackCoupons } from "../../data/storeDefaults.js";
import { optionModalText } from "../../data/uiText.js";
import { formatMoney } from "../../utils/format.js";
import { getNearestPickupClock, getTodayInputDate } from "../../utils/dateTimeDefaults.js";
import { buildCheckoutPromoCodes, buildShippingZonesFromConfig, calculateCheckoutPricing } from "./checkoutPricing.js";
import { resolvePickupBranches } from "./checkoutDomain.js";
import useCheckoutActions from "./useCheckoutActions.js";
import useCheckoutDeliveryState from "./hooks/useCheckoutDeliveryState.js";
import useCheckoutPresetSync from "./hooks/useCheckoutPresetSync.js";
import useCheckoutPickupBranchState from "./hooks/useCheckoutPickupBranchState.js";
import useCheckoutGiftPromotions from "./hooks/useCheckoutGiftPromotions.js";
import useCheckoutDeliveryBranchSync from "./hooks/useCheckoutDeliveryBranchSync.js";
import useCheckoutLoyaltyRuleSync from "./hooks/useCheckoutLoyaltyRuleSync.js";
import useCheckoutPickupContactSync from "./hooks/useCheckoutPickupContactSync.js";

function getShortBranchLabel(name = "", fallback = "") {
  const rawName = String(name || fallback || "").trim();
  if (!rawName) return "";
  return rawName
    .replace(/^Gánh Hàng Rong\s*-\s*/i, "")
    .replace(/^Ganh Hang Rong\s*-\s*/i, "")
    .trim();
}

export default function Checkout({
  navigate,
  cart,
  setCart,
  subtotal,
  addToCart,
  openOptionModal,
  openCartItemEditor,
  createOrderFromCheckout,
  userProfile,
  isRegisteredCustomer,
  currentPhone,
  demoUser,
  demoLoyalty,
  demoOrders = [],
  demoAddresses = [],
  setDemoAddresses,
  products = [],
  toppings = [],
  deliveryZones = [],
  coupons = [],
  smartPromotions = [],
  branches = [],
  checkoutPreset,
  setCheckoutPreset,
  setServiceNotice,
  getStoreBlockNotice,
  isBranchOpenNow,
  buildOutOfHoursNotice
}) {
  const isQrCounterOrder =
    String(checkoutPreset?.orderSource || checkoutPreset?.source || "").toLowerCase() === "qr_counter" ||
    Boolean(checkoutPreset?.qrBranchLocked) ||
    Boolean(checkoutPreset?.qrAutoPickupNow);
  const qrLockedPickupBranchId = String(checkoutPreset?.selectedBranch || "").trim();

  const [fulfillmentType, setFulfillmentType] = useState(checkoutPreset?.fulfillmentType || "delivery");
  const [selectedBranch, setSelectedBranch] = useState(checkoutPreset?.selectedBranch || "");
  const [isChangingBranch, setIsChangingBranch] = useState(false);
  const [pickupMode, setPickupMode] = useState(isQrCounterOrder ? "soon" : (checkoutPreset?.pickupMode || "soon"));
  const [pickupDate, setPickupDate] = useState(checkoutPreset?.pickupDate || getTodayInputDate());
  const [pickupClock, setPickupClock] = useState(checkoutPreset?.pickupClock || getNearestPickupClock());
  const [usePoints, setUsePoints] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isDeliveryFeeModalOpen, setIsDeliveryFeeModalOpen] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [selectedDeliveryBranchId, setSelectedDeliveryBranchId] = useState(checkoutPreset?.selectedDeliveryBranch || "");
  const [pickupContact, setPickupContact] = useState(() => ({
    name: demoUser?.name || userProfile?.name || "",
    phone: currentPhone || demoUser?.phone || userProfile?.phone || ""
  }));

  const {
    deliveryInfo,
    deliveryDistanceKm,
    deliveryFeeSource,
    shippingConfig,
    deliveryEligibleBranches,
    deliverySourceBranch,
    deliveryOrigin,
    baseShippingByConfig,
    syncSelectedDeliveryBranch,
    handleSelectAddress,
    handleSaveAddress
  } = useCheckoutDeliveryState({
    branches,
    selectedDeliveryBranchId,
    setSelectedDeliveryBranchId,
    currentPhone,
    demoUser,
    demoAddresses,
    setDemoAddresses,
    deliveryFee
  });

  const pickupBranches = useMemo(() => resolvePickupBranches(branches), [branches]);
  const checkoutLoyalty = currentPhone ? (demoLoyalty || {}) : (demoLoyalty || {});
  const [loyaltyRule, setLoyaltyRule] = useState(() => getCheckoutLoyaltyRule());

  const promoCodes = useMemo(
    () => buildCheckoutPromoCodes(coupons, checkoutFallbackCoupons, subtotal, formatMoney, checkoutLoyalty?.voucherHistory || [], demoOrders || []),
    [coupons, subtotal, checkoutLoyalty?.voucherHistory, demoOrders]
  );

  const availablePoints = userProfile?.points || 0;
  const {
    baseCheckoutShip,
    autoShipSupport,
    checkoutShip,
    customerExtraShip,
    configSupportLimit,
    promoDiscount,
    earnedPreviewPoints,
    pointsDiscount,
    checkoutTotal
  } = calculateCheckoutPricing({
    fulfillmentType,
    baseShippingByConfig,
    smartPromotions,
    subtotal,
    shippingConfig,
    freeshipMinSubtotal,
    selectedPromo,
    availablePoints,
    usePoints,
    loyaltyRule
  });

  const originalSubtotal = useMemo(
    () =>
      cart.reduce((sum, item) => {
        if (item.autoGiftByPromo) return sum + Number(item.lineTotal || 0);
        return sum + Number(item.originalLineTotal || item.lineTotal || 0);
      }, 0),
    [cart]
  );

  const giftSavingAmount = useMemo(
    () =>
      cart.reduce((sum, item) => {
        if (!item.autoGiftByPromo) return sum;
        return sum + Number(item.originalLineTotal || item.originalUnitPrice || 0);
      }, 0),
    [cart]
  );

  const selectedBranchInfo = pickupBranches.find((branch) => branch.id === selectedBranch) || pickupBranches[0] || null;
  const pickupTimeText = isQrCounterOrder
    ? "Đặt liền tại quầy"
    : pickupMode === "soon"
      ? "Sẵn sàng sau khoảng 20 phút"
      : `${pickupClock} - ${pickupDate}`;

  const pickupDeliveryInfo = useMemo(
    () => ({
      ...deliveryInfo,
      name: pickupContact.name,
      phone: pickupContact.phone,
      address: selectedBranchInfo?.address || "Khách tự đến lấy",
      lat: null,
      lng: null,
      distanceKm: null,
      deliveryFee: 0
    }),
    [deliveryInfo, pickupContact.name, pickupContact.phone, selectedBranchInfo?.address]
  );

  const checkoutDeliveryInfo = fulfillmentType === "pickup" ? pickupDeliveryInfo : deliveryInfo;

  const { updateQty, handlePlaceOrder } = useCheckoutActions({
    setCart,
    createOrderFromCheckout,
    checkoutTotal,
    subtotal,
    checkoutShip,
    baseCheckoutShip,
    autoShipSupport,
    promoDiscount,
    selectedPromo,
    pointsDiscount,
    deliveryDistanceKm,
    deliveryInfo: checkoutDeliveryInfo,
    fulfillmentType,
    selectedBranchInfo,
    deliverySourceBranch,
    pickupTimeText,
    orderSource: isQrCounterOrder ? "qr_counter" : "online",
    navigate,
    onNotice: setCheckoutNotice
  });

  const shippingZonesFromConfig = buildShippingZonesFromConfig(
    shippingConfig,
    deliveryFee,
    freeshipMinSubtotal,
    formatMoney,
    smartPromotions
  );

  useCheckoutPresetSync({
    setCheckoutPreset,
    fulfillmentType,
    selectedBranch,
    pickupMode,
    pickupDate,
    pickupClock,
    selectedDeliveryBranch: deliverySourceBranch?.id
  });

  useEffect(() => {
    if (!isQrCounterOrder) return;
    if (fulfillmentType !== "pickup") setFulfillmentType("pickup");
    if (qrLockedPickupBranchId && selectedBranch !== qrLockedPickupBranchId) setSelectedBranch(qrLockedPickupBranchId);
    if (pickupMode !== "soon") setPickupMode("soon");
  }, [isQrCounterOrder, fulfillmentType, selectedBranch, qrLockedPickupBranchId, pickupMode]);

  useCheckoutPickupBranchState({
    pickupBranches,
    selectedBranch,
    setSelectedBranch,
    fulfillmentType,
    setIsChangingBranch
  });

  useCheckoutDeliveryBranchSync({
    syncSelectedDeliveryBranch,
    deliveryEligibleBranches,
    selectedDeliveryBranchId,
    checkoutPreset,
    setSelectedDeliveryBranchId
  });

  useCheckoutGiftPromotions({
    smartPromotions,
    subtotal,
    products,
    setCart
  });

  useEffect(() => {
    if (!Array.isArray(cart) || cart.length > 0) return;
    navigate("home", "home");
  }, [cart, navigate]);

  useCheckoutLoyaltyRuleSync({ setLoyaltyRule });

  useCheckoutPickupContactSync({
    currentPhone,
    demoUser,
    userProfile,
    setPickupContact
  });

  useEffect(() => {
    if (!isQrCounterOrder || isRegisteredCustomer) return;
    if (selectedPromo) setSelectedPromo(null);
    if (usePoints) setUsePoints(false);
  }, [isQrCounterOrder, isRegisteredCustomer, selectedPromo, usePoints]);

  const handleCheckoutPlaceOrder = async () => {
    if (isPlacingOrder) return;
    setIsPlacingOrder(true);

    try {
      if (fulfillmentType === "delivery") {
        const hasAddress = String(deliveryInfo?.address || "").trim().length > 0;
        if (!hasAddress || !deliverySourceBranch) {
          setCheckoutNotice({
            icon: "warning",
            title: "Vui lòng kiểm tra địa chỉ giao hàng",
            message: "Bạn cần chọn địa chỉ nhận và chi nhánh giao trước khi đặt hàng."
          });
          return;
        }
      }

      await executeCheckoutPlaceOrder();
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const executeCheckoutPlaceOrder = async () => {
    const orderBranch = fulfillmentType === "pickup" ? selectedBranchInfo : deliverySourceBranch;
    const storeNotice = getStoreBlockNotice?.();

    if (orderBranch && isBranchOpenNow && !isBranchOpenNow(orderBranch)) {
      setServiceNotice?.(buildOutOfHoursNotice?.(orderBranch) || storeNotice);
      return;
    }

    if (!orderBranch && storeNotice) {
      setServiceNotice?.(storeNotice);
      return;
    }

    await handlePlaceOrder();
  };

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cart]
  );
  const stickyBranchLabel = getShortBranchLabel(
    fulfillmentType === "pickup" ? selectedBranchInfo?.name : deliverySourceBranch?.name,
    fulfillmentType === "pickup" ? "Tự đến lấy" : "Giao tận nơi"
  );

  const stickyMeta =
    fulfillmentType === "pickup"
      ? `${stickyBranchLabel || "Tự đến lấy"}`
      : `${stickyBranchLabel || "Giao tận nơi"}`;
  const stickyFulfillmentLabel = fulfillmentType === "pickup" ? "Tự lấy" : "Giao hàng";
  const stickySummary = `${stickyFulfillmentLabel} • ${cartCount} món • ${stickyMeta}`;

  const headerSubtitle =
    fulfillmentType === "pickup"
      ? "Xem lại món và thời gian đến lấy"
      : "Xem lại món, địa chỉ và ưu đãi";

  return (
    <section>
      <AppHeader
        title="Thanh toán"
        subtitle={headerSubtitle}
        onBack={() => navigate("menu", "menu")}
      />

      <div className="checkout-page-content">
        <CheckoutFulfillmentSection
          fulfillmentType={fulfillmentType}
          setFulfillmentType={setFulfillmentType}
          forcePickupOnly={isQrCounterOrder}
          hidePickupSchedule={isQrCounterOrder}
          lockPickupBranch={isQrCounterOrder}
          setIsAddressModalOpen={setIsAddressModalOpen}
          deliveryInfo={deliveryInfo}
          deliverySourceBranch={deliverySourceBranch}
          pickupContact={pickupContact}
          setPickupContact={setPickupContact}
          selectedBranchInfo={selectedBranchInfo}
          isChangingBranch={isChangingBranch}
          pickupBranches={pickupBranches}
          selectedBranch={selectedBranch}
          setSelectedBranch={setSelectedBranch}
          setIsChangingBranch={setIsChangingBranch}
          pickupMode={pickupMode}
          setPickupMode={setPickupMode}
          pickupDate={pickupDate}
          setPickupDate={setPickupDate}
          pickupClock={pickupClock}
          setPickupClock={setPickupClock}
        />

        <AppCart
          cart={cart}
          setCart={setCart}
          updateQty={updateQty}
          onEditItem={openCartItemEditor}
          isEditableItem={(item) => {
            const isAddon = String(item?.id || "").startsWith("addon-");
            return !isAddon && !item?.autoGiftByPromo;
          }}
          CheckoutCard={CheckoutCard}
          addonCategory={optionModalText.addonCategory}
          formatMoney={formatMoney}
          Icon={Icon}
        />

        <CheckoutPricingSection
          subtotal={subtotal}
          addToCart={addToCart}
          openOptionModal={openOptionModal}
          products={products}
          toppings={toppings}
          coupons={coupons}
          smartPromotions={smartPromotions}
          selectedPromo={selectedPromo}
          setSelectedPromo={setSelectedPromo}
          setIsPromoModalOpen={setIsPromoModalOpen}
          availablePoints={availablePoints}
          usePoints={usePoints}
          setUsePoints={setUsePoints}
          pointsDiscount={pointsDiscount}
          earnedPreviewPoints={earnedPreviewPoints}
          originalSubtotal={originalSubtotal}
          giftSavingAmount={giftSavingAmount}
          checkoutShip={checkoutShip}
          baseCheckoutShip={baseCheckoutShip}
          autoShipSupport={autoShipSupport}
          configSupportLimit={configSupportLimit}
          customerExtraShip={customerExtraShip}
          shippingConfig={shippingConfig}
          checkoutTotal={checkoutTotal}
          cart={cart}
          promoDiscount={promoDiscount}
          fulfillmentType={fulfillmentType}
          deliveryDistanceKm={deliveryDistanceKm}
          setIsDeliveryFeeModalOpen={setIsDeliveryFeeModalOpen}
          isRegisteredCustomer={isRegisteredCustomer}
          isQrCounterOrder={isQrCounterOrder}
        />
      </div>

      <div className="checkout-sticky-cta">
        <div className="checkout-sticky-cta__inner">
          <div className="checkout-sticky-cta__meta">
            <strong>{formatMoney(checkoutTotal)}</strong>
            <div className="checkout-sticky-cta__subline">
              <span className="checkout-sticky-status">
                <em>{stickySummary}</em>
              </span>
            </div>
          </div>
          <button
            onClick={handleCheckoutPlaceOrder}
            className={`cta ${isPlacingOrder ? "is-loading" : ""}`}
            disabled={isPlacingOrder}
          >
            {isPlacingOrder ? "Đang gửi đơn..." : "Đặt món"}
          </button>
        </div>
      </div>

      <CheckoutModals
        isPromoModalOpen={isPromoModalOpen}
        promoCodes={promoCodes}
        selectedPromo={selectedPromo}
        setSelectedPromo={setSelectedPromo}
        setIsPromoModalOpen={setIsPromoModalOpen}
        isAddressModalOpen={isAddressModalOpen}
        deliveryInfo={deliveryInfo}
        demoAddresses={demoAddresses}
        subtotal={subtotal}
        deliveryEligibleBranches={deliveryEligibleBranches}
        selectedDeliveryBranchId={selectedDeliveryBranchId}
        setSelectedDeliveryBranchId={setSelectedDeliveryBranchId}
        handleSelectAddress={handleSelectAddress}
        setIsAddressModalOpen={setIsAddressModalOpen}
        deliveryOrigin={deliveryOrigin}
        shippingConfig={shippingConfig}
        handleSaveAddress={handleSaveAddress}
        isDeliveryFeeModalOpen={isDeliveryFeeModalOpen}
        shippingZonesFromConfig={shippingZonesFromConfig}
        deliveryZones={deliveryZones}
        fulfillmentType={fulfillmentType}
        deliveryDistanceKm={deliveryDistanceKm}
        baseCheckoutShip={baseCheckoutShip}
        deliveryFeeSource={deliveryFeeSource}
        deliverySourceBranch={deliverySourceBranch}
        setIsDeliveryFeeModalOpen={setIsDeliveryFeeModalOpen}
        checkoutNotice={checkoutNotice}
        setCheckoutNotice={setCheckoutNotice}
      />
    </section>
  );
}
