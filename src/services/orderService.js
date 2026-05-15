import { getCustomerKey } from "./storageService.js";
import { orderRepository } from "./repositories/orderRepository.js";
import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";
import { applyOrderLoyalty, applyOrderLoyaltyAsync, calculateOrderPoints, getLoyaltyRuleConfig, getLoyaltyRuleConfigAsync } from "./loyaltyService.js";

function getOrderPhoneForLoyalty(order = {}) {
  return order.phone || order.customerPhone || order.customerPhoneKey || order.rawCustomerPhone || "";
}

export const orderStorage = {
  getAllByPhone() {
    return orderRepository.getAllByPhone();
  },
  async getAllByPhoneAsync(options = {}) {
    return orderRepository.getAllByPhoneAsync(options);
  },
  getAll() {
    return orderRepository.getAll();
  },
  async getAllAsync(options = {}) {
    return orderRepository.getAllAsync(options);
  },
  getByPhone(phone) {
    return orderRepository.getByPhone(phone);
  },
  async getByPhoneAsync(phone) {
    return orderRepository.getByPhoneAsync(phone);
  },
  subscribeRealtimeByPhone(phone, onSynced) {
    return orderRepository.subscribeRealtimeByPhone(phone, onSynced);
  },
  addOrder(order) {
    return orderRepository.upsertOrder(order);
  },
  async addOrderAsync(order) {
    return orderRepository.upsertOrderAsync(order);
  },
  saveAll(ordersByPhone) {
    return orderRepository.saveAllByPhone(ordersByPhone);
  },
  updateOrder(orderId, patch) {
    const allByPhone = this.getAllByPhone();
    let updatedOrder = null;
    let previousOrder = null;
    const nextByPhone = Object.fromEntries(
      Object.entries(allByPhone).map(([phone, orders]) => {
        const nextOrders = (orders || []).map((order) => {
          const id = order.id || order.orderCode;
          if (String(id) !== String(orderId)) return order;
          previousOrder = order;
          updatedOrder = {
            ...order,
            ...(typeof patch === "function" ? patch(order) : patch)
          };
          return updatedOrder;
        });
        return [phone, nextOrders];
      })
    );
    this.saveAll(nextByPhone);
    if (updatedOrder) {
      const prevStatus = String(previousOrder?.status || "").toLowerCase();
      const nextStatus = String(updatedOrder?.status || "").toLowerCase();
      const becameDone = !["done", "completed", "hoàn tất"].includes(prevStatus) && ["done", "completed", "hoàn tất"].includes(nextStatus);
      if (becameDone) {
        applyOrderLoyalty({
          phone: getOrderPhoneForLoyalty(updatedOrder),
          orderId: updatedOrder.orderCode || updatedOrder.id,
          amount: Number(
            updatedOrder.pointsBaseAmount ??
              Math.max(
                Number(updatedOrder.subtotal ?? updatedOrder.totalAmount ?? updatedOrder.total ?? 0) -
                  Number(updatedOrder.promoDiscount || 0),
                0
              )
          ),
          createdAt: updatedOrder.createdAt || new Date().toISOString(),
          promoSource: updatedOrder.promoSource || "",
          promoVoucherId: updatedOrder.promoVoucherId || "",
          promoCode: updatedOrder.promoCode || "",
          pointsDiscount: Number(updatedOrder.pointsDiscount || 0),
          orderStatus: updatedOrder.status || ""
        });
      }
    }
    return updatedOrder;
  },
  async updateOrderAsync(orderId, patch) {
    const allByPhone = await this.getAllByPhoneAsync();
    let updatedOrder = null;
    let previousOrder = null;
    const nextByPhone = Object.fromEntries(
      Object.entries(allByPhone).map(([phone, orders]) => {
        const nextOrders = (orders || []).map((order) => {
          const id = order.id || order.orderCode;
          if (String(id) !== String(orderId)) return order;
          previousOrder = order;
          updatedOrder = {
            ...order,
            ...(typeof patch === "function" ? patch(order) : patch)
          };
          return updatedOrder;
        });
        return [phone, nextOrders];
      })
    );
    if (!updatedOrder) return null;

    // Always sync local cache first for instant UI feedback.
    await this.saveAll(nextByPhone);

    // Force remote status update and surface errors (RLS/grant).
    if (coreSupabaseRepository?.updateOrderStatusById) {
      await coreSupabaseRepository.updateOrderStatusById(
        updatedOrder.id || updatedOrder.orderCode || orderId,
        updatedOrder.status || "pending_zalo"
      );
    }

    const prevStatus = String(previousOrder?.status || "").toLowerCase();
    const nextStatus = String(updatedOrder?.status || "").toLowerCase();
    const becameDone = !["done", "completed", "hoàn tất"].includes(prevStatus) && ["done", "completed", "hoàn tất"].includes(nextStatus);
    if (becameDone) {
      await applyOrderLoyaltyAsync({
        phone: getOrderPhoneForLoyalty(updatedOrder),
        orderId: updatedOrder.orderCode || updatedOrder.id,
        amount: Number(
          updatedOrder.pointsBaseAmount ??
            Math.max(
              Number(updatedOrder.subtotal ?? updatedOrder.totalAmount ?? updatedOrder.total ?? 0) -
                Number(updatedOrder.promoDiscount || 0),
              0
            )
        ),
        createdAt: updatedOrder.createdAt || new Date().toISOString(),
        promoSource: updatedOrder.promoSource || "",
        promoVoucherId: updatedOrder.promoVoucherId || "",
        promoCode: updatedOrder.promoCode || "",
        pointsDiscount: Number(updatedOrder.pointsDiscount || 0),
        orderStatus: updatedOrder.status || ""
      });
    }

    return updatedOrder;
  }
};

