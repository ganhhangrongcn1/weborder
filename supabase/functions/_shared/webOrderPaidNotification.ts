type JsonRecord = Record<string, unknown>;

type NotificationEvent = "web_order_created" | "web_order_paid";

type NotifyOptions = {
  event?: NotificationEvent;
  paymentConfirmed?: boolean;
};

const DEFAULT_WEB_ORDER_WEBHOOK_URL = "https://n8nhosting-13007771.phoai.vn/webhook/ac55da0e-a0d8-47e5-89c7-fcaa07fb736d";
const PUBLIC_ORDER_ORIGIN = "https://ganhhangrong.vn";
const NOTIFICATION_TABLE = "web_order_notifications";
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

function getWebsiteSource(order: JsonRecord, metadata: JsonRecord) {
  return toText(
    metadata.orderSource || metadata.order_source || metadata.source || order.order_source || order.source
  ).toLowerCase();
}

function getPaymentMethod(order: JsonRecord, metadata: JsonRecord) {
  return toText(order.payment_method || metadata.paymentMethod || metadata.payment_method).toLowerCase();
}

function getPaymentStatus(metadata: JsonRecord) {
  return toText(metadata.paymentStatus || metadata.payment_status).toLowerCase();
}

function isWebsiteOrder(order: JsonRecord, metadata: JsonRecord) {
  return ["online", "website", "web"].includes(getWebsiteSource(order, metadata));
}

function isPrepaidMethod(paymentMethod: string) {
  return ["momo", "bank_qr"].includes(paymentMethod);
}

function formatPaymentMethod(paymentMethod: string, event: NotificationEvent) {
  if (paymentMethod === "momo") return event === "web_order_paid" ? "MoMo - Đã thanh toán" : "MoMo";
  if (paymentMethod === "bank_qr") return event === "web_order_paid" ? "Chuyển khoản QR - Đã thanh toán" : "Chuyển khoản QR";
  if (paymentMethod === "counter") return "Thanh toán tại quầy";
  if (["cod", "cash"].includes(paymentMethod)) return "Tiền mặt khi nhận món";
  return paymentMethod || "Tiền mặt khi nhận món";
}

async function claimNotification(
  supabase: any,
  eventKey: string,
  orderId: string,
  event: NotificationEvent
) {
  const now = new Date().toISOString();
  const { error } = await supabase.from(NOTIFICATION_TABLE).insert({
    event_key: eventKey,
    order_id: orderId,
    event_type: event,
    status: "processing",
    attempt_count: 1,
    created_at: now,
    updated_at: now
  });
  if (!error) return { claimed: true };
  if (toText(error.code) !== "23505") throw error;

  const { data: existing, error: readError } = await supabase
    .from(NOTIFICATION_TABLE)
    .select("status,sent_at,last_error")
    .eq("event_key", eventKey)
    .maybeSingle();
  if (readError) throw readError;
  return {
    claimed: false,
    status: toText(existing?.status),
    sentAt: toText(existing?.sent_at),
    lastError: toText(existing?.last_error)
  };
}

async function markNotification(
  supabase: any,
  eventKey: string,
  patch: JsonRecord
) {
  const { error } = await supabase
    .from(NOTIFICATION_TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("event_key", eventKey);
  if (error) throw error;
}

export async function notifyWebsiteOrder(
  supabase: any,
  inputOrder: JsonRecord,
  options: NotifyOptions = {}
) {
  const event = options.event || "web_order_paid";
  const orderId = toText(inputOrder.id || inputOrder.order_code);
  if (!orderId) return { ok: false, skipped: true, reason: "missing_order_id" };

  const { data: latestOrder, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !latestOrder) throw orderError || new Error("Không tìm thấy đơn website.");

  const order = latestOrder as JsonRecord;
  const metadata = getObject(order.metadata);
  if (!isWebsiteOrder(order, metadata)) {
    return { ok: false, skipped: true, reason: "not_website_order" };
  }

  const paymentMethod = getPaymentMethod(order, metadata);
  if (event === "web_order_created" && isPrepaidMethod(paymentMethod)) {
    return { ok: false, skipped: true, reason: "prepaid_waiting_payment" };
  }
  if (event === "web_order_paid" && !isPrepaidMethod(paymentMethod)) {
    return { ok: false, skipped: true, reason: "not_prepaid_order" };
  }
  if (
    event === "web_order_paid" &&
    !options.paymentConfirmed &&
    getPaymentStatus(metadata) !== "paid"
  ) {
    return { ok: false, skipped: true, reason: "payment_not_confirmed" };
  }
  if (toText(metadata.zaloNotifiedAt || metadata.zalo_notified_at)) {
    return { ok: true, skipped: true, reason: "already_notified_legacy" };
  }

  const eventKey = `${orderId}:${event === "web_order_paid" ? "payment_paid" : "web_order_created"}`;
  const claim = await claimNotification(supabase, eventKey, orderId, event);
  if (!claim.claimed) {
    return {
      ok: claim.status === "sent",
      skipped: true,
      reason: claim.status === "sent" ? "already_notified" : "notification_already_recorded",
      status: claim.status,
      sentAt: claim.sentAt
    };
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
    payment_method: formatPaymentMethod(paymentMethod, event),
    map_link: mapLink,
    distance_km: !isPickup && toNumber(order.distance_km ?? metadata.distanceKm) > 0 ? `${toNumber(order.distance_km ?? metadata.distanceKm).toFixed(1)}km` : "",
    address: isPickup ? [branchName, branchAddress].filter(Boolean).join(" - ") : deliveryAddress,
    note: toText(metadata.note),
    order_link: `${PUBLIC_ORDER_ORIGIN}/orders?orderCode=${encodeURIComponent(orderCode)}`
  });

  const payload = {
    event,
    eventKey,
    source: getWebsiteSource(order, metadata) || "online",
    status: toText(order.status) || (event === "web_order_paid" ? "preparing" : "new"),
    statusText: event === "web_order_paid" ? "Đơn web đã thanh toán" : "Đơn mới từ web",
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
    paymentMethod,
    paymentStatus: event === "web_order_paid" ? "paid" : getPaymentStatus(metadata) || "pending",
    items,
    zaloMessage,
    raw: { ...metadata, ...order, metadata }
  };
  const body = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value ?? ""));
  });

  try {
    const webhookUrl = toText(Deno.env.get("WEB_ORDER_WEBHOOK_URL")) || DEFAULT_WEB_ORDER_WEBHOOK_URL;
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body
    });
    if (!response.ok) throw new Error(`Webhook Zalo trả về HTTP ${response.status}.`);

    const sentAt = new Date().toISOString();
    await markNotification(supabase, eventKey, {
      status: "sent",
      sent_at: sentAt,
      webhook_status: response.status,
      last_error: null
    });
    return { ok: true, skipped: false, eventKey, sentAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không gửi được webhook Zalo.";
    await markNotification(supabase, eventKey, {
      status: "failed",
      failed_at: new Date().toISOString(),
      last_error: message
    });
    throw error;
  }
}

export async function notifyPaidWebsiteOrder(
  supabase: any,
  inputOrder: JsonRecord,
  options: Omit<NotifyOptions, "event"> = {}
) {
  return notifyWebsiteOrder(supabase, inputOrder, {
    ...options,
    event: "web_order_paid"
  });
}
