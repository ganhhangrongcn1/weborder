import { useEffect, useMemo, useState } from "react";
import "../../../styles/customer.css";
import BottomNav from "../../../components/BottomNav.jsx";
import StoreStatusModal from "../../../components/customer/StoreStatusModal.jsx";
import CustomerOptionModal from "../../../components/customer/OptionModal.jsx";
import CustomerFloatingCartBar from "../../../components/customer/FloatingCartBar.jsx";
import CustomerToast from "../../../components/customer/Toast.jsx";
import LoyaltyVoucherPopup from "../../../components/customer/LoyaltyVoucherPopup.jsx";
import HomePage from "../home/HomePage.jsx";
import MenuPage from "./MenuPage.jsx";
import ProductDetailPage from "./ProductDetailPage.jsx";
import CheckoutPage from "../checkout/CheckoutPage.jsx";
import SuccessPage from "./SuccessPage.jsx";
import TrackingPage from "../tracking/TrackingPage.jsx";
import LoyaltyPage from "../loyalty/LoyaltyPage.jsx";
import AccountPage from "../account/AccountPage.jsx";
import { orderRepository } from "../../../services/repositories/orderRepository.js";
import Icon from "../../../components/Icon.jsx";

function isVoucherExpired(voucher) {
  const expiredAt = String(voucher?.expiredAt || voucher?.endAt || voucher?.expiry || "").trim();
  if (!expiredAt) return false;
  const endDate = new Date(`${expiredAt.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(endDate.getTime())) return false;
  return endDate.getTime() < Date.now();
}

function getVoucherIdentity(voucher) {
  const id = String(voucher?.id || "").trim();
  if (id) return id;
  const code = String(voucher?.code || "").trim().toUpperCase();
  const createdAt = String(voucher?.createdAt || "").trim();
  return `${code}-${createdAt}`;
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
  orderStatus,
  confirmCurrentOrder,
  composedUserProfile,
  currentPhone,
  reorderOrder,
  setUserProfile,
  profileLoyalty,
  saveDemoLoyalty,
  subtotal,
  isRegisteredCustomer,
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
  const [voucherPopup, setVoucherPopup] = useState(null);
  const [voucherPopupOpen, setVoucherPopupOpen] = useState(false);

  const lastCreatedOrderId = orderRepository.getLastCreatedOrderId();
  const forcedLatestOrder = (Array.isArray(profileOrders) ? profileOrders : []).find((order) => {
    const id = String(order?.id || order?.orderCode || "").trim();
    return Boolean(lastCreatedOrderId) && id === lastCreatedOrderId;
  }) || (String(currentOrder?.id || currentOrder?.orderCode || "").trim() === lastCreatedOrderId ? currentOrder : null);
  const latestProfileOrder = Array.isArray(profileOrders) && profileOrders.length ? profileOrders[0] : null;
  const currentOrderTime = new Date(currentOrder?.createdAt || 0).getTime();
  const latestProfileOrderTime = new Date(latestProfileOrder?.createdAt || 0).getTime();
  const successOrder = forcedLatestOrder || (latestProfileOrderTime > currentOrderTime ? latestProfileOrder : (currentOrder || latestProfileOrder));
  const successStatus = String(successOrder?.status || orderStatus || "").toLowerCase();
  const isWaitingZaloSend = page === "success" && successStatus === "pending_zalo" && !successOrder?.zaloSentAt;

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

  const loyaltyVouchers = Array.isArray(profileLoyalty?.voucherHistory) ? profileLoyalty.voucherHistory : [];
  const loyaltyCoupons = useMemo(
    () =>
      (Array.isArray(pageProps?.coupons) ? pageProps.coupons : []).filter(
        (coupon) => String(coupon?.voucherType || "checkout") === "loyalty"
      ),
    [pageProps?.coupons]
  );

  const couponById = useMemo(
    () =>
      loyaltyCoupons.reduce((acc, coupon) => {
        const key = String(coupon?.id || "").trim();
        if (key) acc[key] = coupon;
        return acc;
      }, {}),
    [loyaltyCoupons]
  );

  const couponByCode = useMemo(
    () =>
      loyaltyCoupons.reduce((acc, coupon) => {
        const key = String(coupon?.code || "").trim().toUpperCase();
        if (key) acc[key] = coupon;
        return acc;
      }, {}),
    [loyaltyCoupons]
  );

  useEffect(() => {
    if (!currentPhone || !isRegisteredCustomer) {
      setVoucherPopup(null);
      setVoucherPopupOpen(false);
      return;
    }

    const candidates = loyaltyVouchers.filter((voucher) => {
      if (!voucher || voucher.used || voucher.canceled) return false;
      if (isVoucherExpired(voucher)) return false;
      return true;
    });

    if (!candidates.length) {
      setVoucherPopup(null);
      setVoucherPopupOpen(false);
      return;
    }

    const voucher = candidates[0];
    const voucherId = getVoucherIdentity(voucher);
    if (!voucherId) return;

    const phoneKey = String(currentPhone || "").replace(/\D/g, "");
    const seenKey = `ghr_loyalty_voucher_seen_${phoneKey}_${voucherId}`;
    const visitKey = `ghr_loyalty_voucher_visit_${phoneKey}_${voucherId}`;
    const hasSeen = localStorage.getItem(seenKey) === "1";
    const shownThisVisit = sessionStorage.getItem(visitKey) === "1";

    if (hasSeen && shownThisVisit) return;

    const matchedCoupon =
      couponById[String(voucher?.couponId || "").trim()] ||
      couponByCode[String(voucher?.code || "").trim().toUpperCase()] ||
      null;

    setVoucherPopup({ voucher, coupon: matchedCoupon, seenKey, visitKey });
    setVoucherPopupOpen(true);
  }, [currentPhone, isRegisteredCustomer, loyaltyVouchers, couponById, couponByCode]);

  const handleOpenCheckout = () => {
    const notice = getStoreBlockNotice?.();
    if (notice) {
      setServiceNotice?.(notice);
      return;
    }
    navigate("checkout", "orders");
  };

  const closeVoucherPopup = () => {
    if (voucherPopup?.seenKey) localStorage.setItem(voucherPopup.seenKey, "1");
    if (voucherPopup?.visitKey) sessionStorage.setItem(voucherPopup.visitKey, "1");
    setVoucherPopupOpen(false);
  };

  const handleVoucherAction = () => {
    closeVoucherPopup();
    navigate("menu", "menu");
  };

  return (
    <div className="customer-shell min-h-screen bg-app text-brown">
      <main className="mx-auto min-h-screen w-full max-w-[430px] bg-cream pb-24 shadow-preview">
        {isSessionBootstrapping ? (
          <section className="px-4 pt-6">
            <div className="rounded-[28px] bg-white p-6 text-center shadow-soft">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-orange-600">
                <Icon name="star" size={20} />
              </div>
              <h2 className="mt-3 text-base font-black text-brown">Đang tải dữ liệu</h2>
              <p className="mt-1 text-sm text-brown/60">Đang đồng bộ tài khoản và lịch sử đơn hàng...</p>
            </div>
          </section>
        ) : (
          <>
            {page === "home" && <HomePage render={pageProps.Home} {...pageProps} coupons={pageProps.homeCoupons || pageProps.coupons} smartPromotions={pageProps.homeSmartPromotions || pageProps.smartPromotions} openProduct={openOptionModalFromHome} openOptionModal={openOptionModalFromHome} />}
            {page === "menu" && <MenuPage render={pageProps.Menu} {...pageProps} />}
            {page === "detail" && <ProductDetailPage render={pageProps.Detail} {...pageProps} />}
            {page === "checkout" && <CheckoutPage render={pageProps.Checkout} {...pageProps} coupons={pageProps.checkoutCoupons || pageProps.coupons} smartPromotions={pageProps.checkoutSmartPromotions || pageProps.smartPromotions} openCartItemEditor={openCartItemEditor} />}
            {page === "success" && <SuccessPage render={pageProps.Success} navigate={pageProps.navigate} order={successOrder} branchPhone={branches[0]?.zaloPhone || "0788422424"} orderStatus={orderStatus} confirmCurrentOrder={confirmCurrentOrder} />}
            {page === "tracking" && <TrackingPage render={pageProps.Tracking} {...pageProps} navigate={pageProps.navigate} userProfile={trackingUserProfile} currentOrder={successOrder} currentPhone={currentPhone} onReorder={reorderOrder} isOrdersLoading={isOrdersLoading} hasFetchedOrdersOnce={hasFetchedOrdersOnce} isSessionRestoring={isSessionRestoring} />}
            {page === "loyalty" && <LoyaltyPage render={pageProps.Loyalty} navigate={pageProps.navigate} userProfile={composedUserProfile} setUserProfile={setUserProfile} demoLoyalty={profileLoyalty} setDemoLoyalty={pageProps.setDemoLoyaltyState || pageProps.setDemoLoyalty || saveDemoLoyalty} subtotal={subtotal} isRegisteredCustomer={isRegisteredCustomer} currentPhone={currentPhone} />}
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

            {cartCount > 0 && !["checkout", "success"].includes(page) && (
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
            {!isWaitingZaloSend && <BottomNav activeTab={activeTab} onChange={handleBottomNav} />}
            <StoreStatusModal notice={serviceNotice} onClose={() => setServiceNotice?.(null)} />
            <LoyaltyVoucherPopup
              open={voucherPopupOpen}
              voucher={voucherPopup?.voucher}
              coupon={voucherPopup?.coupon}
              onClose={closeVoucherPopup}
              onPrimaryAction={handleVoucherAction}
            />
          </>
        )}
      </main>
    </div>
  );
}
