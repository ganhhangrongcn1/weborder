import { useCallback, useState } from "react";
import CheckoutContainer from "../customer/checkout/CheckoutContainer.jsx";
import Checkout from "../checkout/CheckoutView.jsx";
import Success from "../orders/OrderSuccessView.jsx";
import Tracking from "../orders/TrackingView.jsx";
import Loyalty from "../loyalty/LoyaltyView.jsx";
import AccountContainer from "../customer/account/AccountContainer.jsx";
import TrackingContainer from "../customer/tracking/TrackingContainer.jsx";
import ProductDetailModal from "../../pages/customer/product/ProductDetailModal.jsx";
import OptionGroup from "../../components/customer/OptionGroup.jsx";
import { createNavigationActions } from "./navigationActions.js";
import { getCustomerKey } from "../../services/storageService.js";
import { addressStorage, addAddress, updateAddress, setDefaultAddress } from "../../services/addressService.js";
import { orderStorage, reorder } from "../../services/orderService.js";
import { loyaltyStorage, loyaltyByPhoneStorage, defaultLoyaltyData, reconcileLoyaltyFromOrders } from "../../services/loyaltyService.js";
import { createUserStorage, isRegisteredUser, getCurrentRegisteredPhone } from "../../services/customerService.js";
import { getMemberRank, normalizeUserProfile } from "../../utils/profile.js";
import { closeOnlyOnBackdrop } from "../../utils/uiEvents.js";
import { getOrderStats, normalizeOrderOption, getDefaultOrderChoices } from "../../utils/pureHelpers.js";
import { spiceLevels, deliveryFee, discount, freeshipMinSubtotal, defaultDeliveryZones } from "../../constants/storeConfig.js";
import { defaultUserDemo } from "../../data/defaultData.js";
import { optionModalText } from "../../data/uiText.js";
import { formatMoney } from "../../utils/format.js";
import { makeCartItem } from "../cart/cartItemFactory.js";
import Home from "../home/HomeView.jsx";
import Menu from "../menu/MenuView.jsx";
import Account from "../account/AccountView.jsx";
import { customerPathToState } from "../../app/routeState.js";
import useStoreAvailability from "../../hooks/useStoreAvailability.js";
import useCustomerSession from "../../hooks/useCustomerSession.js";
import useCart from "../../hooks/useCart.js";

const userStorage = createUserStorage({
  getCustomerKey,
  defaultUserDemo
});

export function getUserStorage() {
  return userStorage;
}

