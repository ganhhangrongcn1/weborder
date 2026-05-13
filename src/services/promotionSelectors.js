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

function normalizeCoupons(coupons = []) {
  return toArray(coupons).filter((coupon) => coupon && coupon.active !== false);
}

function normalizeSmartPromotions(smartPromotions = []) {
  return sortByPriority(toArray(smartPromotions).filter((item) => item && item.active !== false));
}

export function selectHomeCoupons(coupons = []) {
  return normalizeCoupons(coupons);
}

export function selectCheckoutCoupons(coupons = []) {
  return normalizeCoupons(coupons);
}

export function selectHomeSmartPromotions(smartPromotions = []) {
  return normalizeSmartPromotions(smartPromotions).filter((promotion) => hasDisplayPlace(promotion, "home") || hasDisplayPlace(promotion, "menu"));
}

export function selectCheckoutSmartPromotions(smartPromotions = []) {
  return normalizeSmartPromotions(smartPromotions).filter((promotion) => hasDisplayPlace(promotion, "checkout") || hasDisplayPlace(promotion, "menu") || hasDisplayPlace(promotion, "home"));
}
