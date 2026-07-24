import { getCustomerKey } from "./storageService.js";
import { orderRepository } from "./repositories/orderRepository.js";
import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";
import { composeMemberLoyaltySnapshot } from "./memberLoyaltySnapshotService.js";
import { applyOrderLoyaltyAsync, calculateOrderPoints, getLoyaltyRuleConfigAsync } from "./loyaltyService.js";
import { validateCheckoutVoucherBeforeOrder } from "./checkoutOrderService.js";
import { notifyWebOrderWebhook } from "./orderNotificationService.js";
import {
  createCustomerOrderActionProof,
  saveCustomerOrderActionToken
} from "./customerOrderActionService.js";

function resolveBranchIdentifiers(branchInfo = null, fulfillmentType = "") {
  const branchId = String(
    branchInfo?.id ||
      branchInfo?.branchId ||
      branchInfo?.legacyId ||
      branchInfo?.legacy_id ||
      branchInfo?.branch_code ||
      branchInfo?.branchCode ||
      branchInfo?.slug ||
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
    const { nextByPhone, updatedOrder } = patchOrderInPhoneMap(allByPhone, orderId, patch);
    this.saveAll(nextByPhone);
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

async function syncCreatedOrderListAsync({ order, currentPhone, setDemoOrdersState }) {
  if (!isCurrentOrderPhone(currentPhone, order.phone)) return;
  const latestOrders = await orderStorage.getByPhoneAsync(order.phone, { limit: 5 });
  setDemoOrdersState(latestOrders);
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
  setOrderStatus(savedOrder?.status || "new");
  setCart([]);
}

function createCustomerOrderIdentity(now = new Date()) {
  const timestamp = now.getTime();
  const pad = (value) => String(value).padStart(2, "0");
  const datePart = [
    String(now.getFullYear()).slice(-2),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("");
  const timePart = [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
  let randomPart = "";
  try {
    const randomValues = new Uint16Array(1);
    globalThis.crypto.getRandomValues(randomValues);
    randomPart = String(randomValues[0] % 1000).padStart(3, "0");
  } catch {
    randomPart = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  }

  return {
    orderCode: `GHR${datePart}${timePart}${randomPart}`,
    displayOrderCode: `GHR-${String(timestamp).slice(-4)}`
  };
}

const CHECKOUT_ORDER_ATTEMPT_KEY = "ghr_checkout_order_attempt_v1";
const CHECKOUT_ORDER_ATTEMPT_TTL_MS = 20 * 60 * 1000;
const CHECKOUT_PRECHECK_TIMEOUT_MS = 8000;
const CHECKOUT_PROOF_TIMEOUT_MS = 5000;
let checkoutOrderAttemptMemory = null;

function createCheckoutOrderTimeoutError(stage = "unknown") {
  const error = new Error("checkout_order_timeout");
  error.code = "CHECKOUT_ORDER_TIMEOUT";
  error.stage = stage;
  return error;
}

function withCheckoutStepTimeout(task, stage, timeoutMs) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(createCheckoutOrderTimeoutError(stage)), timeoutMs);
  });
  return Promise.race([Promise.resolve().then(task), timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function buildCheckoutAttemptFingerprint({
  cart = [],
  totalAmount = 0,
  deliveryInfo = {},
  fulfillmentType = "",
  branchInfo = null,
  pickupTimeText = "",
  paymentMethod = ""
}) {
  const items = (Array.isArray(cart) ? cart : []).map((item) => ({
    id: String(item?.id || item?.productId || item?.product_id || ""),
    cartId: String(item?.cartId || ""),
    quantity: Number(item?.quantity || 0),
    lineTotal: Number(item?.lineTotal || 0),
    note: String(item?.note || ""),
    options: Array.isArray(item?.options) ? item.options : [],
    toppings: Array.isArray(item?.toppings) ? item.toppings : []
  }));
  return JSON.stringify({
    items,
    totalAmount: Number(totalAmount || 0),
    phone: getCustomerKey(deliveryInfo?.phone || ""),
    fulfillmentType: String(fulfillmentType || ""),
    branchId: String(branchInfo?.branchUuid || branchInfo?.id || branchInfo?.branchId || ""),
    pickupTimeText: String(pickupTimeText || ""),
    paymentMethod: String(paymentMethod || "").toLowerCase()
  });
}

function readCheckoutOrderAttempt() {
  if (typeof window === "undefined") return checkoutOrderAttemptMemory;
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_ORDER_ATTEMPT_KEY);
    return raw ? JSON.parse(raw) : checkoutOrderAttemptMemory;
  } catch {
    return checkoutOrderAttemptMemory;
  }
}

function saveCheckoutOrderAttempt(attempt) {
  checkoutOrderAttemptMemory = attempt;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHECKOUT_ORDER_ATTEMPT_KEY, JSON.stringify(attempt));
  } catch {
    // Giữ bản trong bộ nhớ khi trình duyệt nhúng chặn sessionStorage.
  }
}

