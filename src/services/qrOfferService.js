import { getActiveFlashSalePromotions } from "./flashSaleService.js";
import { isPromotionAllowedForChannel } from "./promotionChannelService.js";
import { formatMoney } from "../utils/format.js";
import { getActivePromotions } from "../utils/pureHelpers.js";

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isExpired(dateValue) {
  if (!dateValue) return false;
  return String(dateValue).slice(0, 10) < getDateKey();
}

function isDateInRange(startAt, endAt, now = new Date()) {
  const startText = String(startAt || "").trim();
  const endText = String(endAt || "").trim();
  const nowTime = now.getTime();

  if (startText) {
    const start = new Date(`${startText.slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(start.getTime()) && nowTime < start.getTime()) return false;
  }

  if (endText) {
    const end = new Date(`${endText.slice(0, 10)}T23:59:59`);
    if (!Number.isNaN(end.getTime()) && nowTime > end.getTime()) return false;
  }

  return true;
}

function hasDisplayPlace(promotion = {}, places = []) {
  const displayPlaces = Array.isArray(promotion.displayPlaces) ? promotion.displayPlaces : [];
  if (!displayPlaces.length) return true;
  return places.some((place) => displayPlaces.includes(place));
}

function hasRemainingUsage(coupon = {}) {
  const usageLimit = Number(coupon.usageLimit || 0);
  if (usageLimit <= 0) return true;
  return Number(coupon.totalUsed || 0) < usageLimit;
}

function getCouponValueText(coupon = {}) {
  const value = Number(coupon.value || 0);
  if (String(coupon.discountType || "") === "percent") return `Giảm ${value}%`;
  if (value > 0) return `Giảm ${formatMoney(value)}`;
  return "Voucher";
}

function applyRoundMode(value, mode) {
  if (mode === "round_1000") return Math.round(value / 1000) * 1000;
  if (mode === "round_5000") return Math.round(value / 5000) * 5000;
  return value;
}

function isFixedPricePromotion(promotion = {}) {
  const rewardType = String(promotion?.reward?.type || "").trim().toLowerCase();
  if (rewardType === "fixed_price") return true;
  const priceMode = String(promotion?.reward?.priceMode || promotion?.condition?.priceMode || "").trim().toLowerCase();
  return priceMode === "fixed_price";
}

function calculatePromotionPrice(basePrice, promotion = {}) {
  const rewardValue = Number(promotion?.reward?.value || 0);
  const rewardType = isFixedPricePromotion(promotion) ? "fixed_price" : String(promotion?.reward?.type || "").trim().toLowerCase();
  const rawPrice = rewardType === "fixed_price"
    ? rewardValue
    : basePrice - (rewardType === "percent_discount" ? (basePrice * rewardValue) / 100 : rewardValue);
  return Math.max(applyRoundMode(rawPrice, promotion?.reward?.roundMode), 0);
}

function getRewardValueText(promotion = {}) {
  const rewardType = String(promotion?.reward?.type || "");
  const rewardValue = promotion?.reward?.value;

  if (promotion?.type === "flash_sale") return "Flash Sale";
  if (rewardType === "percent_discount") return `Giảm ${Number(rewardValue || 0)}%`;
  if (rewardType === "fixed_discount") return `Giảm ${formatMoney(Number(rewardValue || 0))}`;
  if (rewardType === "gift") return "Nhận quà";
  if (rewardType === "points") return `Tặng ${Number(rewardValue || 0)} điểm`;
  if (promotion?.type === "gift_threshold") return "Đủ mức nhận quà";
  return "Ưu đãi";
}

function getRewardSummaryText(promotion = {}, featuredProduct = null) {
  const rewardType = String(promotion?.reward?.type || "").trim().toLowerCase();
  const rewardValue = promotion?.reward?.value;
  const rewardText = String(rewardValue || "").trim();

  if (promotion?.type === "flash_sale") return "Giá đang áp dụng tại quầy";
  if (rewardType === "gift") {
    if (featuredProduct?.name) return featuredProduct.name;
    if (rewardText && !/^product[-_]/i.test(rewardText)) return rewardText;
    return "Quà tặng";
  }
  if (rewardType === "points") return `Tặng ${Number(rewardValue || 0)} điểm`;
  if (rewardType === "percent_discount") return `Giảm ${Number(rewardValue || 0)}%`;
  if (rewardType === "fixed_discount") return `Giảm ${formatMoney(Number(rewardValue || 0))}`;
  return String(rewardValue || "").trim() || "Ưu đãi đang áp dụng";
}

function getPromotionDetail(promotion = {}) {
  const minSubtotal = Number(promotion?.condition?.minSubtotal || 0);
  if (minSubtotal > 0) return `Đơn từ ${formatMoney(minSubtotal)}`;

  if (promotion?.type === "flash_sale") {
    const startTime = promotion?.condition?.startTime;
    const endTime = promotion?.condition?.endTime;
    if (startTime && endTime) return `${startTime} - ${endTime}`;
  }

  return "Đang áp dụng tại quầy";
}

function toIdList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getVisibleProducts(products = []) {
  return (Array.isArray(products) ? products : []).filter((product) => product?.visible !== false);
}

function getFlashSaleProducts(promotion = {}, products = []) {
  const visibleProducts = getVisibleProducts(products);
  const scope = promotion?.condition?.applyScope || "product";

  if (scope === "all") return visibleProducts;

  if (scope === "category") {
    const categoryIds = toIdList(promotion?.condition?.categoryIds);
    if (!categoryIds.length) return [];
    return visibleProducts.filter((product) => categoryIds.includes(String(product?.category || "")));
  }

  const productIds = toIdList(promotion?.condition?.productIds);
  if (!productIds.length) return [];
  return visibleProducts.filter((product) => productIds.includes(String(product?.id || "")));
}

function findPromotionProduct(promotion = {}, products = []) {
  const visibleProducts = (Array.isArray(products) ? products : []).filter((product) => product?.visible !== false);
  const rewardProductId = String(promotion?.reward?.productId || "").trim();
  if (rewardProductId) {
    const rewardProduct = visibleProducts.find((product) => String(product?.id || "") === rewardProductId);
    if (rewardProduct) return rewardProduct;
  }

  const productIds = toIdList(promotion?.condition?.productIds);
  const productByCondition = visibleProducts.find((product) => productIds.includes(String(product?.id || "")));
  if (productByCondition) return productByCondition;

  const categoryIds = toIdList(promotion?.condition?.categoryIds);
  const productByCategory = visibleProducts.find((product) => categoryIds.includes(String(product?.category || "")));
  if (productByCategory) return productByCategory;

  return visibleProducts[0] || null;
}

function normalizeCouponOffer(coupon = {}) {
  const code = String(coupon.code || coupon.id || "").trim().toUpperCase();
  if (!code) return null;

  return {
    id: `coupon-${coupon.id || code}`,
    source: "coupon",
    icon: "tag",
    eyebrow: "Voucher",
    value: getCouponValueText(coupon),
    title: coupon.name || coupon.title || `Mã ${code}`,
    text: coupon.description || coupon.note || "Nhập mã này ở bước thanh toán tại quầy.",
    detail: Number(coupon.minOrder || 0) > 0 ? `Đơn từ ${formatMoney(Number(coupon.minOrder || 0))}` : "Áp dụng cho mọi đơn",
    codeLabel: `Mã: ${code}`,
    image: coupon.image || "",
    endAt: coupon.endAt || coupon.expiry || "",
    startAt: coupon.startAt || "",
    discountType: coupon.discountType || "",
    rawValue: Number(coupon.value || 0),
    minOrder: Number(coupon.minOrder || 0)
  };
}

function normalizePromotionOffer(promotion = {}, featuredProduct = null) {
  const basePrice = Number(featuredProduct?.originalPrice || featuredProduct?.price || 0);
  const currentPrice = promotion?.type === "flash_sale" && basePrice > 0
    ? calculatePromotionPrice(basePrice, promotion)
    : Number(featuredProduct?.price || 0);
  const rewardSummary = getRewardSummaryText(promotion, featuredProduct);

  return {
    id: `promotion-${promotion.id || promotion.name || promotion.title}${featuredProduct?.id ? `-${featuredProduct.id}` : ""}`,
    source: promotion.type || "promotion",
    productId: featuredProduct?.id || "",
    icon: promotion.icon || (promotion.type === "flash_sale" ? "star" : "gift"),
    eyebrow: promotion.type === "flash_sale" ? "Flash Sale" : "Ưu đãi",
    value: getRewardValueText(promotion),
    title: promotion.title || promotion.name || "Ưu đãi đang diễn ra",
    text: promotion.text || featuredProduct?.name || "Áp dụng cho khách đặt món tại quầy.",
    detail: getPromotionDetail(promotion),
    codeLabel: promotion.type === "flash_sale" ? "Giá đã hiển thị trên món" : "Tự áp dụng khi đủ điều kiện",
    image: promotion.image || featuredProduct?.image || "",
    productName: featuredProduct?.name || "",
    productDescription: featuredProduct?.short || featuredProduct?.description || "",
    originalPrice: basePrice > currentPrice ? basePrice : 0,
    currentPrice: currentPrice > 0 ? currentPrice : 0,
    thresholdAmount: Number(promotion?.condition?.minSubtotal || 0),
    rewardSummary
  };
}

export function buildQrCouponOffers({
  coupons = [],
  now = new Date()
} = {}) {
  return (Array.isArray(coupons) ? coupons : [])
    .filter((coupon) => coupon && coupon.active !== false)
    .filter((coupon) => String(coupon.voucherType || "checkout") !== "loyalty")
    .filter((coupon) => isPromotionAllowedForChannel(coupon, "qr"))
    .filter((coupon) => !isExpired(coupon.endAt || coupon.expiry))
    .filter((coupon) => isDateInRange(coupon.startAt, coupon.endAt || coupon.expiry, now))
    .filter((coupon) => hasRemainingUsage(coupon))
    .map(normalizeCouponOffer)
    .filter(Boolean);
}

export function buildPromotionOffersForChannel({
  smartPromotions = [],
  products = [],
  channel = "qr",
  now = new Date()
} = {}) {
  const activeFlashPromotions = getActiveFlashSalePromotions(smartPromotions, now)
    .filter((promotion) => isPromotionAllowedForChannel(promotion, channel))
    .filter((promotion) => hasDisplayPlace(promotion, ["menu", "checkout", "loyalty", "home"]));
  const activeRegularPromotions = getActivePromotions(smartPromotions)
    .filter((promotion) => promotion.type !== "flash_sale")
    .filter((promotion) => promotion.reward?.type !== "shipping_discount")
    .filter((promotion) => isPromotionAllowedForChannel(promotion, channel))
    .filter((promotion) => hasDisplayPlace(promotion, ["menu", "checkout", "loyalty", "home"]));

  const flashOffers = activeFlashPromotions.flatMap((promotion) =>
    getFlashSaleProducts(promotion, products)
      .map((product) => normalizePromotionOffer(promotion, product))
  );

  const regularOffers = activeRegularPromotions.map((promotion) => {
    const featuredProduct = findPromotionProduct(promotion, products);
    return normalizePromotionOffer(promotion, featuredProduct);
  });

  return [...flashOffers, ...regularOffers];
}

export function buildQrPromotionOffers(args = {}) {
  return buildPromotionOffersForChannel({ ...args, channel: "qr" });
}

export function buildQrOfferItems({
  coupons = [],
  smartPromotions = [],
  products = [],
  now = new Date(),
  limit = 8
} = {}) {
  const channelCoupons = buildQrCouponOffers({ coupons, now });
  const promotionOffers = buildQrPromotionOffers({ smartPromotions, products, now });

  const seen = new Set();
  return [...promotionOffers, ...channelCoupons]
    .filter((offer) => {
      const key = String(offer?.id || offer?.title || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
