import { isProductAvailableForContext } from "./productAvailabilityService.js";

const text = (value) => String(value ?? "").normalize("NFC").trim();

// An explicit product identity must never fall back to another, similarly named dish.
export function findOrderCatalogProduct(item = {}, products = []) {
  const id = text(item.productId || item.product_id || item.id);
  if (id) return products.find((product) => text(product.id) === id) || null;
  const name = text(item.name).toLocaleLowerCase("vi");
  const matches = products.filter((product) => text(product.name).toLocaleLowerCase("vi") === name);
  return name && matches.length === 1 ? matches[0] : null;
}

export function getUnavailableOrderItems(items = [], products = [], context = {}) {
  return items.filter((item) => {
    if (item.autoGiftByPromo || item.stampGift) return false;
    const product = findOrderCatalogProduct(item, products);
    return !product || !isProductAvailableForContext(product, context);
  });
}

export function buildUnavailableItemsNotice(items = []) {
  const names = [...new Set(items.map((item) => text(item.name) || "Món trong đơn cũ"))];
  return {
    badge: "Chọn món khác",
    title: "Món ăn không còn phục vụ",
    message: `${names.length ? `Một số món hiện không còn trong menu: ${names.join(", ")}.` : "Một số món hiện không còn trong menu."} Anh/chị vui lòng chọn món khác nhé!`,
    actionLabel: "Xem menu"
  };
}

export function buildReorderItems(order, products = [], context = {}) {
  // Gifts must be earned again through the current promotion/redemption flow.
  const items = (Array.isArray(order?.items) ? order.items : [])
    .filter((item) => !item.autoGiftByPromo && !item.stampGift);
  const unavailableItems = getUnavailableOrderItems(items, products, context);
  if (unavailableItems.length) {
    const error = new Error(buildUnavailableItemsNotice(unavailableItems).message);
    error.code = "ORDER_ITEMS_UNAVAILABLE";
    error.unavailableItems = unavailableItems;
    throw error;
  }
  const now = Date.now();
  return items.map((item, index) => {
    const product = findOrderCatalogProduct(item, products);
    const quantity = Math.max(1, Number(item.quantity || 1));
    const toppings = Array.isArray(item.toppings) ? item.toppings : [];
    const unitTotal = Number(product.price || 0) + toppings.reduce(
      (sum, topping) => sum + Number(topping.price || 0) * Number(topping.quantity || 1), 0
    );
    return {
      ...product,
      productId: product.id,
      cartId: `${product.id}-reorder-${now}-${index}`,
      quantity,
      spice: item.spice || "",
      toppings,
      note: item.note || "",
      unitTotal,
      lineTotal: unitTotal * quantity
    };
  });
}
