import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";
import AppHeader from "../../components/app/Header.jsx";
import AppCart from "../../components/app/Cart.jsx";
import CheckoutCard from "./components/CheckoutCard.jsx";
import CheckoutFulfillmentSection from "./components/CheckoutFulfillmentSection.jsx";
import CheckoutPricingSection from "./components/CheckoutPricingSection.jsx";
import CheckoutModals from "./components/CheckoutModals.jsx";
import CheckoutPlacingOverlay from "./components/CheckoutPlacingOverlay.jsx";
import { getCheckoutLoyaltyRule } from "../../services/checkoutService.js";
import {
  clearCheckoutVoucherIntent,
  findCheckoutPromoByIntent,
  readCheckoutVoucherIntent
} from "../../services/checkoutVoucherIntentService.js";
import { validateCheckoutContact } from "../../services/checkoutOrderService.js";
import { deliveryFee, freeshipMinSubtotal } from "../../constants/storeConfig.js";
import { checkoutFallbackCoupons } from "../../data/storeDefaults.js";
import { optionModalText } from "../../data/uiText.js";
import { formatMoney } from "../../utils/format.js";
import {
  getBranchOpenClose,
  getClockMinutes,
  getTodayInputDate,
  isPickupClockInBranchHours,
  normalizePickupClock,
  normalizePickupDate
} from "../../utils/dateTimeDefaults.js";
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

function isPlaceholderCustomerName(name = "") {
  const normalized = String(name || "").trim().toLowerCase();
  return !normalized || ["khách", "khách hàng", "khach", "khach hang"].includes(normalized);
}

function pickCheckoutCustomerName(user = {}, fallback = {}) {
  const candidates = [
    user?.name,
    user?.fullName,
    user?.full_name,
    user?.displayName,
    user?.display_name,
    user?.customerName,
    user?.customer_name,
    fallback?.name,
    fallback?.fullName,
    fallback?.full_name,
    fallback?.displayName,
    fallback?.display_name
  ];
  return candidates.map((value) => String(value || "").trim()).find((value) => !isPlaceholderCustomerName(value)) || "";
}

function getShortBranchLabel(name = "", fallback = "") {
  const rawName = String(name || fallback || "").trim();
  if (!rawName) return "";
  return rawName
    .replace(/^Gánh Hàng Rong\s*-\s*/i, "")
    .replace(/^Ganh Hang Rong\s*-\s*/i, "")
    .trim();
}

