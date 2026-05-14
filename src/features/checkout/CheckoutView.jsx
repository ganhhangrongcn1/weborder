import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";
import GoongAddressPicker from "../../components/GoongAddressPicker.jsx";
import AppHeader from "../../components/app/Header.jsx";
import AppCart from "../../components/app/Cart.jsx";
import CheckoutMilestoneSuggest from "./components/CheckoutMilestoneSuggest.jsx";
import PromoModal from "./components/PromoModal.jsx";
import DeliveryFeeModal from "./components/DeliveryFeeModal.jsx";
import CheckoutCard from "./components/CheckoutCard.jsx";
import InfoLine from "./components/InfoLine.jsx";
import CheckoutTotalCard from "./components/CheckoutTotalCard.jsx";
import { getCheckoutLoyaltyRule } from "../../services/checkoutService.js";
import { deliveryFee, freeshipMinSubtotal } from "../../constants/storeConfig.js";
import { checkoutFallbackCoupons } from "../../data/storeDefaults.js";
import { checkoutText, optionModalText } from "../../data/uiText.js";
import { formatMoney } from "../../utils/format.js";
import { buildCheckoutPromoCodes, buildShippingZonesFromConfig, calculateCheckoutPricing } from "./checkoutPricing.js";
import { resolvePickupBranches } from "./checkoutDomain.js";
import useCheckoutActions from "./useCheckoutActions.js";
import useCheckoutDeliveryState from "./hooks/useCheckoutDeliveryState.js";
import useCheckoutPresetSync from "./hooks/useCheckoutPresetSync.js";
import useCheckoutPickupBranchState from "./hooks/useCheckoutPickupBranchState.js";
import useCheckoutGiftPromotions from "./hooks/useCheckoutGiftPromotions.js";
import AddressModal from "./components/AddressModal.jsx";
import CheckoutNoticeModal from "./components/CheckoutNoticeModal.jsx";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

