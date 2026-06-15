import { useMemo, useState } from "react";
import {
  calculatePosCartTotals,
  createPosCartItem,
  updatePosCartItemQuantity
} from "../services/posService.js";

function areGiftListsEqual(currentCart = [], nextGiftItems = []) {
  const current = currentCart
    .filter((item) => item?.metadata?.autoAddedGift || item?.metadata?.giftPromotionId)
    .map((item) => ({
      id: String(item.productId || item.id || ""),
      promoId: String(item?.metadata?.giftPromotionId || ""),
      qty: Number(item.quantity || 0)
    }))
    .sort((a, b) => `${a.promoId}-${a.id}`.localeCompare(`${b.promoId}-${b.id}`));
  const next = nextGiftItems
    .map((item) => ({
      id: String(item.productId || item.id || ""),
      promoId: String(item?.metadata?.giftPromotionId || ""),
      qty: Number(item.quantity || 0)
    }))
    .sort((a, b) => `${a.promoId}-${a.id}`.localeCompare(`${b.promoId}-${b.id}`));
  return JSON.stringify(current) === JSON.stringify(next);
}

export default function usePosCart() {
  const [cart, setCart] = useState([]);
  const [orderNote, setOrderNote] = useState("");

  const totals = useMemo(() => calculatePosCartTotals(cart), [cart]);

  const addProduct = (product, config = {}) => {
    if (!product?.id) return;

    setCart((currentCart) => {
      const canMerge = !config.note && !config.spice && !(config.toppings || []).length && !(config.selectedOptions || []).length;
      const existing = canMerge ? currentCart.find((item) => item.productId === product.id && !item.note && !(item.toppings || []).length && !(item.selectedOptions || []).length && !item.spice) : null;
      if (existing) {
        return currentCart.map((item) => (
          item.cartId === existing.cartId
            ? updatePosCartItemQuantity(item, Number(item.quantity || 1) + 1)
            : item
        ));
      }

      return [createPosCartItem(product, config), ...currentCart];
    });
  };

  const updateQuantity = (cartId, quantity) => {
    setCart((currentCart) => currentCart.map((item) => (
      item.cartId === cartId ? updatePosCartItemQuantity(item, quantity) : item
    )));
  };

  const updateItem = (cartId, product, config = {}) => {
    setCart((currentCart) => currentCart.map((item) => (
      item.cartId === cartId
        ? {
            ...createPosCartItem(product, config),
            cartId
          }
        : item
    )));
  };

  const removeItem = (cartId) => {
    setCart((currentCart) => currentCart.filter((item) => item.cartId !== cartId));
  };

  const syncGiftItems = (nextGiftItems = []) => {
    setCart((currentCart) => {
      const withoutGifts = currentCart.filter((item) => !(item?.metadata?.autoAddedGift || item?.metadata?.giftPromotionId));
      if (!nextGiftItems.length) {
        return withoutGifts.length === currentCart.length ? currentCart : withoutGifts;
      }
      if (areGiftListsEqual(currentCart, nextGiftItems)) {
        return currentCart;
      }
      return [...nextGiftItems, ...withoutGifts];
    });
  };

  const clearCart = () => {
    setCart([]);
    setOrderNote("");
  };

  const restoreCart = (items = [], note = "") => {
    setCart(Array.isArray(items) ? items.filter((item) => item?.cartId || item?.productId || item?.id) : []);
    setOrderNote(String(note || ""));
  };

  return {
    cart,
    totals,
    orderNote,
    setOrderNote,
    addProduct,
    updateItem,
    updateQuantity,
    removeItem,
    syncGiftItems,
    restoreCart,
    clearCart
  };
}