function focusCheckoutField(elementId) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  window.requestAnimationFrame(() => {
    const target = document.getElementById(elementId);
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    target.focus({ preventScroll: true });
  });
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
  repriceCartNow,
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
  const [pickupDate, setPickupDate] = useState(() => normalizePickupDate(checkoutPreset?.pickupDate));
  const [pickupClock, setPickupClock] = useState(() => normalizePickupClock(checkoutPreset?.pickupClock));
  const [usePoints, setUsePoints] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [voucherIntent, setVoucherIntent] = useState(() => readCheckoutVoucherIntent());
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isDeliveryFeeModalOpen, setIsDeliveryFeeModalOpen] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState(null);
  const [checkoutFieldErrors, setCheckoutFieldErrors] = useState({});
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [selectedDeliveryBranchId, setSelectedDeliveryBranchId] = useState(checkoutPreset?.selectedDeliveryBranch || "");
  const [paymentMethod, setPaymentMethod] = useState(isQrCounterOrder ? "bank_qr" : "COD");
  const [pickupContact, setPickupContact] = useState(() => ({
    name: pickCheckoutCustomerName(userProfile, demoUser),
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
    initialDeliveryInfo: checkoutPreset?.reorderDeliveryInfo,
    setDemoAddresses,
    deliveryFee
  });

  useEffect(() => {
    if (!checkoutPreset?.reorderDeliveryInfo) return;
    setCheckoutPreset?.((current) => {
      if (!current?.reorderDeliveryInfo) return current;
      const next = { ...current };
      delete next.reorderDeliveryInfo;
      return next;
    });
  }, [checkoutPreset?.reorderDeliveryInfo, setCheckoutPreset]);

  const pickupBranches = useMemo(() => resolvePickupBranches(branches), [branches]);
  const deliveryAvailable = deliveryEligibleBranches.length > 0;
  const checkoutLoyalty = currentPhone ? (demoLoyalty || {}) : (demoLoyalty || {});
  const [loyaltyRule, setLoyaltyRule] = useState(() => getCheckoutLoyaltyRule());
  const effectiveLoyaltyRule = useMemo(() => {
    const currentTier = (Array.isArray(loyaltyRule?.tiers) ? loyaltyRule.tiers : [])
      .find((tier) => tier?.id === checkoutLoyalty?.tierId);
    return currentTier ? { ...loyaltyRule, ...currentTier } : loyaltyRule;
  }, [checkoutLoyalty?.tierId, loyaltyRule]);

  const allPromoCodes = useMemo(
    () => buildCheckoutPromoCodes(coupons, checkoutFallbackCoupons, subtotal, formatMoney, checkoutLoyalty?.voucherHistory || [], demoOrders || []),
    [coupons, subtotal, checkoutLoyalty?.voucherHistory, demoOrders]
  );

  const promoCodes = useMemo(() => {
    if (!isQrCounterOrder || isRegisteredCustomer) return allPromoCodes;
    return allPromoCodes.filter((promo) => String(promo?.source || "").toLowerCase() !== "loyalty");
  }, [allPromoCodes, isQrCounterOrder, isRegisteredCustomer]);

  useEffect(() => {
    if (!voucherIntent || !promoCodes.length) return;
    const intendedPromo = findCheckoutPromoByIntent(promoCodes, voucherIntent);
    if (!intendedPromo) return;

    if (Number(intendedPromo.discount || 0) > 0 || intendedPromo.freeShip) {
      setSelectedPromo(intendedPromo);
    } else {
      setCheckoutNotice({
        icon: "tag",
        title: `Voucher ${intendedPromo.code} đang chờ`,
        message: `${intendedPromo.condition}. Bạn thêm món để đủ điều kiện rồi chọn lại voucher tại phần Ưu đãi.`
      });
    }

    clearCheckoutVoucherIntent();
    setVoucherIntent(null);
  }, [promoCodes, voucherIntent]);

  useEffect(() => {
    if (!selectedPromo) return;
    const refreshedPromo = promoCodes.find((promo) => promo.id === selectedPromo.id);
    if (!refreshedPromo || Number(refreshedPromo.discount || 0) <= 0) {
      setSelectedPromo(null);
      return;
    }
    if (
      Number(refreshedPromo.discount || 0) !== Number(selectedPromo.discount || 0) ||
      refreshedPromo.code !== selectedPromo.code ||
      refreshedPromo.condition !== selectedPromo.condition
    ) {
      setSelectedPromo(refreshedPromo);
    }
  }, [promoCodes, selectedPromo]);

  const availablePoints = Math.max(
    0,
    Number(checkoutLoyalty?.totalPoints ?? userProfile?.points ?? 0)
  );
  const {
    baseCheckoutShip,
    autoShipSupport,
    checkoutShip,
    customerExtraShip,
    configSupportLimit,
    promoDiscount,
    earnedPreviewPoints,
    maxRedemptionPercent,
    maxPointDiscount,
    pointsSpent,
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
    loyaltyRule: effectiveLoyaltyRule
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
  const pickupBranchHours = getBranchOpenClose(selectedBranchInfo);

  const clearCheckoutFieldError = (field) => {
    if (!field) {
      setCheckoutFieldErrors({});
      return;
    }
    setCheckoutFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const showCheckoutFieldError = (field, message, elementId) => {
    setCheckoutFieldErrors({ [field]: message });
    focusCheckoutField(elementId);
  };

  const { updateQty, handlePlaceOrder } = useCheckoutActions({
    setCart,
    createOrderFromCheckout,
    repriceCartNow,
    checkoutTotal,
    subtotal,
    checkoutShip,
    baseCheckoutShip,
    autoShipSupport,
    promoDiscount,
    selectedPromo,
    pointsSpent,
    pointsDiscount,
    deliveryDistanceKm,
    deliveryInfo: checkoutDeliveryInfo,
    fulfillmentType,
    selectedBranchInfo,
    deliverySourceBranch,
    pickupTimeText,
    orderSource: isQrCounterOrder ? "qr_counter" : "online",
    paymentMethod: isQrCounterOrder ? paymentMethod : "COD",
    navigate,
    onNotice: setCheckoutNotice,
    onVoucherRejected: () => setSelectedPromo(null)
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

  useEffect(() => {
    if (isQrCounterOrder || deliveryAvailable || fulfillmentType !== "delivery") return;
    setFulfillmentType("pickup");
  }, [deliveryAvailable, fulfillmentType, isQrCounterOrder]);

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
    pickupPhone: pickupContact.phone,
    userProfile,
    setPickupContact
  });

  useEffect(() => {
    if (!isQrCounterOrder || isRegisteredCustomer) return;
    if (selectedPromo?.source === "loyalty") setSelectedPromo(null);
    if (usePoints) setUsePoints(false);
  }, [isQrCounterOrder, isRegisteredCustomer, selectedPromo, usePoints]);

  useEffect(() => {
    if (isQrCounterOrder) return;
    setPaymentMethod("COD");
  }, [isQrCounterOrder]);

  const handleCheckoutPlaceOrder = async () => {
    if (isPlacingOrder) return;
    setCheckoutFieldErrors({});

    if (fulfillmentType === "delivery" && !deliveryAvailable) {
      setCheckoutNotice({
        icon: "warning",
        title: "Tạm ngưng giao hàng",
        message: "Hiện quán chưa bật tính năng giao hàng. Bạn vui lòng chọn Đến lấy để tiếp tục đặt món."
      });
      return;
    }

    const contactValidation = validateCheckoutContact({
      deliveryInfo: checkoutDeliveryInfo,
      fulfillmentType
    });
    if (!contactValidation.ok) {
      if (fulfillmentType === "delivery") {
        showCheckoutFieldError("delivery", contactValidation.message, "checkout-delivery-error");
        return;
      }

      const pickupField = contactValidation.field === "name" ? "pickupName" : "pickupPhone";
      const pickupElementId = pickupField === "pickupName" ? "checkout-pickup-name" : "checkout-pickup-phone";
      showCheckoutFieldError(pickupField, contactValidation.message, pickupElementId);
      return;
    }

    if (fulfillmentType === "pickup" && pickupMode === "schedule" && !isQrCounterOrder) {
      const today = getTodayInputDate();
      if (pickupDate !== today) {
        showCheckoutFieldError(
          "pickupDate",
          "Quán chỉ nhận đơn hẹn lấy trong ngày hôm nay.",
          "checkout-pickup-date"
        );
        return;
      }

      if (!isPickupClockInBranchHours(pickupClock, selectedBranchInfo)) {
        showCheckoutFieldError(
          "pickupTime",
          `Vui lòng chọn giờ từ ${pickupBranchHours.open} đến ${pickupBranchHours.close}.`,
          "checkout-pickup-time"
        );
        return;
      }

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (getClockMinutes(pickupClock) <= currentMinutes) {
        showCheckoutFieldError(
          "pickupTime",
          "Vui lòng chọn giờ muộn hơn thời gian hiện tại.",
          "checkout-pickup-time"
        );
        return;
      }
    }

    if (fulfillmentType === "delivery" && !deliverySourceBranch) {
      showCheckoutFieldError(
        "delivery",
        "Vui lòng chọn lại địa chỉ để xác định chi nhánh giao hàng.",
        "checkout-delivery-error"
      );
      return;
    }

    setIsPlacingOrder(true);
    try {
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
    isQrCounterOrder
      ? "Xem lại món và chọn cách thanh toán"
      : fulfillmentType === "pickup"
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
          isQrCounterOrder={isQrCounterOrder}
          deliveryAvailable={deliveryAvailable}
          onUnavailableDelivery={() => setCheckoutNotice({
            icon: "warning",
            title: "Tạm ngưng giao hàng",
            message: "Hiện quán chưa bật tính năng giao hàng. Bạn vui lòng chọn Đến lấy để tiếp tục đặt món."
          })}
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
          pickupDateLimit={getTodayInputDate()}
          pickupTimeMin={pickupBranchHours.open}
          pickupTimeMax={pickupBranchHours.close}
          fieldErrors={checkoutFieldErrors}
          onClearFieldError={clearCheckoutFieldError}
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
          navigate={navigate}
          promoCodes={promoCodes}
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
          maxRedemptionPercent={maxRedemptionPercent}
          maxPointDiscount={maxPointDiscount}
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
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
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
            {isPlacingOrder ? "Đang xác nhận…" : paymentMethod === "bank_qr" ? "Đặt & thanh toán QR" : "Đặt món"}
          </button>
        </div>
      </div>

      <CheckoutPlacingOverlay open={isPlacingOrder} />

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
        handleSelectAddress={(address) => {
          clearCheckoutFieldError("delivery");
          return handleSelectAddress(address);
        }}
        setIsAddressModalOpen={setIsAddressModalOpen}
        deliveryOrigin={deliveryOrigin}
        shippingConfig={shippingConfig}
        handleSaveAddress={(nextInfo) => {
          clearCheckoutFieldError("delivery");
          return handleSaveAddress(nextInfo);
        }}
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