export default function Checkout({
  navigate,
  cart,
  setCart,
  subtotal,
  ship,
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
  const [pickupDate, setPickupDate] = useState(checkoutPreset?.pickupDate || "2026-05-02");
  const [pickupClock, setPickupClock] = useState(checkoutPreset?.pickupClock || "12:30");
  const [usePoints, setUsePoints] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isDeliveryFeeModalOpen, setIsDeliveryFeeModalOpen] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState(null);
  const [selectedDeliveryBranchId, setSelectedDeliveryBranchId] = useState(checkoutPreset?.selectedDeliveryBranch || "");
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
  const promoCodes = useMemo(
    () => buildCheckoutPromoCodes(coupons, checkoutFallbackCoupons, subtotal, formatMoney, checkoutLoyalty?.voucherHistory || [], demoOrders || []),
    [coupons, subtotal, checkoutLoyalty?.voucherHistory, demoOrders]
  );
  const availablePoints = userProfile?.points || 0;
  const loyaltyRule = getCheckoutLoyaltyRule();
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
    () => cart.reduce((sum, item) => {
      if (item.autoGiftByPromo) return sum + Number(item.lineTotal || 0);
      return sum + Number(item.originalLineTotal || item.lineTotal || 0);
    }, 0),
    [cart]
  );
  const giftSavingAmount = useMemo(
    () => cart.reduce((sum, item) => {
      if (!item.autoGiftByPromo) return sum;
      return sum + Number(item.originalLineTotal || item.originalUnitPrice || 0);
    }, 0),
    [cart]
  );
  const selectedBranchInfo = pickupBranches.find(branch => branch.id === selectedBranch) || pickupBranches[0] || null;
  const pickupTimeText = pickupMode === "soon" ? "Sẵn sàng sau khoảng 20 phút" : `${pickupClock} - ${pickupDate}`;
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
    deliveryInfo,
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
  useEffect(() => {
    syncSelectedDeliveryBranch();
  }, [syncSelectedDeliveryBranch, deliveryEligibleBranches, selectedDeliveryBranchId]);
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

  const handleCheckoutPlaceOrder = async () => {
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
      children: [/*#__PURE__*/_jsxs("div", {
        className: "fulfillment-tabs",
        children: [/*#__PURE__*/_jsx("button", {
          onClick: () => setFulfillmentType("delivery"),
          className: fulfillmentType === "delivery" ? "active" : "",
          children: "Giao tận nơi"
        }), /*#__PURE__*/_jsx("button", {
          onClick: () => setFulfillmentType("pickup"),
          className: fulfillmentType === "pickup" ? "active" : "",
          children: "Đến lấy"
        })]
      }), fulfillmentType === "delivery" ? /*#__PURE__*/_jsx(CheckoutCard, {
        title: checkoutText.deliveryTo,
        action: checkoutText.changeAddress,
        onAction: () => setIsAddressModalOpen(true),
        children: /*#__PURE__*/_jsxs("div", {
          className: "delivery-info-box",
          children: [/*#__PURE__*/_jsx(InfoLine, {
            icon: "user",
            label: checkoutText.customerName,
            value: deliveryInfo.name
          }), /*#__PURE__*/_jsx(InfoLine, {
            icon: "home",
            label: checkoutText.address,
            value: deliveryInfo.address
          }), /*#__PURE__*/_jsx(InfoLine, {
            icon: "phone",
            label: checkoutText.phone,
            value: deliveryInfo.phone
          })]
        })
      }) : /*#__PURE__*/_jsx(CheckoutCard, {
        title: "Chọn chi nhánh để lấy",
        children: /*#__PURE__*/_jsx("div", {
          className: "space-y-3",
          children: (selectedBranchInfo && !isChangingBranch ? [selectedBranchInfo] : pickupBranches).map(branch => /*#__PURE__*/_jsxs("button", {
            onClick: () => {
              setSelectedBranch(branch.id);
              setIsChangingBranch(false);
            },
            className: `branch-card ${selectedBranch === branch.id ? "branch-card-active" : ""}`,
            children: [/*#__PURE__*/_jsx("span", {
              className: "grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600",
              children: /*#__PURE__*/_jsx(Icon, {
                name: "home",
                size: 18
              })
            }), /*#__PURE__*/_jsxs("span", {
              className: "min-w-0 flex-1 text-left",
              children: [/*#__PURE__*/_jsx("strong", {
                children: branch.name
              }), /*#__PURE__*/_jsx("small", {
                children: branch.address
              }), /*#__PURE__*/_jsx("em", {
                children: branch.time
              })]
            }), /*#__PURE__*/_jsx("span", {
              className: "branch-radio",
              children: selectedBranch === branch.id ? "✓" : ""
            })]
          }, branch.id)).concat(selectedBranchInfo && !isChangingBranch ? [/*#__PURE__*/_jsx("button", {
            type: "button",
            onClick: () => setIsChangingBranch(true),
            className: "w-full text-left text-sm font-semibold text-orange-600",
            children: "Bấm vào đổi chi nhánh lấy"
          }, "change-branch")] : [])
        })
      }), fulfillmentType === "delivery" ? null : /*#__PURE__*/_jsx(CheckoutCard, {
        title: "Thời gian đến lấy",
        children: /*#__PURE__*/_jsxs("div", {
          className: "pickup-time-card",
          children: [/*#__PURE__*/_jsxs("div", {
            className: "pickup-mode-tabs",
            children: [/*#__PURE__*/_jsx("button", {
              onClick: () => setPickupMode("soon"),
              className: pickupMode === "soon" ? "active" : "",
              children: "Sớm nhất"
            }), /*#__PURE__*/_jsx("button", {
              onClick: () => setPickupMode("schedule"),
              className: pickupMode === "schedule" ? "active" : "",
              children: "Chọn giờ"
            })]
          }), pickupMode === "soon" ? /*#__PURE__*/_jsxs("div", {
            className: "pickup-soon",
            children: [/*#__PURE__*/_jsx("strong", {
              children: "Sẵn sàng sau khoảng 20 phút"
            }), /*#__PURE__*/_jsx("span", {
              children: "Quán sẽ nhắn khi món đã chuẩn bị xong."
            })]
          }) : /*#__PURE__*/_jsxs("div", {
            className: "grid grid-cols-2 gap-3",
            children: [/*#__PURE__*/_jsxs("label", {
              className: "pickup-field",
              children: [/*#__PURE__*/_jsx("span", {
                children: "Ngày lấy"
              }), /*#__PURE__*/_jsx("input", {
                type: "date",
                value: pickupDate,
                onChange: event => setPickupDate(event.target.value)
              })]
            }), /*#__PURE__*/_jsxs("label", {
              className: "pickup-field",
              children: [/*#__PURE__*/_jsx("span", {
                children: "Giờ lấy"
              }), /*#__PURE__*/_jsx("input", {
                type: "time",
                value: pickupClock,
                onChange: event => setPickupClock(event.target.value)
              })]
            })]
          })]
        })
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
      }), /*#__PURE__*/_jsx(CheckoutMilestoneSuggest, {
        subtotal: subtotal,
        addToCart: addToCart,
        openOptionModal: openOptionModal,
        products: products,
        toppings: toppings,
        coupons: coupons,
        smartPromotions: smartPromotions
      }), /*#__PURE__*/_jsx(CheckoutCard, {
        title: "Khuyến mãi",
        children: /*#__PURE__*/_jsxs("button", {
          onClick: () => setIsPromoModalOpen(true),
          className: "promo-select",
          children: [selectedPromo ? `${selectedPromo.code} · -${formatMoney(selectedPromo.discount)}` : "Chọn mã khuyến mãi", " ", /*#__PURE__*/_jsx("span", {
            children: "›"
          })]
        })
      }), /*#__PURE__*/_jsx(CheckoutCard, {
        title: "Dùng điểm thưởng",
        children: /*#__PURE__*/_jsxs("div", {
          className: "points-row",
          children: [/*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsxs("strong", {
              children: ["Bạn có ", availablePoints.toLocaleString("vi-VN"), " điểm"]
            }), /*#__PURE__*/_jsx("span", {
              children: usePoints ? `Đã áp dụng -${formatMoney(pointsDiscount)} vào đơn hàng` : `Bạn sẽ nhận được +${earnedPreviewPoints} điểm khi đặt đơn`
            })]
          }), /*#__PURE__*/_jsx("input", {
            type: "checkbox",
            checked: usePoints,
            onChange: event => setUsePoints(event.target.checked),
            className: "toggle-input"
          })]
        })
      }), /*#__PURE__*/_jsx(CheckoutCard, {
        title: "Phương thức thanh toán",
        children: /*#__PURE__*/_jsxs("button", {
          className: "payment-card active",
          children: [/*#__PURE__*/_jsx(Icon, {
            name: "bag",
            size: 18
          }), /*#__PURE__*/_jsxs("span", {
            children: [/*#__PURE__*/_jsx("strong", {
              children: "Tiền mặt (COD)"
            }), /*#__PURE__*/_jsx("small", {
              children: "Thanh toán khi nhận hàng"
            })]
          })]
        })
      }), /*#__PURE__*/_jsx(CheckoutTotalCard, {
        subtotal: subtotal,
        originalSubtotal: originalSubtotal,
        giftSavingAmount: giftSavingAmount,
        ship: checkoutShip,
        originalShip: baseCheckoutShip,
        shippingSupportDiscount: autoShipSupport,
        shippingSupportMax: configSupportLimit,
        customerExtraShip: customerExtraShip,
        supportShippingEnabled: Boolean(shippingConfig.supportShippingEnabled),
        total: checkoutTotal,
        count: cart.reduce((sum, item) => sum + item.quantity, 0),
        promoDiscount: promoDiscount,
        promoCode: selectedPromo?.code,
        pointsDiscount: pointsDiscount,
        fulfillmentType: fulfillmentType,
        distanceKm: deliveryDistanceKm,
        onShowDeliveryFee: () => setIsDeliveryFeeModalOpen(true)
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "checkout-sticky-cta",
      children: /*#__PURE__*/_jsxs("button", {
        onClick: handleCheckoutPlaceOrder,
        className: "cta w-full",
        children: ["Đặt hàng - ", formatMoney(checkoutTotal)]
      })
    }), isPromoModalOpen && /*#__PURE__*/_jsx(PromoModal, {
      promos: promoCodes,
      selectedPromo: selectedPromo,
      onSelect: promo => {
        setSelectedPromo(selectedPromo?.id === promo.id ? null : promo);
        setIsPromoModalOpen(false);
      },
      onClose: () => setIsPromoModalOpen(false)
    }), isAddressModalOpen && /*#__PURE__*/_jsx(AddressModal, {
      value: deliveryInfo,
      addresses: demoAddresses,
      subtotal: subtotal,
      deliveryBranches: deliveryEligibleBranches,
      selectedDeliveryBranchId: selectedDeliveryBranchId,
      onSelectDeliveryBranch: setSelectedDeliveryBranchId,
      onSelectAddress: handleSelectAddress,
      onClose: () => setIsAddressModalOpen(false),
      deliveryOrigin: deliveryOrigin,
      onSave: nextInfo => {
        handleSaveAddress(nextInfo);
        setIsAddressModalOpen(false);
      }
    }), isDeliveryFeeModalOpen && /*#__PURE__*/_jsx(DeliveryFeeModal, {
      zones: shippingZonesFromConfig.length ? shippingZonesFromConfig : deliveryZones,
      fulfillmentType: fulfillmentType,
      distanceKm: deliveryDistanceKm,
      deliveryFee: baseCheckoutShip,
      source: shippingConfig.customerNote ? `${deliveryFeeSource} • ${deliverySourceBranch?.name || "Chi nhánh 1"} • ${shippingConfig.customerNote}` : `${deliveryFeeSource} • ${deliverySourceBranch?.name || "Chi nhánh 1"}`,
      onClose: () => setIsDeliveryFeeModalOpen(false)
    }), /*#__PURE__*/_jsx(CheckoutNoticeModal, {
      notice: checkoutNotice,
      onClose: () => setCheckoutNotice(null)
    })]
  });
}