export function createOrder({ cart, totalAmount, pointsBaseAmount, shippingFee = 0, originalShippingFee = shippingFee, shippingSupportDiscount = 0, promoDiscount = 0, promoCode = "", promoSource = "", promoVoucherId = "", pointsDiscount = 0, distanceKm = null, lat = null, lng = null, deliveryInfo, fulfillmentType, branchInfo = null, pickupTimeText = "", paymentMethod, userProfile, currentPhone, setDemoOrdersState, loyaltyByPhoneStorage, setDemoLoyaltyState, addressStorage, updateAddress, addAddress, setDefaultAddress, setDemoAddressesState, setUserProfile, getMemberRank, setCurrentOrder, setOrderStatus, setCart, saveDemoUser }) {
  if (!cart.length) return null;
  const orderCode = `GHR-${Date.now().toString().slice(-4)}`;
  const createdAt = new Date().toISOString();
  const subtotalAmount = Number(
    cart.reduce((sum, item) => sum + Number(item?.lineTotal || 0), 0)
  );
  const pointsAmount = Number(
    pointsBaseAmount ?? Math.max(subtotalAmount - Number(promoDiscount || 0), 0)
  );
  const pointsEarned = calculateOrderPoints(pointsAmount, getLoyaltyRuleConfig());
  const order = {
    id: orderCode,
    orderCode,
    phone: getCustomerKey(deliveryInfo?.phone || userProfile.phone),
    customerPhoneKey: getCustomerKey(deliveryInfo?.phone || userProfile.phone),
    rawCustomerPhone: deliveryInfo?.phone || userProfile.phone || "",
    items: cart,
    subtotal: subtotalAmount,
    pointsBaseAmount: pointsAmount,
    shippingFee,
    originalShippingFee,
    shippingSupportDiscount,
    promoDiscount,
    promoCode,
    promoSource,
    promoVoucherId,
    pointsDiscount,
    distanceKm,
    deliveryFee: shippingFee,
    lat,
    lng,
    total: totalAmount,
    totalAmount,
    createdAt,
    status: "pending_zalo",
    customerName: deliveryInfo?.name || userProfile.name,
    orderCustomerName: deliveryInfo?.name || userProfile.name,
    customerPhone: deliveryInfo?.phone || userProfile.phone,
    fulfillmentType,
    branchId: branchInfo?.id || "",
    branchName: branchInfo?.name || "",
    branchAddress: branchInfo?.address || "",
    pickupBranchId: fulfillmentType === "pickup" ? (branchInfo?.id || "") : "",
    pickupBranchName: fulfillmentType === "pickup" ? (branchInfo?.name || "") : "",
    pickupBranchAddress: fulfillmentType === "pickup" ? (branchInfo?.address || "") : "",
    deliveryBranchId: fulfillmentType === "delivery" ? (branchInfo?.id || "") : "",
    deliveryBranchName: fulfillmentType === "delivery" ? (branchInfo?.name || "") : "",
    deliveryBranchAddress: fulfillmentType === "delivery" ? (branchInfo?.address || "") : "",
    pickupTimeText,
    deliveryAddress: fulfillmentType === "pickup" ? "Khach tu den lay" : (deliveryInfo?.address || userProfile.addresses[0]?.detail || ""),
    paymentMethod,
    pointsEarned
  };
  const savedOrder = orderStorage.addOrder(order);
  if (currentPhone && getCustomerKey(currentPhone) === order.phone && saveDemoUser) {
    saveDemoUser({
      phone: order.phone,
      registered: true
    });
  }
  if (getCustomerKey(currentPhone) === order.phone) setDemoOrdersState(orderStorage.getByPhone(order.phone));
  const nextPhoneLoyalty = applyOrderLoyalty({
    phone: order.phone,
    orderId: orderCode,
    amount: pointsAmount,
    createdAt,
    promoSource,
    promoVoucherId,
    promoCode,
    pointsDiscount: Number(pointsDiscount || 0),
    orderStatus: order.status
  });
  if (!currentPhone || getCustomerKey(currentPhone) === order.phone) setDemoLoyaltyState(nextPhoneLoyalty);
  if (fulfillmentType !== "pickup" && deliveryInfo?.address) {
    const phoneAddresses = addressStorage.getAll(order.phone);
    const existingAddress = phoneAddresses.find((address) => address.address.trim().toLowerCase() === deliveryInfo.address.trim().toLowerCase());
    const baseAddresses = existingAddress
      ? updateAddress(phoneAddresses, existingAddress.id, { label: "Giao gan nhat", receiverName: deliveryInfo.name, phone: order.phone, lat: deliveryInfo.lat, lng: deliveryInfo.lng, distanceKm: deliveryInfo.distanceKm, deliveryFee: deliveryInfo.deliveryFee })
      : addAddress(phoneAddresses, { label: "Giao gan nhat", receiverName: deliveryInfo.name, phone: order.phone, address: deliveryInfo.address, lat: deliveryInfo.lat, lng: deliveryInfo.lng, distanceKm: deliveryInfo.distanceKm, deliveryFee: deliveryInfo.deliveryFee, isDefault: true });
    const defaultId = existingAddress?.id || baseAddresses[0].id;
    const defaulted = setDefaultAddress(baseAddresses, defaultId);
    const savedAddresses = addressStorage.saveAll([defaulted.find((address) => address.id === defaultId), ...defaulted.filter((address) => address.id !== defaultId)].filter(Boolean), order.phone);
    if (getCustomerKey(currentPhone) === order.phone) setDemoAddressesState(savedAddresses);
  }

  setUserProfile((profile) => {
    const nextTotalSpent = profile.totalSpent + totalAmount;
    const nextAddresses = fulfillmentType === "pickup" || !deliveryInfo?.address
      ? profile.addresses
      : [{ id: Date.now(), title: "Giao gan nhat", detail: deliveryInfo.address, active: true }, ...profile.addresses.map((address) => ({ ...address, active: false }))].slice(0, 4);
    return {
      ...profile,
      name: profile.name,
      phone: deliveryInfo?.phone || profile.phone,
      points: Number(nextPhoneLoyalty?.totalPoints || profile.points || 0),
      totalOrders: profile.totalOrders + 1,
      totalSpent: nextTotalSpent,
      memberRank: getMemberRank(nextTotalSpent),
      addresses: nextAddresses,
      orderHistory: [savedOrder, ...profile.orderHistory],
      pointHistory: Array.isArray(nextPhoneLoyalty?.pointHistory) ? nextPhoneLoyalty.pointHistory : profile.pointHistory
    };
  });
  setCurrentOrder(savedOrder);
  setOrderStatus("pending_zalo");
  setCart([]);
  return order;
}

