type JsonRecord = Record<string, unknown>;

const DEFAULT_WEB_ORDER_WEBHOOK_URL = "https://n8nhosting-13007771.phoai.vn/webhook/ac55da0e-a0d8-47e5-89c7-fcaa07fb736d";
const PUBLIC_ORDER_ORIGIN = "https://ganhhangrong.vn";
const DEFAULT_ZALO_TEMPLATE = `🧡 GÁNH HÀNG RONG ĐÃ NHẬN ĐƠN

🔖 Mã đơn: {{order_code}}
🕒 Thời gian đặt: {{order_time}}
📦 Hình thức nhận: {{fulfillment_type}}
⏰ Giờ lấy dự kiến: {{pickup_time}}
💳 Thanh toán: {{payment_method}}

👤 {{customer_name}} - {{phone}}
📍 {{address}}
🗺️ Bản đồ: {{map_link}}

🍽️ MÓN ĐÃ ĐẶT
{{items}}

💰 Tạm tính: {{subtotal}}
🚚 Phí giao hàng: {{shipping_fee}}
🎁 Ưu đãi: -{{promo_discount}}
⭐ Dùng điểm thưởng: -{{points_discount}}
✅ TỔNG THANH TOÁN: {{total}}
📝 Ghi chú: {{note}}

🔎 Theo dõi đơn hàng: {{order_link}}

Quán sẽ chuẩn bị món ngay. Cảm ơn bạn đã đặt món tại Gánh Hàng Rong 🧡`;

function toText(value: unknown = "") {
  return String(value ?? "").trim();
}

function toNumber(value: unknown = 0) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function getArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as JsonRecord[] : [];
}

function formatMoney(value: unknown) {
  return `${Math.round(toNumber(value)).toLocaleString("vi-VN")} đ`;
}

