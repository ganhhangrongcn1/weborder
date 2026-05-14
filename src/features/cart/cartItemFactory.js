export function makeCartItem(product, spice, chosenToppings, qty, note = "") {
  const toppingTotal = chosenToppings.reduce((sum, topping) => sum + Number(topping.price || 0) * (topping.quantity || 1), 0);
  const unitPrice = Number(product.price || 0);
  const originalUnitPrice = Number(product.originalPrice || product.price || 0);
  const unitTotal = unitPrice + toppingTotal;
  const originalUnitTotal = originalUnitPrice + toppingTotal;
  const hasDiscountPrice = originalUnitTotal > unitTotal;

  return {
    ...product,
    cartId: `${product.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    spice,
    toppings: chosenToppings,
    note,
    quantity: qty,
    unitTotal,
    lineTotal: unitTotal * qty,
    originalUnitTotal: hasDiscountPrice ? originalUnitTotal : undefined,
    originalLineTotal: hasDiscountPrice ? originalUnitTotal * qty : undefined
  };
}
