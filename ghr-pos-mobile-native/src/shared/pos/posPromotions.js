import { createPosCartItem } from "./posCart";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
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
