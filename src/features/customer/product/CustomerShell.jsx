import { useEffect, useMemo, useState } from "react";
import "../../../styles/customer.css";
import Icon from "../../../components/Icon.jsx";
import BottomNav from "../../../components/BottomNav.jsx";
import StoreStatusModal from "../../../components/customer/StoreStatusModal.jsx";
import CustomerOptionModal from "../../../components/customer/OptionModal.jsx";
import CustomerFloatingCartBar from "../../../components/customer/FloatingCartBar.jsx";
import CustomerToast from "../../../components/customer/Toast.jsx";
import PwaInstallBanner from "../../../components/customer/PwaInstallBanner.jsx";
import { CustomerButton, CustomerLoadingState, CustomerModalFrame } from "../../../components/customer/CustomerUI.jsx";
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
import { orderRepository } from "../../../services/repositories/orderRepository.js";
import { resolveBranchFromCandidates } from "../../../services/branchIdentityService.js";

const orderStatusPopupPersistedKeys = new Set();
const qrMemberPromptSessionKeys = new Set();

function normalizeOrderStatusText(value = "") {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "");
}

function hasPersistedOrderStatusPopup(key = "") {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return false;
  if (orderStatusPopupPersistedKeys.has(normalizedKey)) return true;
  try {
    const stored = window.localStorage.getItem(normalizedKey);
    if (stored === "1") {
      orderStatusPopupPersistedKeys.add(normalizedKey);
      return true;
    }
  } catch {
  }
  return false;
}

function persistOrderStatusPopupSeen(key = "") {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return;
  orderStatusPopupPersistedKeys.add(normalizedKey);
  try {
    window.localStorage.setItem(normalizedKey, "1");
  } catch {
  }
}

function isWebsiteCustomerOrder(order = {}) {
  const sourceType = normalizeOrderStatusText(order.sourceType || order.source_type);
  return sourceType !== "partner";
}

