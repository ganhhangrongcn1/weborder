import { useEffect, useMemo, useState } from "react";
import "../../../styles/customer.css";
import BottomNav from "../../../components/BottomNav.jsx";
import StoreStatusModal from "../../../components/customer/StoreStatusModal.jsx";
import ActiveOrderJourneySheet from "../../../components/customer/ActiveOrderJourneySheet.jsx";
import ActiveOrderFloatboard from "../../../components/customer/ActiveOrderFloatboard.jsx";
import CustomerOptionModal from "../../../components/customer/OptionModal.jsx";
import CustomerFloatingCartBar from "../../../components/customer/FloatingCartBar.jsx";
import CustomerToast from "../../../components/customer/Toast.jsx";
import PwaInstallBanner from "../../../components/customer/PwaInstallBanner.jsx";
import QrCounterGuideModal from "../../../components/customer/QrCounterGuideModal.jsx";
import { CustomerLoadingState } from "../../../components/customer/CustomerUI.jsx";
import HomePage from "../home/HomePage.jsx";
import MenuPage from "./MenuPage.jsx";
import ProductDetailPage from "./ProductDetailPage.jsx";
import CheckoutPage from "../checkout/CheckoutPage.jsx";
import SuccessPage from "./SuccessPage.jsx";
import TrackingPage from "../tracking/TrackingPage.jsx";
import LoyaltyPage from "../loyalty/LoyaltyPage.jsx";
import AccountPage from "../account/AccountPage.jsx";
import QrOrderEntryPage from "../../../pages/customer/qr/QrOrderEntryPage.jsx";
import QrMiniHomePage from "../../../pages/customer/qr/QrMiniHomePage.jsx";
import useActiveOrderFloatboard from "../../../hooks/useActiveOrderFloatboard.js";
import useMomoReturnRecovery from "../../../hooks/useMomoReturnRecovery.js";
import { orderRepository } from "../../../services/repositories/orderRepository.js";
import { resolveBranchFromCandidates } from "../../../services/branchIdentityService.js";
import {
  findLatestActiveCustomerOrder,
  getCustomerOrderJourneySignature
} from "../../../services/customerOrderStatusService.js";

const qrMemberPromptSessionKeys = new Set();
const ORDER_DETAIL_INTENT_KEY = "ghr_open_order_detail_intent";

function resolveQrLockedBranch(branches = [], checkoutPreset = {}) {
  const key = String(checkoutPreset?.qrBranchId || checkoutPreset?.selectedBranch || "").trim().toLowerCase();
  if (!key) return null;
  return resolveBranchFromCandidates([key], branches);
}

