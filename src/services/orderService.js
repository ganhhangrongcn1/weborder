import { getCustomerKey } from "./storageService.js";
import { orderRepository } from "./repositories/orderRepository.js";
import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";
import { composeMemberLoyaltySnapshot } from "./memberLoyaltySnapshotService.js";
import { applyOrderLoyalty, applyOrderLoyaltyAsync, calculateOrderPoints, getLoyaltyRuleConfig, getLoyaltyRuleConfigAsync } from "./loyaltyService.js";

const DONE_ORDER_STATUSES = new Set(["done", "completed", "hoan tat"]);

function resolveBranchIdentifiers(branchInfo = null, fulfillmentType = "") {
  const branchId = String(
    branchInfo?.id ||
      branchInfo?.branchId ||
      branchInfo?.legacyId ||
      branchInfo?.legacy_id ||
      ""
  );
  const branchUuid = String(
    branchInfo?.branchUuid ||
      branchInfo?.branch_uuid ||
      branchInfo?.uuid ||
      ""
  );
  const isPickup = String(fulfillmentType || "").toLowerCase() === "pickup";
  const isDelivery = String(fulfillmentType || "").toLowerCase() === "delivery";
  return {
    branchId,
    branchUuid,
    pickupBranchId: isPickup ? branchId : "",
    pickupBranchUuid: isPickup ? branchUuid : "",
    deliveryBranchId: isDelivery ? branchId : "",
    deliveryBranchUuid: isDelivery ? branchUuid : ""
  };
}

function getOrderPhoneForLoyalty(order = {}) {
  return order.phone || order.customerPhone || order.customerPhoneKey || order.rawCustomerPhone || "";
}

function normalizeOrderStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

function didOrderBecomeDone(previousOrder = null, nextOrder = null) {
  const prevStatus = normalizeOrderStatus(previousOrder?.status);
  const nextStatus = normalizeOrderStatus(nextOrder?.status);
  return !DONE_ORDER_STATUSES.has(prevStatus) && DONE_ORDER_STATUSES.has(nextStatus);
}

function getOrderPointsBaseAmount(order = {}) {
  return Number(
    order.pointsBaseAmount ??
      Math.max(
        Number(order.subtotal ?? order.totalAmount ?? order.total ?? 0) -
          Number(order.promoDiscount || 0),
        0
      )
  );
}

function buildOrderLoyaltyPayload(order = {}) {
  const metadata = order?.metadata && typeof order.metadata === "object" ? order.metadata : {};
  return {
    phone: getOrderPhoneForLoyalty(order),
    orderId: order.orderCode || order.id,
    amount: getOrderPointsBaseAmount(order),
    createdAt: order.createdAt || new Date().toISOString(),
    promoSource: order.promoSource || "",
    promoVoucherId: order.promoVoucherId || "",
    promoCode: order.promoCode || "",
    pointsSpent: Number(
      order.pointsSpent ??
      metadata.pointsSpent ??
      order.pointsDiscount ??
      metadata.pointsDiscount ??
      0
    ),
    pointsDiscount: Number(order.pointsDiscount || 0),
    orderStatus: order.status || "",
    sourceType: "ORDER"
  };
}