function getOrderStatusPopupCandidate(order = {}, phone = "") {
  if (!order || !isWebsiteCustomerOrder(order)) return null;

  const status = normalizeOrderStatusText(order.status || order.orderStatus || order.order_status);
  const fulfillmentType = normalizeOrderStatusText(order.fulfillmentType || order.fulfillment_type);
  const source = normalizeOrderStatusText(order.source || order.channel || order.orderSource || order.platform);
  const orderId = String(order.id || order.orderCode || "").trim();
  const phoneKey = String(phone || order.phone || order.customerPhone || "").replace(/\D/g, "");
  if (!orderId || !phoneKey) return null;

  if (status === "readyforpickup" && (fulfillmentType === "pickup" || source === "qrcounter")) {
    return {
      key: `ghr_order_status_popup_${phoneKey}_${orderId}_ready_pickup`,
      notice: {
        type: "order_ready_pickup",
        badge: "Món đã xong",
        title: "Món của bạn đã sẵn sàng",
        description: `Đơn ${order.orderCode || orderId} đã chuẩn bị xong. Bạn có thể đến quầy để nhận món nhé.`
      }
    };
  }

  if (status === "delivering" && fulfillmentType === "delivery") {
    return {
      key: `ghr_order_status_popup_${phoneKey}_${orderId}_delivering`,
      notice: {
        type: "order_delivering",
        badge: "Đang giao",
        title: "Đơn hàng đang được giao",
        description: `Đơn ${order.orderCode || orderId} đã được giao cho shipper. Bạn để ý điện thoại để shipper liên hệ khi tới nơi nhé.`
      }
    };
  }

  return null;
}

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

  const lastCreatedOrderId = orderRepository.getLastCreatedOrderId();
  const forcedLatestOrder = (Array.isArray(profileOrders) ? profileOrders : []).find((order) => {
    const id = String(order?.id || order?.orderCode || "").trim();
    return Boolean(lastCreatedOrderId) && id === lastCreatedOrderId;
  }) || (String(currentOrder?.id || currentOrder?.orderCode || "").trim() === lastCreatedOrderId ? currentOrder : null);
  const latestProfileOrder = Array.isArray(profileOrders) && profileOrders.length ? profileOrders[0] : null;
  const currentOrderTime = new Date(currentOrder?.createdAt || 0).getTime();
  const latestProfileOrderTime = new Date(latestProfileOrder?.createdAt || 0).getTime();
  const successOrder = forcedLatestOrder || (latestProfileOrderTime > currentOrderTime ? latestProfileOrder : (currentOrder || latestProfileOrder));
  const isChoosingProduct = isOptionModalOpen || page === "detail";
  const shouldHideBottomNav = isChoosingProduct || page === "success" || page === "qr-entry";

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
    if (serviceNotice) return;
    const orders = [
      ...(Array.isArray(profileOrders) ? profileOrders : []),
      ...(currentOrder ? [currentOrder] : [])
    ];
    const seenOrderIds = new Set();
    const uniqueOrders = orders.filter((order) => {
      const id = String(order?.id || order?.orderCode || "").trim();
      if (!id || seenOrderIds.has(id)) return false;
      seenOrderIds.add(id);
      return true;
    });

    const candidate = uniqueOrders
      .map((order) => getOrderStatusPopupCandidate(order, currentPhone))
      .find((item) => item && !hasPersistedOrderStatusPopup(item.key));

    if (!candidate) return;
    persistOrderStatusPopupSeen(candidate.key);
    setServiceNotice?.(candidate.notice);
  }, [currentPhone, currentOrder, profileOrders, serviceNotice, setServiceNotice]);

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
    if (!isQrCounterFlow || !qrLockedBranch || isChoosingProduct) {
      setShowQrMemberPrompt(false);
      return;
    }

    if (page === "success") {
      setShowQrMemberPrompt(false);
      return;
    }

    if (qrMemberPromptSessionKeys.has(qrMemberPromptKey)) return;

    try {
      if (window.sessionStorage.getItem(qrMemberPromptKey) === "1") return;
    } catch {
    }

    const timer = window.setTimeout(() => setShowQrMemberPrompt(true), page === "qr-entry" ? 420 : 900);
    return () => window.clearTimeout(timer);
  }, [hasCustomerAuthSession, isChoosingProduct, isQrCounterFlow, isRegisteredCustomer, page, qrLockedBranch, qrMemberPromptKey]);

  const dismissQrMemberPrompt = () => {
    qrMemberPromptSessionKeys.add(qrMemberPromptKey);
    try {
      window.sessionStorage.setItem(qrMemberPromptKey, "1");
    } catch {
    }
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
        {isSessionBootstrapping ? (
          <section className="px-4 pt-6">
            <CustomerLoadingState message="Đang đồng bộ tài khoản và lịch sử đơn hàng..." />
          </section>
        ) : (
          <>
            {page === "home" && (
              isQrCounterFlow
                ? <QrMiniHomePage {...pageProps} isRegisteredCustomer={isRegisteredCustomer} />
                : <HomePage render={pageProps.Home} {...pageProps} coupons={pageProps.homeCoupons || pageProps.coupons} smartPromotions={pageProps.homeSmartPromotions || pageProps.smartPromotions} openProduct={openOptionModalFromHome} openOptionModal={openOptionModalFromHome} />
            )}
            {page === "qr-entry" && <QrOrderEntryPage branches={pageProps.branches} checkoutPreset={pageProps.checkoutPreset} setCheckoutPreset={pageProps.setCheckoutPreset} navigate={pageProps.navigate} isBranchOpenNow={pageProps.isBranchOpenNow} buildOutOfHoursNotice={pageProps.buildOutOfHoursNotice} setServiceNotice={pageProps.setServiceNotice} />}
            {page === "menu" && <MenuPage render={pageProps.Menu} {...pageProps} />}
            {page === "detail" && <ProductDetailPage render={pageProps.Detail} {...pageProps} />}
            {page === "checkout" && <CheckoutPage render={pageProps.Checkout} {...pageProps} coupons={pageProps.checkoutCoupons || pageProps.coupons} smartPromotions={pageProps.checkoutSmartPromotions || pageProps.smartPromotions} openCartItemEditor={openCartItemEditor} />}
            {page === "success" && <SuccessPage render={pageProps.Success} navigate={pageProps.navigate} order={successOrder} isRegisteredCustomer={isRegisteredCustomer} currentPhone={currentPhone} branches={pageProps.branches} />}
            {page === "tracking" && <TrackingPage render={pageProps.Tracking} {...pageProps} navigate={pageProps.navigate} userProfile={trackingUserProfile} currentOrder={successOrder} currentPhone={currentPhone} onReorder={reorderOrder} isOrdersLoading={isOrdersLoading} hasFetchedOrdersOnce={hasFetchedOrdersOnce} isSessionRestoring={isSessionRestoring} />}
            {page === "loyalty" && <LoyaltyPage render={pageProps.Loyalty} navigate={pageProps.navigate} userProfile={composedUserProfile} setUserProfile={setUserProfile} demoLoyalty={profileLoyalty} setDemoLoyalty={pageProps.setDemoLoyaltyState || pageProps.setDemoLoyalty || saveDemoLoyalty} subtotal={subtotal} isRegisteredCustomer={isRegisteredCustomer} hasCustomerAuthSession={hasCustomerAuthSession} requiresCustomerAuthSession={requiresCustomerAuthSession} currentPhone={currentPhone} />}
            {page === "account" && <AccountPage render={pageProps.Account} {...pageProps} navigate={pageProps.navigate} userProfile={composedUserProfile} demoUser={activeDemoUser} setDemoUser={saveDemoUser} currentPhone={currentPhone} isRegisteredCustomer={isRegisteredCustomer} loginOrRegisterByPhone={loginOrRegisterByPhone} logoutDemoUser={logoutDemoUser} demoAddresses={demoAddresses} setDemoAddresses={saveDemoAddresses} demoLoyalty={profileLoyalty} demoOrders={profileOrders} />}

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
            {showQrMemberPrompt ? (
              <CustomerModalFrame className="qr-member-popup" onBackdropClick={dismissQrMemberPrompt}>
                <div className="qr-member-popup__badge">
                  <Icon name="star" size={17} />
                  <span>Đặt món QR</span>
                </div>
                <h2>Đặt món QR tiện hơn</h2>
                <p>
                  Quét QR để tự chọn món, dùng ưu đãi và theo dõi đơn ngay trên điện thoại.
                </p>
                <div className="qr-member-popup__list">
                  <div className="qr-member-popup__item">
                    <span><Icon name="dish" size={17} /></span>
                    <strong>Tự chọn món</strong>
                    <small>Thoải mái xem menu, chọn topping, không cần chờ nhân viên ghi món.</small>
                  </div>
                  <div className="qr-member-popup__item">
                    <span><Icon name="tag" size={17} /></span>
                    <strong>Nhập voucher</strong>
                    <small>Dùng mã ưu đãi phù hợp trước khi xác nhận đơn.</small>
                  </div>
                  <div className="qr-member-popup__item">
                    <span><Icon name="star" size={17} /></span>
                    <strong>Tích điểm</strong>
                    <small>Nhập số điện thoại để quán ghi nhận điểm; đăng ký giúp xem điểm và nhận ưu đãi.</small>
                  </div>
                  <div className="qr-member-popup__item">
                    <span><Icon name="bag" size={17} /></span>
                    <strong>Theo dõi đơn</strong>
                    <small>Xem trạng thái đơn đang làm và lịch sử mua hàng trên điện thoại.</small>
                  </div>
                </div>
                <div className={`qr-member-popup__actions${shouldShowQrSignupAction ? "" : " qr-member-popup__actions--single"}`}>
                  {shouldShowQrSignupAction ? (
                    <CustomerButton onClick={handleQrMemberPromptSignup}>
                      Đăng ký ngay
                    </CustomerButton>
                  ) : null}
                  <CustomerButton variant={shouldShowQrSignupAction ? "secondary" : "primary"} onClick={dismissQrMemberPrompt}>
                    Tiếp tục
                  </CustomerButton>
                </div>
              </CustomerModalFrame>
            ) : null}
            {!shouldHideBottomNav && (
              isQrCounterFlow
                ? <BottomNav activeTab={activeTab} onChange={handleQrBottomNav} items={qrBottomNavItems} />
                : <BottomNav activeTab={activeTab} onChange={handleBottomNav} />
            )}
            <StoreStatusModal notice={serviceNotice} onClose={() => setServiceNotice?.(null)} />
          </>
        )}
      </main>
    </div>
  );
}
