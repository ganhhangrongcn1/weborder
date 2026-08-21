export const PROMOTION_SALES_CHANNELS = [
  { value: "web", label: "Web khách hàng" },
  { value: "pos", label: "POS" }
];

export const ALL_PROMOTION_SALES_CHANNELS = PROMOTION_SALES_CHANNELS.map((channel) => channel.value);
const LEGACY_PROMOTION_SALES_CHANNELS = ["web", "qr", "pos"];

export const DEFAULT_PROMOTION_CHANNELS_BY_TYPE = {
  coupon: ["web"],
  checkout: ["web"],
  loyalty: ["web"],
  free_shipping: ["web"],
  strike_price: ["web"],
  flash_sale: ["web", "pos"],
  gift_threshold: ["web"]
};

export function normalizeSalesChannels(value, fallback = ALL_PROMOTION_SALES_CHANNELS) {
  const allowed = new Set(LEGACY_PROMOTION_SALES_CHANNELS);
  const source = Array.isArray(value) ? value : fallback;
  const normalized = source
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => allowed.has(item));
  return normalized.length ? Array.from(new Set(normalized)) : [...fallback];
}

export function getDefaultSalesChannels(type = "") {
  const key = String(type || "").trim();
  return normalizeSalesChannels(DEFAULT_PROMOTION_CHANNELS_BY_TYPE[key], ALL_PROMOTION_SALES_CHANNELS);
}

export function getPromotionSalesChannels(promotion = {}, fallback = ALL_PROMOTION_SALES_CHANNELS) {
  const hasExplicitChannels = Array.isArray(promotion?.salesChannels);
  const storedChannels = normalizeSalesChannels(promotion?.salesChannels, fallback);
  const effectiveChannels = storedChannels.filter((channel) => channel !== "qr");
  const promotionType = String(promotion?.type || promotion?.voucherType || "").trim().toLowerCase();

  // QR tại quầy đã nghỉ. Flash Sale cũ từng chọn Web + QR được chuyển an toàn sang Web + POS.
  if (promotionType === "flash_sale" && storedChannels.includes("qr") && !effectiveChannels.includes("pos")) {
    effectiveChannels.push("pos");
  }

  if (effectiveChannels.length) return Array.from(new Set(effectiveChannels));
  return hasExplicitChannels ? [] : normalizeSalesChannels(fallback, ALL_PROMOTION_SALES_CHANNELS).filter((channel) => channel !== "qr");
}

export function isPromotionAllowedForChannel(promotion = {}, channel = "web") {
  const targetChannel = String(channel || "web").trim().toLowerCase();
  if (!Array.isArray(promotion?.salesChannels)) return true;
  return getPromotionSalesChannels(promotion).includes(targetChannel);
}

export function toggleSalesChannel(currentChannels = [], channel = "", fallback = ALL_PROMOTION_SALES_CHANNELS) {
  const normalizedChannel = String(channel || "").trim().toLowerCase();
  if (!ALL_PROMOTION_SALES_CHANNELS.includes(normalizedChannel)) return normalizeSalesChannels(currentChannels, fallback);
  const current = (Array.isArray(currentChannels) ? currentChannels : fallback)
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => ALL_PROMOTION_SALES_CHANNELS.includes(item));
  const next = current.includes(normalizedChannel)
    ? current.filter((item) => item !== normalizedChannel)
    : [...current, normalizedChannel];
  return next.length ? next : [normalizedChannel];
}
