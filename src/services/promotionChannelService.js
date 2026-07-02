export const PROMOTION_SALES_CHANNELS = [
  { value: "web", label: "Web khách hàng" },
  { value: "qr", label: "QR order" },
  { value: "pos", label: "POS" }
];

export const ALL_PROMOTION_SALES_CHANNELS = PROMOTION_SALES_CHANNELS.map((channel) => channel.value);

export const DEFAULT_PROMOTION_CHANNELS_BY_TYPE = {
  coupon: ["web", "qr"],
  checkout: ["web", "qr"],
  loyalty: ["web", "qr"],
  free_shipping: ["web"],
  strike_price: ["web", "qr"],
  flash_sale: ["web", "qr"],
  gift_threshold: ["web", "qr"]
};

export function normalizeSalesChannels(value, fallback = ALL_PROMOTION_SALES_CHANNELS) {
  const allowed = new Set(ALL_PROMOTION_SALES_CHANNELS);
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
  return normalizeSalesChannels(promotion?.salesChannels, fallback);
}

export function isPromotionAllowedForChannel(promotion = {}, channel = "web") {
  const targetChannel = String(channel || "web").trim().toLowerCase();
  if (!Array.isArray(promotion?.salesChannels)) return true;
  return getPromotionSalesChannels(promotion).includes(targetChannel);
}

export function toggleSalesChannel(currentChannels = [], channel = "", fallback = ALL_PROMOTION_SALES_CHANNELS) {
  const normalizedChannel = String(channel || "").trim().toLowerCase();
  if (!ALL_PROMOTION_SALES_CHANNELS.includes(normalizedChannel)) return normalizeSalesChannels(currentChannels, fallback);
  const current = normalizeSalesChannels(currentChannels, fallback);
  const next = current.includes(normalizedChannel)
    ? current.filter((item) => item !== normalizedChannel)
    : [...current, normalizedChannel];
  return next.length ? next : [normalizedChannel];
}
