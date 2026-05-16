import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon.js";
import AppHeader from "../../components/app/Header.js";
import AppCart from "../../components/app/Cart.js";
import CheckoutCard from "./components/CheckoutCard.js";
import CheckoutFulfillmentSection from "./components/CheckoutFulfillmentSection.js";
import CheckoutPricingSection from "./components/CheckoutPricingSection.js";
import CheckoutModals from "./components/CheckoutModals.js";
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
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
  const [fulfillmentType, setFulfillmentType] = useState(checkoutPreset?.fulfillmentType || "delivery");
  const [selectedBranch, setSelectedBranch] = useState(checkoutPreset?.selectedBranch || "");
  const [isChangingBranch, setIsChangingBranch] = useState(false);
  const [pickupMode, setPickupMode] = useState(checkoutPreset?.pickupMode || "soon");
  const [pickupDate, setPickupDate] = useState(checkoutPreset?.pickupDate || getTodayInputDate());
  const [pickupClock, setPickupClock] = useState(checkoutPreset?.pickupClock || getNearestPickupClock());
  const [usePoints, setUsePoints] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isDeliveryFeeModalOpen, setIsDeliveryFeeModalOpen] = useState(false);
  const [isDeliveryConfirmOpen, setIsDeliveryConfirmOpen] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState(null);
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
    shippingNeedsRefresh,
    setShippingNeedsRefresh,
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
  const checkoutLoyalty = currentPhone ? demoLoyalty || {} : demoLoyalty || {};
  const [loyaltyRule, setLoyaltyRule] = useState(() => getCheckoutLoyaltyRule());
  const promoCodes = useMemo(() => buildCheckoutPromoCodes(coupons, checkoutFallbackCoupons, subtotal, formatMoney, checkoutLoyalty?.voucherHistory || [], demoOrders || []), [coupons, subtotal, checkoutLoyalty?.voucherHistory, demoOrders]);
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
  const originalSubtotal = useMemo(() => cart.reduce((sum, item) => {
    if (item.autoGiftByPromo) return sum + Number(item.lineTotal || 0);
    return sum + Number(item.originalLineTotal || item.lineTotal || 0);
  }, 0), [cart]);
  const giftSavingAmount = useMemo(() => cart.reduce((sum, item) => {
    if (!item.autoGiftByPromo) return sum;
    return sum + Number(item.originalLineTotal || item.originalUnitPrice || 0);
  }, 0), [cart]);
  const selectedBranchInfo = pickupBranches.find(branch => branch.id === selectedBranch) || pickupBranches[0] || null;
  const pickupTimeText = pickupMode === "soon" ? "Sẵn sàng sau khoảng 20 phút" : `${pickupClock} - ${pickupDate}`;
  const pickupDeliveryInfo = useMemo(() => ({
    ...deliveryInfo,
    name: pickupContact.name,
    phone: pickupContact.phone,
    address: selectedBranchInfo?.address || "Khách tự đến lấy",
    lat: null,
    lng: null,
    distanceKm: null,
    deliveryFee: 0
  }), [deliveryInfo, pickupContact.name, pickupContact.phone, selectedBranchInfo?.address]);
  const checkoutDeliveryInfo = fulfillmentType === "pickup" ? pickupDeliveryInfo : deliveryInfo;
  const isShippingFeeConfirmed = fulfillmentType !== "delivery" || !shippingNeedsRefresh && deliveryFeeSource === "Goong.io";
  const {
    updateQty,
    handlePlaceOrder
  } = useCheckoutActions({
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
    navigate,
    onNotice: setCheckoutNotice
  });
  const shippingZonesFromConfig = buildShippingZonesFromConfig(shippingConfig, deliveryFee, freeshipMinSubtotal, formatMoney, smartPromotions);
  useCheckoutPresetSync({
    setCheckoutPreset,
    fulfillmentType,
    selectedBranch,
    pickupMode,
    pickupDate,
    pickupClock,
    selectedDeliveryBranch: deliverySourceBranch?.id
  });
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
  useCheckoutLoyaltyRuleSync({
    setLoyaltyRule
  });
  useCheckoutPickupContactSync({
    currentPhone,
    demoUser,
    userProfile,
    setPickupContact
  });
  const handleCheckoutPlaceOrder = async () => {
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
      setIsDeliveryConfirmOpen(true);
      return;
    }
    await executeCheckoutPlaceOrder();
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
  return /*#__PURE__*/_jsxs("section", {
    children: [/*#__PURE__*/_jsx(AppHeader, {
      title: "Thanh toán",
      onBack: () => navigate("menu", "menu")
    }), /*#__PURE__*/_jsxs("div", {
      className: "space-y-4 px-4 pb-28",
      children: [/*#__PURE__*/_jsx(CheckoutFulfillmentSection, {
        fulfillmentType: fulfillmentType,
        setFulfillmentType: setFulfillmentType,
        setIsAddressModalOpen: setIsAddressModalOpen,
        deliveryInfo: deliveryInfo,
        pickupContact: pickupContact,
        setPickupContact: setPickupContact,
        selectedBranchInfo: selectedBranchInfo,
        isChangingBranch: isChangingBranch,
        pickupBranches: pickupBranches,
        selectedBranch: selectedBranch,
        setSelectedBranch: setSelectedBranch,
        setIsChangingBranch: setIsChangingBranch,
        pickupMode: pickupMode,
        setPickupMode: setPickupMode,
        pickupDate: pickupDate,
        setPickupDate: setPickupDate,
        pickupClock: pickupClock,
        setPickupClock: setPickupClock
      }), /*#__PURE__*/_jsx(AppCart, {
        cart: cart,
        setCart: setCart,
        updateQty: updateQty,
        onEditItem: openCartItemEditor,
        isEditableItem: item => {
          const isAddon = String(item?.id || "").startsWith("addon-");
          return !isAddon && !item?.autoGiftByPromo;
        },
        CheckoutCard: CheckoutCard,
        addonCategory: optionModalText.addonCategory,
        formatMoney: formatMoney,
        Icon: Icon
      }), /*#__PURE__*/_jsx(CheckoutPricingSection, {
        subtotal: subtotal,
        addToCart: addToCart,
        openOptionModal: openOptionModal,
        products: products,
        toppings: toppings,
        coupons: coupons,
        smartPromotions: smartPromotions,
        selectedPromo: selectedPromo,
        setSelectedPromo: setSelectedPromo,
        setIsPromoModalOpen: setIsPromoModalOpen,
        availablePoints: availablePoints,
        usePoints: usePoints,
        setUsePoints: setUsePoints,
        pointsDiscount: pointsDiscount,
        earnedPreviewPoints: earnedPreviewPoints,
        originalSubtotal: originalSubtotal,
        giftSavingAmount: giftSavingAmount,
        checkoutShip: checkoutShip,
        baseCheckoutShip: baseCheckoutShip,
        autoShipSupport: autoShipSupport,
        configSupportLimit: configSupportLimit,
        customerExtraShip: customerExtraShip,
        shippingConfig: shippingConfig,
        checkoutTotal: checkoutTotal,
        cart: cart,
        promoDiscount: promoDiscount,
        fulfillmentType: fulfillmentType,
        deliveryDistanceKm: deliveryDistanceKm,
        setIsDeliveryFeeModalOpen: setIsDeliveryFeeModalOpen
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "checkout-sticky-cta",
      children: /*#__PURE__*/_jsxs("button", {
        onClick: handleCheckoutPlaceOrder,
        className: "cta w-full",
        children: ["Đặt hàng - ", formatMoney(checkoutTotal)]
      })
    }), isDeliveryConfirmOpen ? /*#__PURE__*/_jsx("div", {
      className: "checkout-confirm-overlay",
      role: "presentation",
      onClick: () => setIsDeliveryConfirmOpen(false),
      children: /*#__PURE__*/_jsxs("section", {
        className: "checkout-confirm-modal",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Xác nhận giao hàng",
        onClick: event => event.stopPropagation(),
        children: [/*#__PURE__*/_jsx("h3", {
          children: "Xác nhận thông tin giao hàng"
        }), /*#__PURE__*/_jsx("p", {
          children: "Kiểm tra lại chi nhánh giao và phí ship trước khi đặt hàng."
        }), /*#__PURE__*/_jsxs("div", {
          className: "checkout-confirm-info",
          children: [/*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("span", {
              children: "Chi nhánh giao"
            }), /*#__PURE__*/_jsx("strong", {
              children: deliverySourceBranch?.name || "Chưa chọn chi nhánh"
            })]
          }), /*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("span", {
              children: "Địa chỉ nhận"
            }), /*#__PURE__*/_jsx("strong", {
              children: deliveryInfo?.address || "Chưa có địa chỉ giao"
            })]
          }), /*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("span", {
              children: "Phí ship hiện tại"
            }), /*#__PURE__*/_jsx("strong", {
              children: isShippingFeeConfirmed ? formatMoney(checkoutShip || 0) : "Chưa cập nhật theo chi nhánh mới"
            })]
          })]
        }), !isShippingFeeConfirmed ? /*#__PURE__*/_jsx("p", {
          className: "checkout-confirm-warning",
          children: "Vui lòng cập nhật địa chỉ để tính lại phí ship chính xác theo chi nhánh đã chọn."
        }) : null, /*#__PURE__*/_jsxs("div", {
          className: "checkout-confirm-actions",
          children: [/*#__PURE__*/_jsx("button", {
            type: "button",
            className: "secondary",
            onClick: () => {
              setIsDeliveryConfirmOpen(false);
              setIsAddressModalOpen(true);
            },
            children: "Cập nhật địa chỉ"
          }), /*#__PURE__*/_jsx("button", {
            type: "button",
            className: "cta",
            onClick: async () => {
              setIsDeliveryConfirmOpen(false);
              await executeCheckoutPlaceOrder();
            },
            disabled: !isShippingFeeConfirmed,
            children: "Xác nhận đặt hàng"
          })]
        })]
      })
    }) : null, /*#__PURE__*/_jsx(CheckoutModals, {
      isPromoModalOpen: isPromoModalOpen,
      promoCodes: promoCodes,
      selectedPromo: selectedPromo,
      setSelectedPromo: setSelectedPromo,
      setIsPromoModalOpen: setIsPromoModalOpen,
      isAddressModalOpen: isAddressModalOpen,
      deliveryInfo: deliveryInfo,
      demoAddresses: demoAddresses,
      subtotal: subtotal,
      deliveryEligibleBranches: deliveryEligibleBranches,
      selectedDeliveryBranchId: selectedDeliveryBranchId,
      setSelectedDeliveryBranchId: setSelectedDeliveryBranchId,
      handleSelectAddress: handleSelectAddress,
      setIsAddressModalOpen: setIsAddressModalOpen,
      deliveryOrigin: deliveryOrigin,
      shippingConfig: shippingConfig,
      handleSaveAddress: handleSaveAddress,
      setShippingNeedsRefresh: setShippingNeedsRefresh,
      isDeliveryFeeModalOpen: isDeliveryFeeModalOpen,
      shippingZonesFromConfig: shippingZonesFromConfig,
      deliveryZones: deliveryZones,
      fulfillmentType: fulfillmentType,
      deliveryDistanceKm: deliveryDistanceKm,
      baseCheckoutShip: baseCheckoutShip,
      deliveryFeeSource: deliveryFeeSource,
      deliverySourceBranch: deliverySourceBranch,
      setIsDeliveryFeeModalOpen: setIsDeliveryFeeModalOpen,
      checkoutNotice: checkoutNotice,
      setCheckoutNotice: setCheckoutNotice
    })]
  });
}