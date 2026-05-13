export function makeCartItem(product, spice, chosenToppings, qty, note = "") {
  const toppingTotal = chosenToppings.reduce((sum, topping) => sum + Number(topping.price || 0) * (topping.quantity || 1), 0);
  return {
    ...product,
    cartId: `${product.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    spice,
    toppings: chosenToppings,
    note,
    quantity: qty,
    unitTotal: product.price + toppingTotal,
    lineTotal: (product.price + toppingTotal) * qty
  };
}
