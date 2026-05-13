import { useEffect } from "react";
import { isDateInRange } from "../checkoutHelpers.js";

function getAutoGiftSnapshot(items = []) {
  return items
    .filter((item) => item?.autoGiftByPromo)
    .map((item) => ({
      cartId: String(item.cartId || ""),
      giftPromoId: String(item.giftPromoId || ""),
      id: String(item.id || ""),
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      lineTotal: Number(item.lineTotal || 0)
    }))
    .sort((a, b) => a.cartId.localeCompare(b.cartId));
}

function areAutoGiftsEqual(currentItems, nextGiftItems) {
  const current = getAutoGiftSnapshot(currentItems);
  const next = getAutoGiftSnapshot(nextGiftItems);
  return JSON.stringify(current) === JSON.stringify(next);
}

export default function useCheckoutGiftPromotions({
  smartPromotions,
  subtotal,
  products,
  setCart
}) {
  useEffect(() => {
    const now = new Date();
    const activeGiftPromos = (smartPromotions || [])
      .filter((promotion) => promotion?.type === "gift_threshold" && promotion?.active !== false)
      .filter((promotion) => isDateInRange(promotion?.startAt, promotion?.endAt, now))
      .filter((promotion) => Number(subtotal || 0) >= Number(promotion?.condition?.minSubtotal || 0))
      .filter((promotion) => String(promotion?.reward?.productId || "").trim().length > 0);

    setCart((items) => {
      const withoutAutoGifts = items.filter((item) => !item.autoGiftByPromo);

      if (!activeGiftPromos.length) {
        return withoutAutoGifts.length === items.length ? items : withoutAutoGifts;
      }

      const autoGiftItems = activeGiftPromos
        .map((promotion) => {
          const product = products.find((item) => String(item.id) === String(promotion?.reward?.productId) && item?.visible !== false);
          if (!product) return null;
          return {
            ...product,
            cartId: `gift-${promotion.id}`,
            spice: "Quà tặng",
            toppings: [],
            note: "Tặng tự động từ chương trình ưu đãi",
            quantity: 1,
            price: 0,
            unitTotal: 0,
            lineTotal: 0,
            autoGiftByPromo: true,
            originalUnitPrice: Number(product.price || 0),
            originalLineTotal: Number(product.price || 0),
            giftPromoId: promotion.id
          };
        })
        .filter(Boolean);

      if (areAutoGiftsEqual(items, autoGiftItems)) {
        return items;
      }

      return [...autoGiftItems, ...withoutAutoGifts];
    });
  }, [products, setCart, smartPromotions, subtotal]);
}
