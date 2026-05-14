import { createOrderAsync, orderStorage } from "../../services/orderService.js";

export function createOrderActions({
  cart,
  userProfile,
  currentPhone,
  setDemoOrdersState,
  loyaltyByPhoneStorage,
  setDemoLoyaltyState,
  addressStorage,
  updateAddress,
  addAddress,
  setDefaultAddress,
  setDemoAddressesState,
  setUserProfile,
  getMemberRank,
  setCurrentOrder,
  setOrderStatus,
  setCart,
  saveDemoOrders,
  demoOrders,
  currentOrder,
  saveDemoUser
}) {
  async function createOrderFromCheckout({
    totalAmount,
    pointsBaseAmount,
    shippingFee = 0,
    originalShippingFee = shippingFee,
    shippingSupportDiscount = 0,
    promoDiscount = 0,
    promoCode = "",
    promoSource = "",
    promoVoucherId = "",
    pointsDiscount = 0,
    distanceKm = null,
    lat = null,
    lng = null,
    deliveryInfo,
    fulfillmentType,
    branchInfo = null,
    pickupTimeText = "",
    paymentMethod
  }) {
    return createOrderAsync({
      cart,
      totalAmount,
      pointsBaseAmount,
      shippingFee,
      originalShippingFee,
      shippingSupportDiscount,
      promoDiscount,
      promoCode,
      promoSource,
      promoVoucherId,
      pointsDiscount,
      distanceKm,
      lat,
      lng,
      deliveryInfo,
      fulfillmentType,
      branchInfo,
      pickupTimeText,
      paymentMethod,
      userProfile,
      currentPhone,
      setDemoOrdersState,
      loyaltyByPhoneStorage,
      setDemoLoyaltyState,
      addressStorage,
      updateAddress,
      addAddress,
      setDefaultAddress,
      setDemoAddressesState,
      setUserProfile,
      getMemberRank,
      setCurrentOrder,
      setOrderStatus,
      setCart,
      saveDemoUser
    });
  }

  function confirmCurrentOrder() {
    const targetOrder = currentOrder || demoOrders[0] || null;
    const targetOrderId = targetOrder?.id || targetOrder?.orderCode || "";
    const zaloSentAt = new Date().toISOString();
    const savedOrder = targetOrderId
      ? orderStorage.updateOrder(targetOrderId, { zaloSentAt }) || { ...targetOrder, zaloSentAt }
      : null;
    const targetPhone = savedOrder?.phone || targetOrder?.phone || targetOrder?.customerPhone || currentPhone || "";
    const latestOrdersByPhone = targetPhone ? orderStorage.getByPhone(targetPhone) : [];

    setOrderStatus(targetOrder?.status || "pending_zalo");
    setCurrentOrder(order => order ? { ...order, zaloSentAt } : savedOrder);
    if (currentPhone && latestOrdersByPhone.length) {
      setDemoOrdersState(latestOrdersByPhone);
    }
    setUserProfile(profile => ({
      ...profile,
      orderHistory: (latestOrdersByPhone.length ? latestOrdersByPhone : profile.orderHistory).map((order) => {
        const id = order.id || order.orderCode;
        return String(id) === String(targetOrderId) ? { ...order, zaloSentAt } : order;
      })
    }));
  }

  return {
    createOrderFromCheckout,
    confirmCurrentOrder
  };
}