export async function createOrderAsync(params) {
  const {
    cart,
    totalAmount,
    pointsBaseAmount,
    subtotal,
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
  } = params;

  if (!Array.isArray(cart) || !cart.length) return null;
  const orderCode = `GHR-${Date.now().toString().slice(-4)}`;
  const createdAt = new Date().toISOString();
  const subtotalAmount = Number(
    subtotal ?? cart.reduce((sum, item) => sum + Number(item?.lineTotal || 0), 0)
  );
  const pointsAmount = Number(
    pointsBaseAmount ?? Math.max(subtotalAmount - Number(promoDiscount || 0), 0)
  );
  const loyaltyRule = await getLoyaltyRuleConfigAsync();
  const pointsEarned = calculateOrderPoints(pointsAmount, loyaltyRule);
  const order = {
    id: orderCode,
    orderCode,
    phone: getCustomerKey(deliveryInfo?.phone || userProfile.phone),
    customerPhoneKey: getCustomerKey(deliveryInfo?.phone || userProfile.phone),
    rawCustomerPhone: deliveryInfo?.phone || userProfile.phone || "",
    items: cart,
    subtotal: subtotalAmount,
    pointsBaseAmount: pointsAmount,
    shippingFee,
    originalShippingFee,
    shippingSupportDiscount,
    promoDiscount,
    promoCode,
    promoSource,
    promoVoucherId,
    pointsDiscount,
    distanceKm,
    deliveryFee: shippingFee,
    lat,
    lng,
    total: totalAmount,
    totalAmount,
    createdAt,
    status: "pending_zalo",
    customerName: deliveryInfo?.name || userProfile.name,
    orderCustomerName: deliveryInfo?.name || userProfile.name,
    customerPhone: deliveryInfo?.phone || userProfile.phone,
    fulfillmentType,
    branchId: branchInfo?.id || "",
    branchName: branchInfo?.name || "",
    branchAddress: branchInfo?.address || "",
    pickupBranchId: fulfillmentType === "pickup" ? (branchInfo?.id || "") : "",
    pickupBranchName: fulfillmentType === "pickup" ? (branchInfo?.name || "") : "",
    pickupBranchAddress: fulfillmentType === "pickup" ? (branchInfo?.address || "") : "",
    deliveryBranchId: fulfillmentType === "delivery" ? (branchInfo?.id || "") : "",
    deliveryBranchName: fulfillmentType === "delivery" ? (branchInfo?.name || "") : "",
    deliveryBranchAddress: fulfillmentType === "delivery" ? (branchInfo?.address || "") : "",
    pickupTimeText,
    deliveryAddress: fulfillmentType === "pickup" ? "Khach tu den lay" : (deliveryInfo?.address || userProfile.addresses[0]?.detail || ""),
    paymentMethod,
    pointsEarned
  };

  const savedOrder = await orderStorage.addOrderAsync(order);
  if (currentPhone && getCustomerKey(currentPhone) === order.phone && saveDemoUser) {
    saveDemoUser({ phone: order.phone, registered: true });
  }
  if (getCustomerKey(currentPhone) === order.phone) {
    const latestOrders = await orderStorage.getByPhoneAsync(order.phone);
    setDemoOrdersState(latestOrders);
  }

  const nextPhoneLoyalty = applyOrderLoyalty({
    phone: order.phone,
    orderId: orderCode,
    amount: pointsAmount,
    createdAt,
    promoSource,
    promoVoucherId,
    promoCode,
    pointsDiscount: Number(pointsDiscount || 0),
    orderStatus: order.status
  });
  if (!currentPhone || getCustomerKey(currentPhone) === order.phone) setDemoLoyaltyState(nextPhoneLoyalty);

  if (fulfillmentType !== "pickup" && deliveryInfo?.address) {
    const phoneAddresses = addressStorage.getAll(order.phone);
    const existingAddress = phoneAddresses.find((address) => address.address.trim().toLowerCase() === deliveryInfo.address.trim().toLowerCase());
    const baseAddresses = existingAddress
      ? updateAddress(phoneAddresses, existingAddress.id, { label: "Giao gan nhat", receiverName: deliveryInfo.name, phone: order.phone, lat: deliveryInfo.lat, lng: deliveryInfo.lng, distanceKm: deliveryInfo.distanceKm, deliveryFee: deliveryInfo.deliveryFee })
      : addAddress(phoneAddresses, { label: "Giao gan nhat", receiverName: deliveryInfo.name, phone: order.phone, address: deliveryInfo.address, lat: deliveryInfo.lat, lng: deliveryInfo.lng, distanceKm: deliveryInfo.distanceKm, deliveryFee: deliveryInfo.deliveryFee, isDefault: true });
    const defaultId = existingAddress?.id || baseAddresses[0].id;
    const defaulted = setDefaultAddress(baseAddresses, defaultId);
    const savedAddresses = addressStorage.saveAll([defaulted.find((address) => address.id === defaultId), ...defaulted.filter((address) => address.id !== defaultId)].filter(Boolean), order.phone);
    if (getCustomerKey(currentPhone) === order.phone) setDemoAddressesState(savedAddresses);
  }

  setUserProfile((profile) => {
    const nextTotalSpent = profile.totalSpent + totalAmount;
    const nextAddresses = fulfillmentType === "pickup" || !deliveryInfo?.address
      ? profile.addresses
      : [{ id: Date.now(), title: "Giao gan nhat", detail: deliveryInfo.address, active: true }, ...profile.addresses.map((address) => ({ ...address, active: false }))].slice(0, 4);
    return {
      ...profile,
      name: profile.name,
      phone: deliveryInfo?.phone || profile.phone,
      points: Number(nextPhoneLoyalty?.totalPoints || profile.points || 0),
      totalOrders: profile.totalOrders + 1,
      totalSpent: nextTotalSpent,
      memberRank: getMemberRank(nextTotalSpent),
      addresses: nextAddresses,
      orderHistory: [savedOrder, ...profile.orderHistory],
      pointHistory: Array.isArray(nextPhoneLoyalty?.pointHistory) ? nextPhoneLoyalty.pointHistory : profile.pointHistory
    };
  });
  setCurrentOrder(savedOrder);
  setOrderStatus("pending_zalo");
  setCart([]);
  return order;
}

export function reorder(order) {
  const now = Date.now();
  return (order?.items || []).map((item, index) => {
    const quantity = item.quantity || 1;
    const unitTotal = item.unitTotal || Math.round((item.lineTotal || item.price || 0) / quantity);
    return {
      ...item,
      cartId: `${item.id || "order"}-reorder-${now}-${index}`,
      quantity,
      toppings: item.toppings || [],
      unitTotal,
      lineTotal: unitTotal * quantity
    };
  });
}
