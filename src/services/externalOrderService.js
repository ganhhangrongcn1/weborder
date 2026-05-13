import { addAddress, setDefaultAddress, addressStorage } from "./addressService.js";
import { applyOrderLoyalty, calculateOrderPoints, getLoyaltyRuleConfig } from "./loyaltyService.js";
import { orderStorage } from "./orderService.js";
import { getCustomerKey } from "./storageService.js";

function normalizeItems(items = []) {
  return (items || []).map((item, index) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitTotal = Number(item.unitTotal ?? item.price ?? item.unitPrice ?? 0);
    return {
      id: String(item.id || item.productId || `external-item-${index}`),
      name: String(item.name || item.productName || "Món"),
      quantity,
      price: unitTotal,
      unitTotal,
      lineTotal: Number(item.lineTotal ?? unitTotal * quantity),
      spice: item.spice || "",
      note: item.note || "",
      toppings: Array.isArray(item.toppings) ? item.toppings : [],
      optionGroups: Array.isArray(item.optionGroups) ? item.optionGroups : []
    };
  });
}

function buildExternalOrder(payload = {}) {
  const createdAt = payload.createdAt || new Date().toISOString();
  const orderCode = String(payload.orderCode || payload.id || `GHR-${Date.now().toString().slice(-4)}`);
  const phoneKey = getCustomerKey(payload.customerPhone || payload.phone || payload.rawCustomerPhone || "");
  const items = normalizeItems(payload.items || []);
  const subtotal = Number(payload.subtotal ?? items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
  const shippingFee = Number(payload.shippingFee ?? payload.deliveryFee ?? 0);
  const promoDiscount = Number(payload.promoDiscount || 0);
  const pointsDiscount = Number(payload.pointsDiscount || 0);
  const totalAmount = Number(payload.totalAmount ?? payload.total ?? Math.max(subtotal + shippingFee - promoDiscount - pointsDiscount, 0));
  const pointsBaseAmount = Number(payload.pointsBaseAmount ?? subtotal - promoDiscount);
  const pointsEarned = calculateOrderPoints(pointsBaseAmount, getLoyaltyRuleConfig());
  const fulfillmentType = String(payload.fulfillmentType || "delivery").toLowerCase() === "pickup" ? "pickup" : "delivery";

  return {
    id: orderCode,
    orderCode,
    source: payload.source || "external",
    phone: phoneKey,
    customerPhoneKey: phoneKey,
    rawCustomerPhone: payload.rawCustomerPhone || payload.customerPhone || payload.phone || "",
    customerPhone: payload.customerPhone || payload.phone || phoneKey,
    customerName: payload.customerName || payload.name || "Khách",
    orderCustomerName: payload.orderCustomerName || payload.customerName || payload.name || "Khách",
    items,
    subtotal,
    pointsBaseAmount,
    shippingFee,
    originalShippingFee: Number(payload.originalShippingFee ?? shippingFee),
    shippingSupportDiscount: Number(payload.shippingSupportDiscount || 0),
    promoDiscount,
    promoCode: payload.promoCode || "",
    promoSource: payload.promoSource || "",
    promoVoucherId: payload.promoVoucherId || "",
    pointsDiscount,
    deliveryFee: shippingFee,
    total: totalAmount,
    totalAmount,
    pointsEarned,
    distanceKm: payload.distanceKm ?? null,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
    createdAt,
    status: payload.status || "pending_zalo",
    fulfillmentType,
    paymentMethod: payload.paymentMethod || "COD",
    branchId: payload.branchId || payload.branchInfo?.id || "",
    branchName: payload.branchName || payload.branchInfo?.name || "",
    branchAddress: payload.branchAddress || payload.branchInfo?.address || "",
    pickupBranchId: fulfillmentType === "pickup" ? (payload.pickupBranchId || payload.branchId || payload.branchInfo?.id || "") : "",
    pickupBranchName: fulfillmentType === "pickup" ? (payload.pickupBranchName || payload.branchName || payload.branchInfo?.name || "") : "",
    pickupBranchAddress: fulfillmentType === "pickup" ? (payload.pickupBranchAddress || payload.branchAddress || payload.branchInfo?.address || "") : "",
    deliveryBranchId: fulfillmentType === "delivery" ? (payload.deliveryBranchId || payload.branchId || payload.branchInfo?.id || "") : "",
    deliveryBranchName: fulfillmentType === "delivery" ? (payload.deliveryBranchName || payload.branchName || payload.branchInfo?.name || "") : "",
    deliveryBranchAddress: fulfillmentType === "delivery" ? (payload.deliveryBranchAddress || payload.branchAddress || payload.branchInfo?.address || "") : "",
    pickupTimeText: payload.pickupTimeText || "",
    deliveryAddress: fulfillmentType === "pickup" ? "Khach tu den lay" : (payload.deliveryAddress || payload.address || ""),
    note: payload.note || payload.customerNote || ""
  };
}

function saveExternalAddress(order) {
  if (order.fulfillmentType === "pickup" || !order.deliveryAddress || !order.phone) return;
  const current = addressStorage.getAll(order.phone);
  const existing = current.find((address) => String(address.address || "").trim().toLowerCase() === String(order.deliveryAddress || "").trim().toLowerCase());
  if (existing) return;
  const next = addAddress(current, {
    label: "Giao gần nhất",
    receiverName: order.orderCustomerName || order.customerName,
    phone: order.phone,
    address: order.deliveryAddress,
    lat: order.lat,
    lng: order.lng,
    distanceKm: order.distanceKm,
    deliveryFee: order.shippingFee,
    isDefault: true
  });
  addressStorage.saveAll(setDefaultAddress(next, next[0].id), order.phone);
}

export function createOrderFromExternalSource(payload = {}) {
  const order = buildExternalOrder(payload);
  if (!order.phone) return null;
  const savedOrder = orderStorage.addOrder(order);
  applyOrderLoyalty({
    phone: order.phone,
    orderId: order.orderCode,
    amount: order.pointsBaseAmount,
    createdAt: order.createdAt,
    promoSource: order.promoSource,
    promoVoucherId: order.promoVoucherId,
    promoCode: order.promoCode,
    pointsDiscount: Number(order.pointsDiscount || 0),
    orderStatus: order.status
  });
  saveExternalAddress(order);
  return savedOrder;
}

export default createOrderFromExternalSource;