function getOrCreateCheckoutOrderAttempt(params) {
  const fingerprint = buildCheckoutAttemptFingerprint(params);
  const existing = readCheckoutOrderAttempt();
  const createdAtMs = Date.parse(existing?.createdAt || "");
  const isReusable =
    existing?.fingerprint === fingerprint &&
    existing?.orderCode &&
    Number.isFinite(createdAtMs) &&
    Date.now() - createdAtMs < CHECKOUT_ORDER_ATTEMPT_TTL_MS;
  if (isReusable) return existing;

  const createdAtDate = new Date();
  const identity = createCustomerOrderIdentity(createdAtDate);
  const attempt = {
    ...identity,
    createdAt: createdAtDate.toISOString(),
    fingerprint
  };
  saveCheckoutOrderAttempt(attempt);
  return attempt;
}

function clearCheckoutOrderAttempt(orderCode = "") {
  const existing = readCheckoutOrderAttempt();
  if (orderCode && existing?.orderCode && String(existing.orderCode) !== String(orderCode)) return;
  checkoutOrderAttemptMemory = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CHECKOUT_ORDER_ATTEMPT_KEY);
  } catch {
    // noop
  }
}

function isDuplicateOrderIdentityError(error) {
  if (String(error?.code || "") !== "23505") return false;
  const detail = [
    error?.message,
    error?.details,
    error?.hint,
    error?.constraint
  ].filter(Boolean).join(" ").toLowerCase();
  return detail.includes("orders_pkey") || detail.includes("order_code");
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
  const checkoutAttempt = getOrCreateCheckoutOrderAttempt({
    cart,
    totalAmount,
    deliveryInfo,
    fulfillmentType,
    branchInfo,
    pickupTimeText,
    paymentMethod
  });
  const createdAt = checkoutAttempt.createdAt;
  const { orderCode, displayOrderCode } = checkoutAttempt;
  const subtotalAmount = Number(
    subtotal ?? cart.reduce((sum, item) => sum + Number(item?.lineTotal || 0), 0)
  );
  const [validatedVoucher, loyaltyRule] = await Promise.all([
    withCheckoutStepTimeout(
      () => validateCheckoutVoucherBeforeOrder({
        orderId: orderCode,
        customerPhone: deliveryInfo?.phone || userProfile.phone,
        subtotal: subtotalAmount,
        promoDiscount,
        promoCode,
        promoSource,
        promoVoucherId,
        at: createdAt
      }),
      "voucher",
      CHECKOUT_PRECHECK_TIMEOUT_MS
    ),
    withCheckoutStepTimeout(
      () => getLoyaltyRuleConfigAsync(),
      "loyalty_config",
      CHECKOUT_PRECHECK_TIMEOUT_MS
    )
  ]);
  const appliedPromoDiscount = validatedVoucher.promoDiscount;
  const appliedPromoCode = validatedVoucher.promoCode;
  const appliedPromoSource = validatedVoucher.promoSource;
  const appliedPromoVoucherId = validatedVoucher.promoVoucherId;
  const pointsAmount = Number(
    pointsBaseAmount ?? Math.max(subtotalAmount - Number(appliedPromoDiscount || 0), 0)
  );
  const pointsEarned = calculateOrderPoints(pointsAmount, loyaltyRule);
  const branchIdentifiers = resolveBranchIdentifiers(branchInfo, fulfillmentType);
  const normalizedPaymentMethod = String(paymentMethod || "").trim().toLowerCase();
  const isPrepaidPayment = ["bank_qr", "momo"].includes(normalizedPaymentMethod);
  const customerActionProof = isPrepaidPayment
    ? await withCheckoutStepTimeout(
        () => createCustomerOrderActionProof(),
        "customer_action_proof",
        CHECKOUT_PROOF_TIMEOUT_MS
      )
    : null;
  const initialOrderStatus = isPrepaidPayment ? "pending_payment" : "preparing";
  const initialKitchenStatus = isPrepaidPayment ? "waiting_payment" : "pending";
  let order = {
    id: orderCode,
    orderCode,
    displayOrderCode,
    phone: getCustomerKey(deliveryInfo?.phone || userProfile.phone),
    customerPhoneKey: getCustomerKey(deliveryInfo?.phone || userProfile.phone),
    rawCustomerPhone: deliveryInfo?.phone || userProfile.phone || "",
    items: cart,
    subtotal: subtotalAmount,
    pointsBaseAmount: pointsAmount,
    shippingFee,
    originalShippingFee,
    shippingSupportDiscount,
    promoDiscount: appliedPromoDiscount,
    promoCode: appliedPromoCode,
    promoSource: appliedPromoSource,
    promoVoucherId: appliedPromoVoucherId,
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
    status: initialOrderStatus,
    kitchenStatus: initialKitchenStatus,
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
    deliveryAddress: fulfillmentType === "pickup" ? "Khách tự đến lấy" : (deliveryInfo?.address || userProfile.addresses[0]?.detail || ""),
    paymentMethod,
    paymentStatus: isPrepaidPayment ? "unpaid" : "pending",
    paymentReference: isPrepaidPayment ? orderCode : "",
    paymentAmount: totalAmount,
    customerActionTokenHash: customerActionProof?.tokenHash || "",
    source: orderSource,
    channel: orderSource,
    platform: orderSource,
    orderSource,
    pointsEarned
  };

  let savedOrder;
  try {
    savedOrder = await orderStorage.addOrderAsync(order);
  } catch (error) {
    if (!isDuplicateOrderIdentityError(error)) throw error;
    const retryIdentity = createCustomerOrderIdentity(new Date(Date.now() + 1));
    order = {
      ...order,
      id: retryIdentity.orderCode,
      orderCode: retryIdentity.orderCode,
      displayOrderCode: retryIdentity.displayOrderCode,
      paymentReference: isPrepaidPayment ? retryIdentity.orderCode : ""
    };
    savedOrder = await orderStorage.addOrderAsync(order);
  }
  if (customerActionProof?.token) {
    saveCustomerOrderActionToken(savedOrder?.id || savedOrder?.orderCode || order.orderCode, customerActionProof.token);
  }
  clearCheckoutOrderAttempt(checkoutAttempt.orderCode);
  notifyWebOrderWebhook({ order: savedOrder }).catch((error) => {
    console.warn("[order] web order webhook failed", error);
  });
  saveCreatedOrderCustomerMarker({ order, currentPhone, saveDemoUser });
  finalizeCreatedOrderUi({ savedOrder, setCurrentOrder, setOrderStatus, setCart });
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

  syncCreatedOrderListAsync({ order, currentPhone, setDemoOrdersState }).catch((error) => {
    console.warn("[order] post-create order list sync failed", error);
  });
  applyCreatedOrderLoyaltyAsync({
    order,
    pointsAmount,
    createdAt,
    promoSource: appliedPromoSource,
    promoVoucherId: appliedPromoVoucherId,
    promoCode: appliedPromoCode,
    pointsSpent,
    pointsDiscount,
    currentPhone,
    setDemoLoyaltyState
  })
    .then((nextPhoneLoyalty) => {
      updateCreatedOrderProfile({
        savedOrder,
        totalAmount,
        deliveryInfo,
        fulfillmentType,
        nextPhoneLoyalty,
        setUserProfile,
        getMemberRank
      });
    })
    .catch((error) => {
      console.warn("[order] post-create loyalty sync failed", error);
    });

  return savedOrder;
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

  return (order?.items || []).filter((item) => !item?.autoGiftByPromo).map((item, index) => {
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
    const safeProduct = matchedProduct
      ? { ...matchedProduct }
      : {
          id: item.id || item.productId || item.product_id,
          productId: item.productId || item.product_id || item.id,
          name: resolvedName,
          image: resolvedImage,
          category: item.category || "",
          price: Number(item.price ?? unitTotal ?? 0),
          originalPrice: Number(item.originalPrice || item.price || 0)
        };

    return {
      ...safeProduct,
      cartId: `${item.id || "order"}-reorder-${now}-${index}`,
      id: matchedProduct?.id || item.id || item.productId || item.product_id,
      name: resolvedName,
      quantity,
      spice: item.spice || "",
      toppings: item.toppings || [],
      note: item.note || "",
      image: resolvedImage,
      unitTotal,
      lineTotal: unitTotal * quantity
    };
  });
}