export default function CustomerShell({
  page,
  pageProps,
  activeTab,
  handleBottomNav,
  openOptionModalFromHome,
  openCartItemEditor,
  currentOrder,
  branches,
  composedUserProfile,
  currentPhone,
  reorderOrder,
  setUserProfile,
  profileLoyalty,
  saveDemoLoyalty,
  subtotal,
  isRegisteredCustomer,
  hasCustomerAuthSession,
  requiresCustomerAuthSession,
  activeDemoUser,
  saveDemoUser,
  loginOrRegisterByPhone,
  logoutDemoUser,
  demoAddresses,
  saveDemoAddresses,
  profileOrders,
  isOrdersLoading,
  hasFetchedOrdersOnce,
  isSessionRestoring,
  isSessionBootstrapping,
  isOptionModalOpen,
  selectedProduct,
  selectedSpice,
  setSelectedSpice,
  selectedToppings,
  setSelectedToppings,
  storeToppings,
  note,
  setNote,
  quantity,
  setQuantity,
  closeOptionModal,
  optionModalText,
  spiceLevels,
  normalizeOrderOption,
  closeOnlyOnBackdrop,
  OptionGroup,
  editingCartId,
  addToCart,
  cartCount,
  navigate,
  formatMoney,
  toastVisible,
  serviceNotice,
  setServiceNotice,
  getStoreBlockNotice
}) {
  const isQrRoute = typeof window !== "undefined" && /^\/qr\/[^/]+/i.test(window.location.pathname || "");
  const isQrCounterFlow = isQrRoute || (String(pageProps?.checkoutPreset?.orderSource || pageProps?.checkoutPreset?.source || "").toLowerCase() === "qr_counter" && Boolean(pageProps?.checkoutPreset?.qrBranchLocked));
  const qrAllowedPages = ["home", "qr-entry", "menu", "detail", "checkout", "tracking", "success", "loyalty", "account"];
  const qrBottomNavItems = [
    { id: "home", label: "Trang chủ", icon: "home" },
    { id: "menu", label: "Menu", icon: "dish" },
    { id: "orders", label: "Đơn hàng", icon: "bag" },
    { id: "rewards", label: "Ưu đãi", icon: "gift" },
    { id: "account", label: "Tài khoản", icon: "user" }
  ];
  const qrLockedBranch = useMemo(
    () => (isQrCounterFlow ? resolveQrLockedBranch(branches, pageProps?.checkoutPreset || {}) : null),
    [isQrCounterFlow, branches, pageProps?.checkoutPreset]
  );
  const qrMemberPromptKey = useMemo(
    () => `ghr_qr_member_prompt_v3_${String(qrLockedBranch?.id || pageProps?.checkoutPreset?.qrBranchId || "branch").trim() || "branch"}`,
    [pageProps?.checkoutPreset?.qrBranchId, qrLockedBranch?.id]
  );
  const [showQrMemberPrompt, setShowQrMemberPrompt] = useState(false);
  const [journeyOrder, setJourneyOrder] = useState(null);
  const [isJourneyOpen, setIsJourneyOpen] = useState(false);
  const [isTrackingOrderSheetOpen, setIsTrackingOrderSheetOpen] = useState(false);
  const {
    order: recoveredMomoOrder,
    isRecovering: isMomoReturnRecovering
  } = useMomoReturnRecovery({ enabled: page === "success" });
  const resolvedCurrentOrder = recoveredMomoOrder || currentOrder;

  const lastCreatedOrderId = orderRepository.getLastCreatedOrderId();
  const forcedLatestOrder = (Array.isArray(profileOrders) ? profileOrders : []).find((order) => {
    const id = String(order?.id || order?.orderCode || "").trim();
    return Boolean(lastCreatedOrderId) && id === lastCreatedOrderId;
  }) || (String(resolvedCurrentOrder?.id || resolvedCurrentOrder?.orderCode || "").trim() === lastCreatedOrderId ? resolvedCurrentOrder : null);
  const latestProfileOrder = Array.isArray(profileOrders) && profileOrders.length ? profileOrders[0] : null;
  const currentOrderTime = new Date(resolvedCurrentOrder?.createdAt || 0).getTime();
  const latestProfileOrderTime = new Date(latestProfileOrder?.createdAt || 0).getTime();
  const successOrder = recoveredMomoOrder || forcedLatestOrder || (latestProfileOrderTime > currentOrderTime ? latestProfileOrder : (resolvedCurrentOrder || latestProfileOrder));
  const customerOrdersForJourney = useMemo(
    () => [
      ...(resolvedCurrentOrder ? [resolvedCurrentOrder] : []),
      ...(Array.isArray(profileOrders) ? profileOrders : [])
    ],
    [profileOrders, resolvedCurrentOrder]
  );
  const activeCustomerOrder = useMemo(
    () => findLatestActiveCustomerOrder(customerOrdersForJourney),
    [customerOrdersForJourney]
  );
  const activeOrderJourneySignature = activeCustomerOrder
    ? getCustomerOrderJourneySignature(activeCustomerOrder)
    : "";
  const {
    isCollapsed: isActiveOrderFloatboardCollapsed,
    hasUnreadUpdate: hasActiveOrderUpdate,
    collapse: collapseActiveOrderFloatboard,
    expand: expandActiveOrderFloatboard
  } = useActiveOrderFloatboard(activeCustomerOrder, activeOrderJourneySignature);
  const isChoosingProduct = isOptionModalOpen || page === "detail";
  const shouldHideBottomNav = isChoosingProduct || ["success", "qr-entry"].includes(page);
  const shouldBlockSessionPage = isSessionBootstrapping && ["tracking", "loyalty", "account"].includes(page);

  const trackingOrderHistory = forcedLatestOrder
    ? [forcedLatestOrder, ...(Array.isArray(composedUserProfile?.orderHistory) ? composedUserProfile.orderHistory : []).filter((order) => {
      const id = String(order?.id || order?.orderCode || "").trim();
      return id !== String(forcedLatestOrder?.id || forcedLatestOrder?.orderCode || "").trim();
    })]
    : (Array.isArray(composedUserProfile?.orderHistory) ? composedUserProfile.orderHistory : []);

  const trackingUserProfile = {
    ...composedUserProfile,
    orderHistory: trackingOrderHistory
  };

  useEffect(() => {
    if (!isJourneyOpen || !journeyOrder) return;
    const journeyOrderId = String(journeyOrder.id || journeyOrder.orderCode || journeyOrder.order_code || "").trim();
    const refreshedOrder = [...customerOrdersForJourney].reverse().find((order) => (
      String(order?.id || order?.orderCode || order?.order_code || "").trim() === journeyOrderId
    ));
    if (!refreshedOrder) return;
    if (getCustomerOrderJourneySignature(refreshedOrder) === getCustomerOrderJourneySignature(journeyOrder)) return;
    setJourneyOrder(refreshedOrder);
  }, [customerOrdersForJourney, isJourneyOpen, journeyOrder]);

  useEffect(() => {
    if (!isQrCounterFlow) return;
    if (qrAllowedPages.includes(page)) return;
    navigate("menu", "menu");
  }, [isQrCounterFlow, page, navigate]);

  useEffect(() => {
    if (!isQrCounterFlow || !qrLockedBranch || page !== "qr-entry") return;
    navigate("menu", "menu");
  }, [isQrCounterFlow, navigate, page, qrLockedBranch]);

  useEffect(() => {
    if (
      !isQrCounterFlow ||
      !qrLockedBranch ||
      isChoosingProduct ||
      !["home", "qr-entry"].includes(page) ||
      cartCount > 0 ||
      activeCustomerOrder
    ) {
      setShowQrMemberPrompt(false);
      return;
    }

    if (page === "success") {
      setShowQrMemberPrompt(false);
      return;
    }

    if (qrMemberPromptSessionKeys.has(qrMemberPromptKey)) return;

    const timer = window.setTimeout(() => setShowQrMemberPrompt(true), page === "qr-entry" ? 420 : 760);
    return () => window.clearTimeout(timer);
  }, [activeCustomerOrder, cartCount, hasCustomerAuthSession, isChoosingProduct, isQrCounterFlow, isRegisteredCustomer, page, qrLockedBranch, qrMemberPromptKey]);

  const dismissQrMemberPrompt = () => {
    qrMemberPromptSessionKeys.add(qrMemberPromptKey);
    setShowQrMemberPrompt(false);
  };

  const handleOpenCheckout = () => {
    const notice = getStoreBlockNotice?.();
    if (notice) {
      setServiceNotice?.(notice);
      return;
    }
    navigate("checkout", "orders");
  };

  const closeOrderJourney = () => {
    setIsJourneyOpen(false);
  };

  const openActiveOrderJourney = () => {
    if (!activeCustomerOrder) return;
    setJourneyOrder(activeCustomerOrder);
    setIsJourneyOpen(true);
  };

  const openOrdersFromJourney = () => {
    const orderId = String(journeyOrder?.id || journeyOrder?.orderCode || journeyOrder?.order_code || "").trim();
    if (typeof window !== "undefined" && orderId) {
      const intent = { orderId, showDetails: true };
      try {
        window.sessionStorage.setItem(ORDER_DETAIL_INTENT_KEY, JSON.stringify(intent));
      } catch {
      }
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("ghr:open-order-detail", { detail: intent }));
      }, 0);
    }
    setIsJourneyOpen(false);
    if (page !== "tracking") navigate("tracking", "orders");
  };

  const handleQrBottomNav = (tab) => {
    if (tab === "home") {
      navigate("home", "home");
      return;
    }
    if (tab === "menu") {
      navigate("menu", "menu");
      return;
    }
    if (tab === "orders") {
      navigate("tracking", "orders");
      return;
    }
    if (tab === "rewards") {
      navigate("loyalty", "rewards");
      return;
    }
    if (tab === "account") {
      navigate("account", "account");
    }
  };

  const handleQrMemberPromptSignup = () => {
    dismissQrMemberPrompt();
    navigate("account", "account");
  };

  const shouldShowQrSignupAction = !isRegisteredCustomer && !hasCustomerAuthSession;

  return (
    <div className="customer-shell min-h-screen bg-app text-brown">
      <main className="mx-auto min-h-screen w-full max-w-[430px] bg-cream pb-24 shadow-preview">
        {!isQrCounterFlow && <PwaInstallBanner />}
        {shouldBlockSessionPage ? (
          <section className="px-4 pt-6">
            <CustomerLoadingState message="Đang đồng bộ tài khoản và lịch sử đơn hàng..." />
          </section>
        ) : (
          <>
            <div key={page} className="customer-page-stage">
              {page === "home" && (
                isQrCounterFlow
                  ? <QrMiniHomePage {...pageProps} isRegisteredCustomer={isRegisteredCustomer} />
                  : <HomePage render={pageProps.Home} {...pageProps} coupons={pageProps.homeCoupons || pageProps.coupons} smartPromotions={pageProps.homeSmartPromotions || pageProps.smartPromotions} openProduct={openOptionModalFromHome} openOptionModal={openOptionModalFromHome} />
              )}
              {page === "qr-entry" && <QrOrderEntryPage branches={pageProps.branches} checkoutPreset={pageProps.checkoutPreset} setCheckoutPreset={pageProps.setCheckoutPreset} navigate={pageProps.navigate} isBranchOpenNow={pageProps.isBranchOpenNow} buildOutOfHoursNotice={pageProps.buildOutOfHoursNotice} setServiceNotice={pageProps.setServiceNotice} />}
              {page === "menu" && <MenuPage render={pageProps.Menu} {...pageProps} />}
              {page === "detail" && <ProductDetailPage render={pageProps.Detail} {...pageProps} />}
              {page === "checkout" && <CheckoutPage render={pageProps.Checkout} {...pageProps} coupons={pageProps.checkoutCoupons || pageProps.coupons} smartPromotions={pageProps.checkoutSmartPromotions || pageProps.smartPromotions} openCartItemEditor={openCartItemEditor} />}
              {page === "success" && <SuccessPage render={pageProps.Success} navigate={pageProps.navigate} order={successOrder} isRegisteredCustomer={isRegisteredCustomer} currentPhone={currentPhone} branches={pageProps.branches} isOrderRestoring={isSessionRestoring || isSessionBootstrapping || isMomoReturnRecovering} />}
              {page === "tracking" && <TrackingPage render={pageProps.Tracking} {...pageProps} navigate={pageProps.navigate} userProfile={trackingUserProfile} currentOrder={successOrder} currentPhone={currentPhone} onReorder={reorderOrder} isOrdersLoading={isOrdersLoading} hasFetchedOrdersOnce={hasFetchedOrdersOnce} isSessionRestoring={isSessionRestoring} onOrderSheetVisibilityChange={setIsTrackingOrderSheetOpen} />}
              {page === "loyalty" && <LoyaltyPage render={pageProps.Loyalty} navigate={pageProps.navigate} userProfile={composedUserProfile} setUserProfile={setUserProfile} demoLoyalty={profileLoyalty} setDemoLoyalty={pageProps.setDemoLoyaltyState || pageProps.setDemoLoyalty || saveDemoLoyalty} subtotal={subtotal} isRegisteredCustomer={isRegisteredCustomer} hasCustomerAuthSession={hasCustomerAuthSession} requiresCustomerAuthSession={requiresCustomerAuthSession} currentPhone={currentPhone} />}
              {page === "account" && <AccountPage render={pageProps.Account} {...pageProps} navigate={pageProps.navigate} userProfile={composedUserProfile} demoUser={activeDemoUser} setDemoUser={saveDemoUser} currentPhone={currentPhone} isRegisteredCustomer={isRegisteredCustomer} loginOrRegisterByPhone={loginOrRegisterByPhone} logoutDemoUser={logoutDemoUser} demoAddresses={demoAddresses} setDemoAddresses={saveDemoAddresses} demoLoyalty={profileLoyalty} demoOrders={profileOrders} />}
            </div>

            {isOptionModalOpen && (
              <CustomerOptionModal
                product={selectedProduct}
                selectedSpice={selectedSpice}
                setSelectedSpice={setSelectedSpice}
                selectedToppings={selectedToppings}
                setSelectedToppings={setSelectedToppings}
                toppings={storeToppings}
                note={note}
                setNote={setNote}
                quantity={quantity}
                setQuantity={setQuantity}
                onClose={closeOptionModal}
                optionModalText={optionModalText}
                spiceLevels={spiceLevels}
                normalizeOrderOption={normalizeOrderOption}
                closeOnlyOnBackdrop={closeOnlyOnBackdrop}
                OptionGroup={OptionGroup}
                submitLabel={editingCartId ? optionModalText.updateItem : optionModalText.addToCart}
                onAdd={() => {
                  const toppingTotal = selectedToppings.reduce((sum, topping) => sum + topping.price, 0);
                  addToCart({
                    product: selectedProduct,
                    spice: selectedSpice,
                    toppings: selectedToppings,
                    note,
                    quantity,
                    finalPrice: (selectedProduct.price + toppingTotal) * quantity
                  });
                  closeOptionModal();
                }}
              />
            )}

            {activeCustomerOrder && !isJourneyOpen && !isTrackingOrderSheetOpen && !isChoosingProduct && !["checkout", "success", "qr-entry"].includes(page) ? (
              <ActiveOrderFloatboard
                key={activeOrderJourneySignature}
                order={activeCustomerOrder}
                raised={cartCount > 0}
                collapsed={isActiveOrderFloatboardCollapsed}
                hasUnreadUpdate={hasActiveOrderUpdate}
                onCollapse={collapseActiveOrderFloatboard}
                onExpand={expandActiveOrderFloatboard}
                onOpenJourney={openActiveOrderJourney}
              />
            ) : null}

            {cartCount > 0 && !isChoosingProduct && !["checkout", "success"].includes(page) && (
              <CustomerFloatingCartBar
                count={cartCount}
                subtotal={subtotal}
                onClick={handleOpenCheckout}
                formatMoney={formatMoney}
                products={pageProps.products}
                smartPromotions={pageProps.checkoutSmartPromotions || pageProps.smartPromotions}
              />
            )}

            {toastVisible && <CustomerToast message="Đã thêm vào giỏ" />}
            <QrCounterGuideModal
              open={showQrMemberPrompt}
              showSignupAction={shouldShowQrSignupAction}
              onClose={dismissQrMemberPrompt}
              onSignup={handleQrMemberPromptSignup}
              onStart={dismissQrMemberPrompt}
            />
            {!shouldHideBottomNav && (
              isQrCounterFlow
                ? <BottomNav activeTab={activeTab} onChange={handleQrBottomNav} items={qrBottomNavItems} />
                : <BottomNav activeTab={activeTab} onChange={handleBottomNav} />
            )}
            {isJourneyOpen && journeyOrder && !serviceNotice ? (
              <ActiveOrderJourneySheet
                order={journeyOrder}
                onClose={closeOrderJourney}
                onOpenOrders={openOrdersFromJourney}
              />
            ) : null}
            <StoreStatusModal notice={serviceNotice} onClose={() => setServiceNotice?.(null)} />
          </>
        )}
      </main>
    </div>
  );
}
