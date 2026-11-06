export function updateCartItemQuantity(items, cartId, delta) {
  return items.map((item) => {
    if (item.cartId !== cartId || item.autoGiftByPromo || item.stampGift) return item;
    const quantity = Math.max(1, item.quantity + delta);
    return {
      ...item,
      quantity,
      lineTotal: item.unitTotal * quantity,
      originalLineTotal: Number(item.originalUnitTotal || 0) > Number(item.unitTotal || 0)
        ? Number(item.originalUnitTotal || 0) * quantity
        : item.originalLineTotal
    };
  });
}

export default updateCartItemQuantity;
