import { createPosCartItem } from "./posCart";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function normalizeVietnameseSearch(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDateActive(startAt = "", endAt = "", now = new Date()) {
  const start = toText(startAt);
  const end = toText(endAt);

  if (start) {
    const startTime = new Date(`${start.slice(0, 10)}T00:00:00`).getTime();
    if (Number.isFinite(startTime) && now.getTime() < startTime) return false;
  }

  if (end) {
    const endTime = new Date(`${end.slice(0, 10)}T23:59:59`).getTime();
    if (Number.isFinite(endTime) && now.getTime() > endTime) return false;
  }

  return true;
}

function hasDisplayPlace(promotion = {}, place = "checkout") {
  const list = Array.isArray(promotion.displayPlaces) ? promotion.displayPlaces : [];
  if (!list.length) return true;
  return list.includes(place) || list.includes("menu") || list.includes("home");
}

function toIdList(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => toText(item))
    .filter(Boolean);
}

function parseTimeToMinutes(value = "") {
  const matched = toText(value).match(/^(\d{1,2})[:h](\d{2})$/i);
  if (!matched) return null;
  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function isWeekdayActive(promotion = {}, now = new Date()) {
  const weekdays = Array.isArray(promotion?.condition?.weekdays)
    ? promotion.condition.weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  if (!weekdays.length) return true;
  return weekdays.includes(now.getDay());
}

function isTimeWindowActive(promotion = {}, now = new Date()) {
  if (promotion?.condition?.useTimeWindow === false) return true;

  const startMinutes = parseTimeToMinutes(promotion?.condition?.startTime || "00:00");
  const endMinutes = parseTimeToMinutes(promotion?.condition?.endTime || "23:59");
  if (startMinutes === null || endMinutes === null) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function hasFlashSaleSlots(promotion = {}) {
  const soldCount = toNumber(promotion?.condition?.soldCount, 0);
  const totalSlots = toNumber(promotion?.condition?.totalSlots, 0);
  return totalSlots <= 0 || soldCount < totalSlots;
}

function isFlashSaleActive(promotion = {}, now = new Date()) {
  if (promotion?.type !== "flash_sale") return false;
  if (promotion?.active === false) return false;
  if (!hasDisplayPlace(promotion, "pos")) return false;
  if (!isDateActive(promotion.startAt, promotion.endAt, now)) return false;
  if (!isWeekdayActive(promotion, now)) return false;
  if (!isTimeWindowActive(promotion, now)) return false;
  return hasFlashSaleSlots(promotion);
}

function matchesPromotionTarget(product = {}, promotion = {}) {
  const scope = toText(promotion?.condition?.applyScope || "product").toLowerCase();
  const productIds = toIdList(promotion?.condition?.productIds);
  const categoryIds = toIdList(promotion?.condition?.categoryIds);

  if (scope === "all") return true;
  if (scope === "category") return categoryIds.includes(toText(product.category));
  return productIds.includes(toText(product.id));
}

function applyRoundMode(value = 0, mode = "none") {
  if (mode === "round_1000") return Math.round(value / 1000) * 1000;
  if (mode === "round_5000") return Math.round(value / 5000) * 5000;
  return value;
}

function isFixedPricePromotion(promotion = {}) {
  if (promotion?.reward?.type === "fixed_price") return true;
  if (promotion?.reward?.priceMode === "fixed_price") return true;
  if (promotion?.condition?.priceMode === "fixed_price") return true;

  const intentText = normalizeVietnameseSearch([
    promotion?.name,
    promotion?.title,
    promotion?.text
  ].filter(Boolean).join(" "));
  return intentText.includes("dong gia");
}

function calculatePromotionPrice(originalPrice = 0, promotion = {}) {
  const price = Math.max(0, toNumber(originalPrice, 0));
  const reward = promotion?.reward || {};
  const rewardType = isFixedPricePromotion(promotion) ? "fixed_price" : toText(reward.type).toLowerCase();
  const rewardValue = Math.max(0, toNumber(reward.value, 0));
  const rawPrice = rewardType === "fixed_price"
    ? rewardValue
    : price - (rewardType === "percent_discount" ? (price * rewardValue) / 100 : rewardValue);

  return Math.max(0, applyRoundMode(rawPrice, reward.roundMode || "none"));
}

export function getActivePosFlashSalePromotions(smartPromotions = [], now = new Date()) {
  return [...(Array.isArray(smartPromotions) ? smartPromotions : [])]
    .filter((promotion) => isFlashSaleActive(promotion, now))
    .sort((first, second) => Number(first?.priority || 99) - Number(second?.priority || 99));
}

export function applyPosFlashSaleToProduct(product = {}, smartPromotions = [], now = new Date()) {
  const activePromotions = getActivePosFlashSalePromotions(smartPromotions, now);
  const matched = activePromotions.find((promotion) => matchesPromotionTarget(product, promotion));
  if (!matched) return product;

  const originalPrice = Math.max(0, toNumber(product.originalPrice || product.price, 0));
  const salePrice = calculatePromotionPrice(originalPrice, matched);
  if (salePrice <= 0 || salePrice >= originalPrice) return product;

  return {
    ...product,
    price: salePrice,
    originalPrice,
    salePrice,
    flashPromoId: matched.id,
    promoBadge: matched.title || matched.name || "Flashsale",
    metadata: {
      ...(product.metadata && typeof product.metadata === "object" ? product.metadata : {}),
      flashPromoId: matched.id,
      flashPromoTitle: matched.title || matched.name || "Flashsale",
      originalPrice,
      salePrice
    }
  };
}

export function selectCheckoutSmartPromotions(smartPromotions = []) {
  return [...(Array.isArray(smartPromotions) ? smartPromotions : [])]
    .filter((promotion) => promotion?.active !== false)
    .filter((promotion) => hasDisplayPlace(promotion, "checkout"))
    .sort((first, second) => Number(first?.priority || 99) - Number(second?.priority || 99));
}

export function buildPosPromotionHints({ smartPromotions = [], products = [], subtotal = 0 } = {}) {
  const now = new Date();

  return selectCheckoutSmartPromotions(smartPromotions)
    .filter((promotion) => promotion?.type === "gift_threshold" || promotion?.reward?.type === "gift")
    .filter((promotion) => isDateActive(promotion.startAt, promotion.endAt, now))
    .map((promotion) => {
      const minSubtotal = Math.max(0, toNumber(promotion?.condition?.minSubtotal, 0));
      const productId = toText(promotion?.reward?.productId);
      const product = (Array.isArray(products) ? products : []).find((item) => toText(item?.id) === productId) || null;
      return {
        id: toText(promotion.id || productId || promotion.title),
        title: toText(promotion.title || promotion.name || "Ưu đãi quà tặng"),
        rewardText: toText(
          product?.name ||
          promotion?.reward?.name ||
          promotion?.reward?.title ||
          promotion?.reward?.value ||
          "Quà tặng"
        ),
        minSubtotal,
        product,
        productId,
        eligible: subtotal >= minSubtotal && Boolean(product),
        missing: Math.max(0, minSubtotal - subtotal)
      };
    })
    .filter((promotion) => promotion.product || promotion.rewardText);
}

export function syncAutoGiftItems(cart = [], promotionHints = []) {
  const current = Array.isArray(cart) ? cart : [];
  const manualItems = current.filter((item) => !item?.metadata?.autoAddedGift);
  const nextGiftItems = (Array.isArray(promotionHints) ? promotionHints : [])
    .filter((promotion) => promotion.eligible && promotion.product)
    .map((promotion) => createPosCartItem(promotion.product, {
      quantity: 1,
      unitPrice: 0,
      options: ["Quà tặng tự động"],
      metadata: {
        autoAddedGift: true,
        giftPromotionId: promotion.id
      }
    }));

  const currentGiftKeys = current
    .filter((item) => item?.metadata?.autoAddedGift)
    .map((item) => `${toText(item.metadata?.giftPromotionId)}:${toText(item.productId || item.id)}`)
    .sort()
    .join("|");
  const nextGiftKeys = nextGiftItems
    .map((item) => `${toText(item.metadata?.giftPromotionId)}:${toText(item.productId || item.id)}`)
    .sort()
    .join("|");

  if (currentGiftKeys === nextGiftKeys) {
    return current;
  }

  return [...nextGiftItems, ...manualItems];
}