export default function useCustomerRuntimeState({ domainState, demoData, onRouteChange, sessionEnabled = true }) {
  const { uiState, productState, coreState } = domainState;
  const [serviceNotice, setServiceNotice] = useState(null);
  const applyRouteChange = (nextPath) => {
    if (!nextPath) return;
    if (window.location.pathname === nextPath) return;
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const {
    getStoreBlockNotice,
    isBranchOpenNow,
    buildStoreOfflineNotice,
    buildDeliveryDisabledNotice,
    buildPickupDisabledNotice,
    buildOutOfHoursNotice
  } = useStoreAvailability(productState.branches);

  const {
    navigate,
    openProduct,
    openOptionModal,
    openOptionModalFromHome,
    openCartItemEditor,
    closeOptionModal,
    handleBottomNav
  } = createNavigationActions({
    setPage: uiState.setPage,
    setActiveTab: uiState.setActiveTab,
    setSelectedProduct: uiState.setSelectedProduct,
    setSelectedSpice: uiState.setSelectedSpice,
    setSelectedToppings: uiState.setSelectedToppings,
    setQuantity: uiState.setQuantity,
    setEditingCartId: uiState.setEditingCartId,
    setNote: uiState.setNote,
    setIsOptionModalOpen: uiState.setIsOptionModalOpen,
    storeProducts: productState.customerProducts,
    spiceLevels,
    storeToppings: productState.storeToppings,
    getDefaultOrderChoices,
    getStoreBlockNotice,
    onStoreBlocked: setServiceNotice,
    onRouteChange: onRouteChange || applyRouteChange
  });

  const {
    currentPhone,
    demoAddresses,
    demoOrders,
    isOrdersLoading,
    hasFetchedOrdersOnce,
    isSessionRestoring,
    isSessionBootstrapping,
    saveDemoUser,
    saveDemoAddresses,
    saveDemoLoyalty,
    saveDemoOrders,
    loginOrRegisterByPhone,
    logoutDemoUser,
    isRegisteredCustomer,
    activeDemoUser,
    profileOrders,
    profileLoyalty,
    composedUserProfile,
    setDemoOrdersState,
    setDemoLoyaltyState,
    setDemoAddressesState
  } = useCustomerSession({
    enabled: sessionEnabled,
    ordersRealtimeEnabled: uiState.page === "tracking",
    forceRefreshOrdersOnTracking: uiState.page === "tracking",
    demoData,
    getCurrentRegisteredPhone: () => getCurrentRegisteredPhone({ userStorage }),
    normalizeUserProfile,
    userStorage,
    getCustomerKey,
    orderStorage,
    reconcileLoyaltyFromOrders,
    loyaltyByPhoneStorage,
    loyaltyStorage,
    addressStorage,
    setCurrentOrder: coreState.setCurrentOrder,
    defaultUserDemo,
    defaultLoyaltyData,
    navigate,
    userProfile: coreState.userProfile,
    getOrderStats,
    getMemberRank
  });

  const {
    cart,
    setCart,
    subtotal,
    ship,
    total,
    cartCount,
    addToCart,
    reorderOrder
  } = useCart({
    makeCartItem,
    initialCart: [],
    selectedProduct: uiState.selectedProduct,
    selectedSpice: uiState.selectedSpice,
    selectedToppings: uiState.selectedToppings,
    quantity: uiState.quantity,
    editingCartId: uiState.editingCartId,
    setEditingCartId: uiState.setEditingCartId,
    setToastVisible: uiState.setToastVisible,
    toastTimer: uiState.toastTimer,
    deliveryFee,
    freeshipMinSubtotal,
    discount,
    reorder,
    navigate,
    catalogProducts: productState.storeProducts
  });

  const effectiveDeliveryZones = productState.deliveryZones.some((zone) => zone.includes("49.000") || zone.includes("3-6km"))
    ? defaultDeliveryZones
    : productState.deliveryZones;

  const hasRegisteredAccountByPhone = (phone) => Boolean(phone && isRegisteredUser(userStorage.findByPhone(phone)));

  const customerRouteProps = {
    cart,
    userProfile: coreState.userProfile,
    currentPhone,
    setDemoOrdersState,
    loyaltyByPhoneStorage,
    setDemoLoyaltyState,
    addressStorage,
    updateAddress,
    addAddress,
    setDefaultAddress,
    setDemoAddressesState,
    setUserProfile: coreState.setUserProfile,
    getMemberRank,
    setCurrentOrder: coreState.setCurrentOrder,
    setOrderStatus: coreState.setOrderStatus,
    setCart,
    saveDemoOrders,
    demoOrders,
    navigate,
    activeCategory: uiState.activeCategory,
    setActiveCategory: uiState.setActiveCategory,
    customerCategories: productState.customerCategories,
    filteredProducts: productState.filteredProducts,
    customerProducts: productState.customerProducts,
    storeToppings: productState.storeToppings,
    customerPromoCards: productState.customerPromoCards,
    adminCoupons: productState.adminCoupons,
    smartPromotions: productState.smartPromotions,
    homeContent: productState.homeContent,
    openProduct,
    addToCart,
    openOptionModal,
    selectedProduct: uiState.selectedProduct,
    selectedSpice: uiState.selectedSpice,
    setSelectedSpice: uiState.setSelectedSpice,
    selectedToppings: uiState.selectedToppings,
    setSelectedToppings: uiState.setSelectedToppings,
    note: uiState.note,
    setNote: uiState.setNote,
    quantity: uiState.quantity,
    setQuantity: uiState.setQuantity,
    composedUserProfile,
    activeDemoUser,
    saveDemoUser,
    loginOrRegisterByPhone,
    isRegisteredCustomer,
    logoutDemoUser,
    demoAddresses,
    saveDemoAddresses,
    profileLoyalty,
    saveDemoLoyalty,
    profileOrders,
    isOrdersLoading,
    hasFetchedOrdersOnce,
    isSessionRestoring,
    isSessionBootstrapping,
    orderStatus: coreState.orderStatus,
    subtotal,
    ship,
    total,
    effectiveDeliveryZones,
    branches: productState.branches,
    checkoutPreset: coreState.checkoutPreset,
    setCheckoutPreset: coreState.setCheckoutPreset,
    hasRegisteredAccountByPhone,
    serviceNotice,
    setServiceNotice,
    getStoreBlockNotice,
    isBranchOpenNow,
    buildStoreOfflineNotice,
    buildDeliveryDisabledNotice,
    buildPickupDisabledNotice,
    buildOutOfHoursNotice,
    page: uiState.page,
    Home,
    Menu,
    ProductDetailModal,
    CheckoutContainer,
    Checkout,
    Success,
    TrackingContainer,
    Tracking,
    Loyalty,
    AccountContainer,
    Account,
    activeTab: uiState.activeTab,
    handleBottomNav,
    openOptionModalFromHome,
    openCartItemEditor,
    currentOrder: coreState.currentOrder,
    confirmCurrentOrder: null,
    reorderOrder,
    optionModalText,
    spiceLevels,
    normalizeOrderOption,
    closeOnlyOnBackdrop,
    OptionGroup,
    isOptionModalOpen: uiState.isOptionModalOpen,
    closeOptionModal,
    editingCartId: uiState.editingCartId,
    cartCount,
    formatMoney,
    toastVisible: uiState.toastVisible
  };

  customerRouteProps.syncRouteState = useCallback((pathname) => {
    const next = customerPathToState(pathname);
    uiState.setPage(next.page);
    uiState.setActiveTab(next.activeTab);
  }, [uiState.setActiveTab, uiState.setPage]);

  return {
    customerRouteProps,
    orderStorage
  };
}
