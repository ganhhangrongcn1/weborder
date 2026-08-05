import { zaloConfigRepository } from "./repositories/zaloConfigRepository.js";

export const DEFAULT_ZALO_TEMPLATE = [
  "🧡 GÁNH HÀNG RONG ĐÃ NHẬN ĐƠN",
  "",
  "🔖 Mã đơn: {{order_code}}",
  "🕒 Thời gian đặt: {{order_time}}",
  "📦 Hình thức nhận: {{fulfillment_type}}",
  "⏰ Giờ lấy dự kiến: {{pickup_time}}",
  "💳 Thanh toán: {{payment_method}}",
  "",
  "👤 {{customer_name}} - {{phone}}",
  "📍 {{address}}",
  "🗺️ Bản đồ: {{map_link}}",
  "",
  "🍽️ MÓN ĐÃ ĐẶT",
  "{{items}}",
  "",
  "💰 Tạm tính: {{subtotal}}",
  "🚚 Phí giao hàng: {{shipping_fee}}",
  "🎁 Ưu đãi: -{{promo_discount}}",
  "⭐ Dùng điểm thưởng: -{{points_discount}}",
  "✅ TỔNG THANH TOÁN: {{total}}",
  "📝 Ghi chú: {{note}}",
  "",
  "🔎 Theo dõi đơn hàng: {{order_link}}",
  "",
  "Quán sẽ chuẩn bị món ngay. Cảm ơn bạn đã đặt món tại Gánh Hàng Rong 🧡"
].join("\n");

function normalizeZaloConfig(config, fallbackPhone) {
  return {
    phone: String(config?.phone || fallbackPhone || "0788422424").replace(/\D/g, "") || String(fallbackPhone || "0788422424").replace(/\D/g, ""),
    template: DEFAULT_ZALO_TEMPLATE
  };
}

export function loadZaloConfig(fallbackPhone = "0788422424") {
  const fallback = normalizeZaloConfig({}, fallbackPhone);
  const saved = zaloConfigRepository.get(fallback);
  return normalizeZaloConfig(saved, fallback.phone);
}

export function saveZaloConfig(config) {
  const next = normalizeZaloConfig(config, "0788422424");
  zaloConfigRepository.set(next);
  return next;
}

export async function loadZaloConfigAsync(fallbackPhone = "0788422424") {
  const fallback = normalizeZaloConfig({}, fallbackPhone);
  const saved = await zaloConfigRepository.getAsync(fallback);
  return normalizeZaloConfig(saved, fallback.phone);
}

export async function saveZaloConfigAsync(config) {
  const next = normalizeZaloConfig(config, "0788422424");
  await zaloConfigRepository.setAsync(next);
  return next;
}

export function renderZaloTemplate(template, data) {
  const source = String(template || DEFAULT_ZALO_TEMPLATE);
  const values = {
    customer_name: "Kh\u00E1ch",
    phone: "",
    items: "",
    total: "0\u0111",
    address: "",
    note: "",
    order_code: "",
    order_time: "",
    pickup_time: "",
    fulfillment_type: "",
    pickup_branch: "",
    delivery_branch: "",
    payment_method: "",
    map_link: "",
    distance_km: "",
    subtotal: "",
    shipping_fee: "",
    promo_discount: "",
    points_discount: "",
    order_link: ""
  };
  Object.assign(values, data || {});
  const output = source
    .split("\n")
    .filter((line) => {
      const keys = [...line.matchAll(/{{(\w+)}}/g)].map((match) => match[1]);
      if (!keys.length) return true;
      return keys.every((key) => String(values[key] ?? "").trim() !== "");
    })
    .map((line) => {
      let nextLine = line;
      Object.entries(values).forEach(([key, value]) => {
        nextLine = nextLine.replaceAll(`{{${key}}}`, String(value ?? ""));
      });
      return nextLine;
    })
    .join("\n");
  return output.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildZaloLink(phone, message) {
  const cleanPhone = String(phone || "").replace(/\D/g, "");
  return `https://zalo.me/${cleanPhone}?text=${encodeURIComponent(String(message || ""))}`;
}
