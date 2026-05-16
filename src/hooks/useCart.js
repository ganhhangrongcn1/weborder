import { useState } from "react";
import { orderRepository } from "../services/repositories/orderRepository.js";

export default function useCart({ makeCartItem, initialCart, selectedProduct, selectedSpice, selectedToppings, quantity, editingCartId, setEditingCartId, setToastVisible, toastTimer, deliveryFee, freeshipMinSubtotal, discount, reorder, navigate, catalogProducts = [] }) {
  const [cart, setCartState] = useState(() => orderRepository.getCartDraft(initialCart));

  function getToppingsSignature(toppings = []) {
    return [...(toppings || [])]
      .map((topping) => ({
        id: topping.id || "",
        groupId: topping.groupId || "",
        name: topping.name || "",
        price: Number(topping.price || 0),
        quantity: Number(topping.quantity || 1)
      }))
      .sort((a, b) => {
        const keyA = `${a.groupId}|${a.id}|${a.name}|${a.price}|${a.quantity}`;
        const keyB = `${b.groupId}|${b.id}|${b.name}|${b.price}|${b.quantity}`;
        return keyA.localeCompare(keyB);
      })
      .map((item) => `${item.groupId}:${item.id}:${item.name}:${item.price}:${item.quantity}`)
      .join("|");
  }

  function isSameCartConfig(first, second) {
    return (
      String(first?.id || "") === String(second?.id || "") &&
      String(first?.spice || "") === String(second?.spice || "") &&
      String(first?.note || "") === String(second?.note || "") &&
      getToppingsSignature(first?.toppings) === getToppingsSignature(second?.toppings)
    );
  }

  function mergeDiscountLineTotal(first, second) {
    const firstOriginal = Number(first?.originalLineTotal || 0);
    const secondOriginal = Number(second?.originalLineTotal || 0);
    if (!firstOriginal && !secondOriginal) return undefined;
    return (firstOriginal || Number(first?.lineTotal || 0)) + (secondOriginal || Number(second?.lineTotal || 0));
  }

  function setCart(value) {
    setCartState((current) => {
      const next = typeof value === "function" ? value(current) : value;
      if (next === current) return current;
      orderRepository.saveCartDraft(next);
      return next;
    });
  }

  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const ship = subtotal >= freeshipMinSubtotal ? 0 : deliveryFee;
  const total = Math.max(subtotal - discount + ship, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(configOrProduct = selectedProduct, spice = selectedSpice, chosenToppings = selectedToppings, qty = quantity, itemNote = "") {
    const config = configOrProduct?.product
      ? configOrProduct
      : { product: configOrProduct, spice, toppings: chosenToppings, quantity: qty, note: itemNote };
    const item = makeCartItem(config.product, config.spice, config.toppings, config.quantity, config.note);
    if (editingCartId) {
      setCart((current) => {
        const edited = { ...item, cartId: editingCartId };
        const duplicate = current.find((cartItem) => cartItem.cartId !== editingCartId && isSameCartConfig(cartItem, edited));
        if (!duplicate) return current.map((cartItem) => (cartItem.cartId === editingCartId ? edited : cartItem));
        return current
          .filter((cartItem) => cartItem.cartId !== editingCartId && cartItem.cartId !== duplicate.cartId)
          .concat({
            ...duplicate,
            quantity: Number(duplicate.quantity || 0) + Number(edited.quantity || 0),
            lineTotal: Number(duplicate.lineTotal || 0) + Number(edited.lineTotal || 0),
            originalLineTotal: mergeDiscountLineTotal(duplicate, edited)
          });
      });
      setEditingCartId(null);
    } else {
      setCart((current) => {
        const duplicate = current.find((cartItem) => isSameCartConfig(cartItem, item));
        if (!duplicate) return [item, ...current];
        return current.map((cartItem) =>
          cartItem.cartId === duplicate.cartId
            ? {
                ...cartItem,
                quantity: Number(cartItem.quantity || 0) + Number(item.quantity || 0),
                lineTotal: Number(cartItem.lineTotal || 0) + Number(item.lineTotal || 0),
                originalLineTotal: mergeDiscountLineTotal(cartItem, item)
              }
            : cartItem
        );
      });
    }
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
  }

  function reorderOrder(order) {
    const items = reorder(order, catalogProducts);
    if (!items.length) return;
    setCart(items);
    navigate("checkout", "orders");
  }

  return {
    cart,
    setCart,
    subtotal,
    ship,
    total,
    cartCount,
    addToCart,
    reorderOrder
  };
}
