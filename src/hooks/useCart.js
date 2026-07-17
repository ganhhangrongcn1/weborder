import { useEffect, useRef, useState } from "react";
import { orderRepository } from "../services/repositories/orderRepository.js";
import { getActiveFlashSalePromotions } from "../services/flashSaleService.js";

function normalizeLookupText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toIdList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function applyRoundMode(value, mode) {
  if (mode === "round_1000") return Math.round(value / 1000) * 1000;
  if (mode === "round_5000") return Math.round(value / 5000) * 5000;
  return value;
}

function canApplyFlashPromoToProduct(promo = {}, product = {}) {
  const scope = promo?.condition?.applyScope || "product";
  if (scope === "all") return true;
  if (scope === "category") {
    return toIdList(promo?.condition?.categoryIds).includes(String(product?.category || ""));
  }
  return toIdList(promo?.condition?.productIds).includes(String(product?.id || product?.productId || product?.product_id || ""));
}

function isFixedPricePromo(promo = {}) {
  return promo?.reward?.type === "fixed_price" ||
    promo?.reward?.priceMode === "fixed_price" ||
    promo?.condition?.priceMode === "fixed_price";
}

function calculateFlashSalePrice(basePrice, promo = {}) {
  const rewardType = isFixedPricePromo(promo) ? "fixed_price" : promo?.reward?.type;
  const rewardValue = Number(promo?.reward?.value || 0);
  const rawPrice = rewardType === "fixed_price"
    ? rewardValue
    : basePrice - (rewardType === "percent_discount" ? (basePrice * rewardValue) / 100 : rewardValue);
  return Math.max(applyRoundMode(rawPrice, promo?.reward?.roundMode), 0);
}

function getToppingTotal(toppings = []) {
  return (Array.isArray(toppings) ? toppings : []).reduce(
    (sum, topping) => sum + Number(topping?.price || 0) * Number(topping?.quantity || 1),
    0
  );
}

export default function useCart({ makeCartItem, initialCart, selectedProduct, selectedSpice, selectedToppings, quantity, editingCartId, setEditingCartId, setToastVisible, toastTimer, deliveryFee, freeshipMinSubtotal, discount, reorder, navigate, onPrepareReorder, catalogProducts = [], smartPromotions = [] }) {
  const [cart, setCartState] = useState(() => orderRepository.getCartDraft(initialCart));
  const cartRef = useRef(cart);

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
      cartRef.current = next;
      orderRepository.saveCartDraft(next);
      return next;
    });
  }

  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const ship = subtotal >= freeshipMinSubtotal ? 0 : deliveryFee;
  const total = Math.max(subtotal - discount + ship, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function findCatalogProduct(product = {}) {
    const safeProducts = Array.isArray(catalogProducts) ? catalogProducts : [];
    const rawId = String(product?.id || product?.productId || product?.product_id || "").trim();
    const normalizedName = normalizeLookupText(product?.name || product?.productName || product?.product_name || "");
    return safeProducts.find((item) => String(item?.id || "").trim() === rawId) ||
      safeProducts.find((item) => normalizeLookupText(item?.name || "") === normalizedName) ||
      null;
  }

  function applyCurrentFlashSale(product = {}) {
    const activeFlashPromos = getActiveFlashSalePromotions(smartPromotions);
    const matchedPromo = activeFlashPromos.find((promo) => canApplyFlashPromoToProduct(promo, product));
    if (!matchedPromo) {
      return {
        ...product,
        flashPromoId: undefined,
        salePrice: undefined
      };
    }

    const basePrice = Number(product?.originalPrice || product?.price || 0);
    const salePrice = calculateFlashSalePrice(basePrice, matchedPromo);
    if (salePrice <= 0 || salePrice >= basePrice) {
      return {
        ...product,
        flashPromoId: undefined,
        salePrice: undefined
      };
    }

    return {
      ...product,
      price: salePrice,
      originalPrice: basePrice,
      salePrice,
      discountPercent: Math.round(((basePrice - salePrice) / basePrice) * 100),
      discountValue: basePrice - salePrice,
      flashPromoId: matchedPromo.id
    };
  }

  function resolvePurchasableProduct(product = {}) {
    const catalogProduct = findCatalogProduct(product);
    const baseProduct = catalogProduct
      ? {
          ...product,
          ...catalogProduct,
          id: catalogProduct.id || product.id,
          name: catalogProduct.name || product.name,
          image: catalogProduct.image || product.image,
          price: Number(catalogProduct.price ?? product.price ?? 0),
          originalPrice: catalogProduct.originalPrice,
          salePrice: catalogProduct.salePrice,
          discountPercent: catalogProduct.discountPercent,
          discountValue: catalogProduct.discountValue,
          flashPromoId: catalogProduct.flashPromoId
        }
      : product;

    return applyCurrentFlashSale(baseProduct);
  }

  function repriceCartItem(item = {}) {
    if (item.autoGiftByPromo) return item;
    const product = resolvePurchasableProduct(item);
    const quantityValue = Math.max(1, Number(item.quantity || 1));
    const toppingTotal = getToppingTotal(item.toppings);
    const unitPrice = Number(product.price || 0);
    const originalUnitPrice = Number(product.originalPrice || product.price || 0);
    const unitTotal = unitPrice + toppingTotal;
    const originalUnitTotal = originalUnitPrice + toppingTotal;
    const hasDiscountPrice = originalUnitTotal > unitTotal;

    return {
      ...item,
      ...product,
      cartId: item.cartId,
      spice: item.spice,
      toppings: item.toppings || [],
      note: item.note || "",
      quantity: quantityValue,
      unitTotal,
      lineTotal: unitTotal * quantityValue,
      originalUnitTotal: hasDiscountPrice ? originalUnitTotal : undefined,
      originalLineTotal: hasDiscountPrice ? originalUnitTotal * quantityValue : undefined
    };
  }

  function repriceCartItems(items = []) {
    return (Array.isArray(items) ? items : []).map((item) => repriceCartItem(item));
  }

  function hasCartChanged(current = [], next = []) {
    return JSON.stringify(current || []) !== JSON.stringify(next || []);
  }

  function repriceCartNow() {
    const current = Array.isArray(cartRef.current) ? cartRef.current : [];
    const next = repriceCartItems(current);
    const changed = hasCartChanged(current, next);
    if (changed) {
      cartRef.current = next;
      orderRepository.saveCartDraft(next);
      setCartState(next);
    }
    return { changed, cart: changed ? next : current };
  }

  useEffect(() => {
    repriceCartNow();
  }, [catalogProducts, smartPromotions]);

  function addToCart(configOrProduct = selectedProduct, spice = selectedSpice, chosenToppings = selectedToppings, qty = quantity, itemNote = "") {
    const config = configOrProduct?.product
      ? configOrProduct
      : { product: configOrProduct, spice, toppings: chosenToppings, quantity: qty, note: itemNote };
    const item = makeCartItem(resolvePurchasableProduct(config.product), config.spice, config.toppings, config.quantity, config.note);
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
    const items = repriceCartItems(reorder(order, catalogProducts));
    if (!items.length) return;
    onPrepareReorder?.(order);
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
    reorderOrder,
    repriceCartNow
  };
}
