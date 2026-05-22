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
    paymentMethod,
    orderSource = "online"
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
      orderSource,
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
    const nextStatus = String(targetOrder?.status || "").toLowerCase() === "pending_zalo"
      ? "confirmed"
      : targetOrder?.status || "confirmed";
    const savedOrder = targetOrderId
      ? orderStorage.updateOrder(targetOrderId, { zaloSentAt, status: nextStatus }) || { ...targetOrder, zaloSentAt, status: nextStatus }
      : null;
    const targetPhone = savedOrder?.phone || targetOrder?.phone || targetOrder?.customerPhone || currentPhone || "";
    const latestOrdersByPhone = targetPhone ? orderStorage.getByPhone(targetPhone) : [];

    setOrderStatus(nextStatus);
    setCurrentOrder(order => order ? { ...order, zaloSentAt, status: nextStatus } : savedOrder);
    if (currentPhone && latestOrdersByPhone.length) {
      setDemoOrdersState(latestOrdersByPhone);
    }
    setUserProfile(profile => ({
      ...profile,
      orderHistory: (latestOrdersByPhone.length ? latestOrdersByPhone : profile.orderHistory).map((order) => {
        const id = order.id || order.orderCode;
        return String(id) === String(targetOrderId) ? { ...order, zaloSentAt, status: nextStatus } : order;
      })
    }));
    return savedOrder;
  }

  return {
    createOrderFromCheckout,
    confirmCurrentOrder
  };
}
