import { isPromotionAllowedForChannel } from "./promotionChannelService.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export const PROMOTION_ROLE_MODEL = {
  promos: "marketing_home_display",
  smartPromotions: "rule_engine",
  coupons: "checkout_input_code",
  campaigns: "content_campaign"
};

function sortByPriority(items = []) {
  return [...items].sort((first, second) => Number(first?.priority || 99) - Number(second?.priority || 99));
}

function hasDisplayPlace(promotion, place) {
  const list = Array.isArray(promotion?.displayPlaces) ? promotion.displayPlaces : [];
  if (!list.length) return true;
  return list.includes(place);
}

function normalizeCoupons(coupons = [], channel = "web") {
  return toArray(coupons).filter(
    (coupon) => coupon && coupon.active !== false && isPromotionAllowedForChannel(coupon, channel)
  );
}

function normalizeSmartPromotions(smartPromotions = [], channel = "web") {
  return sortByPriority(
    toArray(smartPromotions).filter(
      (item) => item && item.active !== false && isPromotionAllowedForChannel(item, channel)
    )
  );
}

export function selectHomeCoupons(coupons = [], channel = "web") {
  return normalizeCoupons(coupons, channel);
}

export function selectCheckoutCoupons(coupons = [], channel = "web") {
  return normalizeCoupons(coupons, channel);
}

export function selectHomeSmartPromotions(smartPromotions = [], channel = "web") {
  return normalizeSmartPromotions(smartPromotions, channel).filter(
    (promotion) =>
      promotion?.type === "gift_threshold" ||
      hasDisplayPlace(promotion, "home") ||
      hasDisplayPlace(promotion, "menu")
  );
}

export function selectCheckoutSmartPromotions(smartPromotions = [], channel = "web") {
  return normalizeSmartPromotions(smartPromotions, channel).filter((promotion) => hasDisplayPlace(promotion, "checkout") || hasDisplayPlace(promotion, "menu") || hasDisplayPlace(promotion, "home"));
}