function formatDateTime(value: unknown) {
  const date = new Date(toText(value) || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function renderTemplate(template: string, data: Record<string, string>) {
  return template
    .split("\n")
    .filter((line) => {
      const keys = [...line.matchAll(/{{(\w+)}}/g)].map((match) => match[1]);
      return !keys.length || keys.every((key) => toText(data[key]));
    })
    .map((line) => Object.entries(data).reduce(
      (nextLine, [key, value]) => nextLine.replaceAll(`{{${key}}}`, value),
      line
    ))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildItemsText(items: JsonRecord[]) {
  if (!items.length) return "Không có món";
  return items.map((item, index) => {
    const quantity = Math.max(1, Math.round(toNumber(item.quantity || 1)));
    const lineTotal = toNumber(item.lineTotal ?? item.line_total);
    const note = toText(item.note);
    const spice = toText(item.spice);
    const details = [spice, note].filter(Boolean).join(", ");
    return `${index + 1}. ${toText(item.name || item.product_name)} x${quantity}${details ? ` (${details})` : ""} - ${formatMoney(lineTotal)}`;
  }).join("\n");
}

function isWebsitePrepaidOrder(order: JsonRecord, metadata: JsonRecord) {
  const source = toText(
    metadata.orderSource || metadata.order_source || metadata.source || order.order_source || order.source
  ).toLowerCase();
  const paymentMethod = toText(order.payment_method || metadata.paymentMethod || metadata.payment_method).toLowerCase();
  return ["online", "website", "web"].includes(source) && ["momo", "bank_qr"].includes(paymentMethod);
}

export async function notifyPaidWebsiteOrder(supabase: any, inputOrder: JsonRecord) {
  const orderId = toText(inputOrder.id || inputOrder.order_code);
  if (!orderId) return { ok: false, skipped: true, reason: "missing_order_id" };

  const { data: latestOrder, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !latestOrder) throw orderError || new Error("Không tìm thấy đơn đã thanh toán.");

  const order = latestOrder as JsonRecord;
  const metadata = getObject(order.metadata);
  if (!isWebsitePrepaidOrder(order, metadata)) {
    return { ok: false, skipped: true, reason: "not_website_prepaid" };
  }
  if (toText(metadata.zaloNotifiedAt || metadata.zalo_notified_at)) {
    return { ok: true, skipped: true, reason: "already_notified" };
  }

  const items = getArray(metadata.items);
  const isPickup = toText(order.fulfillment_type || metadata.fulfillmentType).toLowerCase() === "pickup";
  const orderCode = toText(order.order_code || metadata.orderCode || order.id);
  const branchName = toText(order.branch_name || metadata.branchName);
  const branchAddress = toText(order.branch_address || metadata.branchAddress);
  const deliveryAddress = toText(order.delivery_address || metadata.deliveryAddress);
  const lat = toText(order.lat || metadata.lat);
  const lng = toText(order.lng || metadata.lng);
  const mapLink = !isPickup && lat && lng
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : !isPickup && deliveryAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress)}`
      : "";
  const totalAmount = toNumber(order.total_amount ?? metadata.totalAmount ?? metadata.total);
  const zaloMessage = renderTemplate(DEFAULT_ZALO_TEMPLATE, {
    customer_name: toText(order.customer_name || metadata.customerName || metadata.orderCustomerName) || "Khách",
    phone: toText(order.customer_phone || metadata.customerPhone || metadata.phone),
    items: buildItemsText(items),
    total: formatMoney(totalAmount),
    subtotal: formatMoney(order.subtotal ?? metadata.subtotal),
    shipping_fee: isPickup ? formatMoney(0) : formatMoney(order.shipping_fee ?? metadata.shippingFee),
    promo_discount: toNumber(order.promo_discount ?? metadata.promoDiscount) > 0 ? formatMoney(order.promo_discount ?? metadata.promoDiscount) : "",
    points_discount: toNumber(order.points_discount ?? metadata.pointsDiscount) > 0 ? formatMoney(order.points_discount ?? metadata.pointsDiscount) : "",
    order_code: orderCode,
    order_time: formatDateTime(order.created_at || metadata.createdAt),
    pickup_time: isPickup ? toText(order.pickup_time_text || metadata.pickupTimeText) : "",
    fulfillment_type: isPickup ? "Đến lấy tại quán" : "Giao tận nơi",
    pickup_branch: isPickup ? [branchName, branchAddress].filter(Boolean).join(" - ") : "",
    delivery_branch: !isPickup ? [branchName, branchAddress].filter(Boolean).join(" - ") : "",
    payment_method: toText(order.payment_method).toLowerCase() === "momo"
      ? "MoMo - Đã thanh toán"
      : "Chuyển khoản QR - Đã thanh toán",
    map_link: mapLink,
    distance_km: !isPickup && toNumber(order.distance_km ?? metadata.distanceKm) > 0 ? `${toNumber(order.distance_km ?? metadata.distanceKm).toFixed(1)}km` : "",
    address: isPickup ? [branchName, branchAddress].filter(Boolean).join(" - ") : deliveryAddress,
    note: toText(metadata.note),
    order_link: `${PUBLIC_ORDER_ORIGIN}/orders?orderCode=${encodeURIComponent(orderCode)}`
  });

  const payload = {
    event: "web_order_paid",
    eventKey: `${orderId}:payment_paid`,
    source: toText(metadata.orderSource || metadata.source) || "online",
    status: toText(order.status) || "preparing",
    statusText: "Đơn web đã thanh toán",
    orderCode,
    orderId,
    createdAt: toText(order.created_at || metadata.createdAt),
    createdAtLocal: formatDateTime(order.created_at || metadata.createdAt),
    customerName: toText(order.customer_name || metadata.customerName),
    customerPhone: toText(order.customer_phone || metadata.customerPhone || metadata.phone),
    fulfillmentType: toText(order.fulfillment_type || metadata.fulfillmentType),
    pickupTimeText: toText(order.pickup_time_text || metadata.pickupTimeText),
    branchId: toText(order.branch_id || metadata.branchId),
    branchName,
    branchAddress,
    deliveryAddress,
    deliveryLat: lat,
    deliveryLng: lng,
    distanceKm: toNumber(order.distance_km ?? metadata.distanceKm),
    subtotal: toNumber(order.subtotal ?? metadata.subtotal),
    shippingFee: toNumber(order.shipping_fee ?? metadata.shippingFee),
    promoDiscount: toNumber(order.promo_discount ?? metadata.promoDiscount),
    pointsDiscount: toNumber(order.points_discount ?? metadata.pointsDiscount),
    totalAmount,
    paymentMethod: toText(order.payment_method || metadata.paymentMethod),
    paymentStatus: "paid",
    items,
    zaloMessage,
    raw: { ...metadata, ...order, metadata }
  };
  const body = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value ?? ""));
  });

  const webhookUrl = toText(Deno.env.get("WEB_ORDER_WEBHOOK_URL")) || DEFAULT_WEB_ORDER_WEBHOOK_URL;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body
  });
  if (!response.ok) throw new Error(`Webhook Zalo trả về HTTP ${response.status}.`);

  const notifiedAt = new Date().toISOString();
  const { error: markError } = await supabase
    .from("orders")
    .update({
      metadata: {
        ...metadata,
        zaloNotificationEvent: "web_order_paid",
        zaloNotifiedAt: notifiedAt
      },
      updated_at: notifiedAt
    })
    .eq("id", orderId);
  if (markError) throw markError;

  return { ok: true, skipped: false, notifiedAt };
}
