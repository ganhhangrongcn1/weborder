import { formatMoney } from "../utils/format.js";
import { getOrderItemOptionLabels } from "../utils/orderItemDisplay.js";
import { loadZaloConfigAsync, renderZaloTemplate } from "./zaloService.js";

const WEB_ORDER_WEBHOOK_URL = "https://n8nhosting-13007771.phoai.vn/webhook/ac55da0e-a0d8-47e5-89c7-fcaa07fb736d";
const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toFormBody(payload) {
  const body = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      body.set(key, "");
      return;
    }

    body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  });
  return body;
}

function formatVietnamDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function buildOrderItemsText(orderItems = []) {
  if (!orderItems.length) return "Kh\u00f4ng c\u00f3 m\u00f3n";
  return orderItems.map((item, index) => {
    const options = getOrderItemOptionLabels(item, { includeQuantity: true, includeNote: true }).join(", ");
    return `${index + 1}. ${item.name} x${item.quantity}${options ? ` (${options})` : ""} - ${formatMoney(Number(item.lineTotal || 0))}`;
  }).join("\n");
}

function buildOrderLink(orderCode = "") {
  const code = String(orderCode || "").trim();
  if (!code) return "";
  return `/orders?orderCode=${encodeURIComponent(code)}`;
}

function buildMapLink(order = {}) {
  if (order?.lat && order?.lng) return `https://www.google.com/maps?q=${order.lat},${order.lng}`;
  if (order?.deliveryAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`;
  }
  return "";
}

export async function buildWebOrderZaloMessage(order = {}) {
  const orderCode = String(order.orderCode || order.id || "").trim();
  const isPickup = String(order.fulfillmentType || "").toLowerCase() === "pickup";
  const config = await loadZaloConfigAsync();
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = toNumber(order.subtotal, items.reduce((sum, item) => sum + toNumber(item.lineTotal), 0));
  const shippingFee = toNumber(order.shippingFee ?? order.deliveryFee, 0);
  const promoDiscount = toNumber(order.promoDiscount, 0);
  const pointsDiscount = toNumber(order.pointsDiscount, 0);
  const total = toNumber(order.totalAmount ?? order.total, subtotal);

  return renderZaloTemplate(config.template, {
    customer_name: order.customerName || order.orderCustomerName || "Kh\u00e1ch",
    phone: order.customerPhone || order.rawCustomerPhone || order.phone || "",
    items: buildOrderItemsText(items),
    total: formatMoney(total),
    subtotal: formatMoney(subtotal),
    shipping_fee: isPickup ? "Kh\u00f4ng t\u00ednh ph\u00ed giao h\u00e0ng" : formatMoney(shippingFee),
    promo_discount: promoDiscount > 0 ? formatMoney(promoDiscount) : "",
    points_discount: pointsDiscount > 0 ? formatMoney(pointsDiscount) : "",
    order_code: orderCode,
    order_time: order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : new Date().toLocaleString("vi-VN"),
    pickup_time: isPickup ? order.pickupTimeText || "" : "",
    fulfillment_type: isPickup ? "\u0110\u1ebfn l\u1ea5y" : "Giao t\u1eadn n\u01a1i",
    pickup_branch: [order.pickupBranchName || order.branchName || "", order.pickupBranchAddress || order.branchAddress || ""].filter(Boolean).join(" - "),
    delivery_branch: [order.deliveryBranchName || "", order.deliveryBranchAddress || ""].filter(Boolean).join(" - "),
    payment_method: order.paymentMethod || "COD",
    map_link: isPickup ? "" : buildMapLink(order),
    distance_km: !isPickup && order.distanceKm ? `${Number(order.distanceKm).toFixed(1)}km` : "",
    address: isPickup ? order.branchAddress || order.branchName || "" : order.deliveryAddress || "",
    note: order.note || "",
    order_link: buildOrderLink(orderCode)
  });
}

export async function notifyWebOrderWebhook({ order } = {}) {
  if (!WEB_ORDER_WEBHOOK_URL || !order) return { ok: false, skipped: true };

  const zaloMessage = await buildWebOrderZaloMessage(order);
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const payload = {
    event: "web_order_created",
    source: order.orderSource || order.source || "online",
    status: order.status || "new",
    statusText: "\u0110\u01a1n m\u1edbi t\u1eeb web",
    orderCode: order.orderCode || order.id || "",
    orderId: order.id || order.orderCode || "",
    createdAt: createdAt.toISOString(),
    createdAtLocal: formatVietnamDateTime(createdAt),
    customerName: order.customerName || order.orderCustomerName || "",
    customerPhone: order.customerPhone || order.rawCustomerPhone || order.phone || "",
    fulfillmentType: order.fulfillmentType || "delivery",
    pickupTimeText: order.pickupTimeText || "",
    branchId: order.branchId || "",
    branchName: order.branchName || order.pickupBranchName || order.deliveryBranchName || "",
    branchAddress: order.branchAddress || order.pickupBranchAddress || order.deliveryBranchAddress || "",
    deliveryAddress: order.deliveryAddress || "",
    deliveryLat: order.lat ?? "",
    deliveryLng: order.lng ?? "",
    distanceKm: order.distanceKm ?? "",
    subtotal: toNumber(order.subtotal),
    shippingFee: toNumber(order.shippingFee ?? order.deliveryFee),
    promoDiscount: toNumber(order.promoDiscount),
    pointsDiscount: toNumber(order.pointsDiscount),
    totalAmount: toNumber(order.totalAmount ?? order.total),
    paymentMethod: order.paymentMethod || "COD",
    items: order.items || [],
    zaloMessage,
    raw: order
  };

  await fetch(WEB_ORDER_WEBHOOK_URL, {
    method: "POST",
    mode: "no-cors",
    body: toFormBody(payload)
  });

  return { ok: true };
}

export default {
  buildWebOrderZaloMessage,
  notifyWebOrderWebhook
};