function patchOrderInPhoneMap(allByPhone = {}, orderId, patch) {
  let updatedOrder = null;
  let previousOrder = null;
  const targetId = String(orderId || "");
  const nextByPhone = Object.fromEntries(
    Object.entries(allByPhone || {}).map(([phone, orders]) => {
      const nextOrders = (orders || []).map((order) => {
        const id = order.id || order.orderCode;
        if (String(id) !== targetId) return order;
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
  return { nextByPhone, updatedOrder, previousOrder };
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
  async getByPhoneAsync(phone, options = {}) {
    return orderRepository.getByPhoneAsync(phone, options);
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
    const { nextByPhone, updatedOrder, previousOrder } = patchOrderInPhoneMap(allByPhone, orderId, patch);
    this.saveAll(nextByPhone);
    if (updatedOrder && didOrderBecomeDone(previousOrder, updatedOrder)) {
      applyOrderLoyalty(buildOrderLoyaltyPayload(updatedOrder));
    }
    return updatedOrder;
  },
  async updateOrderAsync(orderId, patch) {
    const allByPhone = await this.getAllByPhoneAsync();
    const { nextByPhone, updatedOrder, previousOrder } = patchOrderInPhoneMap(allByPhone, orderId, patch);
    if (!updatedOrder) return null;

    // Update runtime state first for instant UI feedback, then persist remotely.
    await this.saveAll(nextByPhone);

    // Force remote status update and surface errors (RLS/grant).
    if (coreSupabaseRepository?.updateOrderStatusById) {
      await coreSupabaseRepository.updateOrderStatusById(
        updatedOrder.id || updatedOrder.orderCode || orderId,
        updatedOrder.status || "pending_zalo"
      );
    }

    await applyOrderLoyaltyAsync({
      ...buildOrderLoyaltyPayload(updatedOrder),
      previousOrderStatus: previousOrder?.status || ""
    });

    return updatedOrder;
  }
};

function isCurrentOrderPhone(currentPhone, orderPhone) {
  return getCustomerKey(currentPhone) === getCustomerKey(orderPhone);
}

function saveCreatedOrderCustomerMarker({ order, currentPhone, saveDemoUser }) {
  if (!currentPhone || !isCurrentOrderPhone(currentPhone, order.phone) || !saveDemoUser) return;
  saveDemoUser({
    phone: order.phone,
    registered: true
  });
}

function syncCreatedOrderList({ order, currentPhone, setDemoOrdersState }) {
  if (!isCurrentOrderPhone(currentPhone, order.phone)) return;
  setDemoOrdersState(orderStorage.getByPhone(order.phone));
}

async function syncCreatedOrderListAsync({ order, currentPhone, setDemoOrdersState }) {
  if (!isCurrentOrderPhone(currentPhone, order.phone)) return;
  const latestOrders = await orderStorage.getByPhoneAsync(order.phone, { limit: 5 });
  setDemoOrdersState(latestOrders);
}

function applyCreatedOrderLoyalty({
  order,
  pointsAmount,
  createdAt,
  promoSource,
  promoVoucherId,
  promoCode,
  pointsDiscount,
  currentPhone,
  setDemoLoyaltyState
}) {
  const nextPhoneLoyalty = applyOrderLoyalty({
    phone: order.phone,
    orderId: order.orderCode || order.id,
    amount: pointsAmount,
    createdAt,
    promoSource,
    promoVoucherId,
    promoCode,
    pointsDiscount: Number(pointsDiscount || 0),
    orderStatus: order.status
  });
  const nextSnapshot = composeMemberLoyaltySnapshot(
    nextPhoneLoyalty,
    orderStorage.getByPhone(order.phone)
  );
  if (!currentPhone || isCurrentOrderPhone(currentPhone, order.phone)) {
    setDemoLoyaltyState(nextSnapshot);
  }
  return nextSnapshot;
}

async function applyCreatedOrderLoyaltyAsync({
  order,
  pointsAmount,
  createdAt,
  promoSource,
  promoVoucherId,
  promoCode,
  pointsSpent,
  pointsDiscount,
  currentPhone,
  setDemoLoyaltyState
}) {
  const nextPhoneLoyalty = await applyOrderLoyaltyAsync({
    phone: order.phone,
    orderId: order.orderCode || order.id,
    amount: pointsAmount,
    createdAt,
    promoSource,
    promoVoucherId,
    promoCode,
    pointsSpent: Number(pointsSpent || 0),
    pointsDiscount: Number(pointsDiscount || 0),
    orderStatus: order.status,
    previousOrderStatus: "",
    sourceType: "ORDER"
  });
  const nextSnapshot = composeMemberLoyaltySnapshot(
    nextPhoneLoyalty,
    orderStorage.getByPhone(order.phone)
  );
  if (!currentPhone || isCurrentOrderPhone(currentPhone, order.phone)) {
    setDemoLoyaltyState(nextSnapshot);
  }
  return nextSnapshot;
}

function saveCreatedOrderAddress({
  order,
  deliveryInfo,
  fulfillmentType,
  currentPhone,
  addressStorage,
  updateAddress,
  addAddress,
  setDefaultAddress,
  setDemoAddressesState
}) {
  if (fulfillmentType === "pickup" || !deliveryInfo?.address) return;
  const phoneAddresses = addressStorage.getAll(order.phone);
  const existingAddress = phoneAddresses.find(
    (address) => address.address.trim().toLowerCase() === deliveryInfo.address.trim().toLowerCase()
  );
  const baseAddresses = existingAddress
    ? updateAddress(phoneAddresses, existingAddress.id, {
        label: "Giao gan nhat",
        receiverName: deliveryInfo.name,
        phone: order.phone,
        lat: deliveryInfo.lat,
        lng: deliveryInfo.lng,
        distanceKm: deliveryInfo.distanceKm,
        deliveryFee: deliveryInfo.deliveryFee
      })
    : addAddress(phoneAddresses, {
        label: "Giao gan nhat",
        receiverName: deliveryInfo.name,
        phone: order.phone,
        address: deliveryInfo.address,
        lat: deliveryInfo.lat,
        lng: deliveryInfo.lng,
        distanceKm: deliveryInfo.distanceKm,
        deliveryFee: deliveryInfo.deliveryFee,
        isDefault: true
      });
  const defaultId = existingAddress?.id || baseAddresses[0].id;
  const defaulted = setDefaultAddress(baseAddresses, defaultId);
  const savedAddresses = addressStorage.saveAll(
    [defaulted.find((address) => address.id === defaultId), ...defaulted.filter((address) => address.id !== defaultId)].filter(Boolean),
    order.phone
  );
  if (isCurrentOrderPhone(currentPhone, order.phone)) setDemoAddressesState(savedAddresses);
}

function updateCreatedOrderProfile({
  savedOrder,
  totalAmount,
  deliveryInfo,
  fulfillmentType,
  nextPhoneLoyalty,
  setUserProfile,
  getMemberRank
}) {
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
}

function finalizeCreatedOrderUi({ savedOrder, setCurrentOrder, setOrderStatus, setCart }) {
  setCurrentOrder(savedOrder);
  setOrderStatus("pending_zalo");
  setCart([]);
}

export function createOrder({ cart, totalAmount, pointsBaseAmount, shippingFee = 0, originalShippingFee = shippingFee, shippingSupportDiscount = 0, promoDiscount = 0, promoCode = "", promoSource = "", promoVoucherId = "", pointsSpent = 0, pointsDiscount = 0, pointsDiscountAmount = pointsDiscount, distanceKm = null, lat = null, lng = null, deliveryInfo, fulfillmentType, branchInfo = null, pickupTimeText = "", paymentMethod, orderSource = "online", userProfile, currentPhone, setDemoOrdersState, setDemoLoyaltyState, addressStorage, updateAddress, addAddress, setDefaultAddress, setDemoAddressesState, setUserProfile, getMemberRank, setCurrentOrder, setOrderStatus, setCart, saveDemoUser }) {
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
  const branchIdentifiers = resolveBranchIdentifiers(branchInfo, fulfillmentType);
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
    pointsSpent,
    pointsDiscount,
    pointsDiscountAmount,
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
    branchId: branchIdentifiers.branchId,
    branchUuid: branchIdentifiers.branchUuid,
    branchName: branchInfo?.name || "",
    branchAddress: branchInfo?.address || "",
    pickupBranchId: branchIdentifiers.pickupBranchId,
    pickupBranchUuid: branchIdentifiers.pickupBranchUuid,
    pickupBranchName: fulfillmentType === "pickup" ? (branchInfo?.name || "") : "",
    pickupBranchAddress: fulfillmentType === "pickup" ? (branchInfo?.address || "") : "",
    deliveryBranchId: branchIdentifiers.deliveryBranchId,
    deliveryBranchUuid: branchIdentifiers.deliveryBranchUuid,
    deliveryBranchName: fulfillmentType === "delivery" ? (branchInfo?.name || "") : "",
    deliveryBranchAddress: fulfillmentType === "delivery" ? (branchInfo?.address || "") : "",
    pickupTimeText,
    deliveryAddress: fulfillmentType === "pickup" ? "Khach tu den lay" : (deliveryInfo?.address || userProfile.addresses[0]?.detail || ""),
    paymentMethod,
    source: orderSource,
    channel: orderSource,
    platform: orderSource,
    orderSource,
    pointsEarned
  };
  const savedOrder = orderStorage.addOrder(order);
  saveCreatedOrderCustomerMarker({ order, currentPhone, saveDemoUser });
  syncCreatedOrderList({ order, currentPhone, setDemoOrdersState });
  const nextPhoneLoyalty = applyCreatedOrderLoyalty({
    order,
    pointsAmount,
    createdAt,
    promoSource,
    promoVoucherId,
    promoCode,
    pointsDiscount,
    currentPhone,
    setDemoLoyaltyState
  });
  saveCreatedOrderAddress({
    order,
    deliveryInfo,
    fulfillmentType,
    currentPhone,
    addressStorage,
    updateAddress,
    addAddress,
    setDefaultAddress,
    setDemoAddressesState
  });
  updateCreatedOrderProfile({
    savedOrder,
    totalAmount,
    deliveryInfo,
    fulfillmentType,
    nextPhoneLoyalty,
    setUserProfile,
    getMemberRank
  });
  finalizeCreatedOrderUi({ savedOrder, setCurrentOrder, setOrderStatus, setCart });
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
    pointsSpent = 0,
    pointsDiscount = 0,
    pointsDiscountAmount = pointsDiscount,
    distanceKm = null,
    lat = null,
    lng = null,
    deliveryInfo,
    fulfillmentType,
    branchInfo = null,
    pickupTimeText = "",
    paymentMethod,
    orderSource = "online",
    userProfile,
    currentPhone,
    setDemoOrdersState,
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
  const branchIdentifiers = resolveBranchIdentifiers(branchInfo, fulfillmentType);
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
    pointsSpent,
    pointsDiscount,
    pointsDiscountAmount,
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
    branchId: branchIdentifiers.branchId,
    branchUuid: branchIdentifiers.branchUuid,
    branchName: branchInfo?.name || "",
    branchAddress: branchInfo?.address || "",
    pickupBranchId: branchIdentifiers.pickupBranchId,
    pickupBranchUuid: branchIdentifiers.pickupBranchUuid,
    pickupBranchName: fulfillmentType === "pickup" ? (branchInfo?.name || "") : "",
    pickupBranchAddress: fulfillmentType === "pickup" ? (branchInfo?.address || "") : "",
    deliveryBranchId: branchIdentifiers.deliveryBranchId,
    deliveryBranchUuid: branchIdentifiers.deliveryBranchUuid,
    deliveryBranchName: fulfillmentType === "delivery" ? (branchInfo?.name || "") : "",
    deliveryBranchAddress: fulfillmentType === "delivery" ? (branchInfo?.address || "") : "",
    pickupTimeText,
    deliveryAddress: fulfillmentType === "pickup" ? "Khach tu den lay" : (deliveryInfo?.address || userProfile.addresses[0]?.detail || ""),
    paymentMethod,
    source: orderSource,
    channel: orderSource,
    platform: orderSource,
    orderSource,
    pointsEarned
  };

  const savedOrder = await orderStorage.addOrderAsync(order);
  saveCreatedOrderCustomerMarker({ order, currentPhone, saveDemoUser });
  await syncCreatedOrderListAsync({ order, currentPhone, setDemoOrdersState });
  const nextPhoneLoyalty = await applyCreatedOrderLoyaltyAsync({
    order,
    pointsAmount,
    createdAt,
    promoSource,
    promoVoucherId,
    promoCode,
    pointsSpent,
    pointsDiscount,
    currentPhone,
    setDemoLoyaltyState
  });
  saveCreatedOrderAddress({
    order,
    deliveryInfo,
    fulfillmentType,
    currentPhone,
    addressStorage,
    updateAddress,
    addAddress,
    setDefaultAddress,
    setDemoAddressesState
  });
  updateCreatedOrderProfile({
    savedOrder,
    totalAmount,
    deliveryInfo,
    fulfillmentType,
    nextPhoneLoyalty,
    setUserProfile,
    getMemberRank
  });
  finalizeCreatedOrderUi({ savedOrder, setCurrentOrder, setOrderStatus, setCart });
  return order;
}

export function reorder(order, catalogProducts = []) {
  const now = Date.now();
  const normalizeId = (value = "") =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
  const normalizeName = (value = "") =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const safeProducts = Array.isArray(catalogProducts) ? catalogProducts : [];
  const byId = new Map(
    safeProducts
      .filter((product) => product?.id)
      .map((product) => [normalizeId(product.id), product])
  );
  const byName = new Map(
    safeProducts
      .filter((product) => String(product?.name || "").trim())
      .map((product) => [normalizeName(product.name), product])
  );
  const allNamedProducts = safeProducts.filter((product) => normalizeName(product?.name || ""));

  return (order?.items || []).map((item, index) => {
    const quantity = item.quantity || 1;
    const unitTotal = item.unitTotal || Math.round((item.lineTotal || item.price || 0) / quantity);
    const normalizedItemName = normalizeName(item.name);
    const matchedById =
      byId.get(normalizeId(item.id)) ||
      byId.get(normalizeId(item.productId)) ||
      byId.get(normalizeId(item.product_id));
    const matchedByName = byName.get(normalizedItemName);
    const matchedByLooseName = matchedById || matchedByName
      ? null
      : allNamedProducts.find((product) => {
        const productName = normalizeName(product?.name || "");
        if (!productName || !normalizedItemName) return false;
        return productName.includes(normalizedItemName) || normalizedItemName.includes(productName);
      }) || null;
    const matchedProduct = matchedById || matchedByName || matchedByLooseName || null;
    const resolvedImage =
      matchedProduct?.image ||
      item.image ||
      item.thumbnail ||
      item.productImage ||
      "";
    const resolvedName = matchedProduct?.name || item.name;

    return {
      ...item,
      cartId: `${item.id || "order"}-reorder-${now}-${index}`,
      id: matchedProduct?.id || item.id,
      name: resolvedName,
      quantity,
      toppings: item.toppings || [],
      image: resolvedImage,
      unitTotal,
      lineTotal: unitTotal * quantity
    };
  });
}
