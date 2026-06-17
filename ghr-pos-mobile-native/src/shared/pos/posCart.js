function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildOptionSummary(spice = "", toppings = [], selectedOptions = []) {
  return [
    spice ? `Độ cay: ${spice}` : "",
    ...(Array.isArray(toppings) ? toppings : []).map((topping) => (
      `Topping: ${topping.name}${Number(topping.quantity || 1) > 1 ? ` x${topping.quantity}` : ""}`
    )),
    ...(Array.isArray(selectedOptions) ? selectedOptions : []).map((option) => (
      `${option.groupName}: ${option.name}`
    ))
  ].filter(Boolean);
}

export function createPosCartItem(product = {}, config = {}) {
  const quantity = Math.max(1, Math.floor(toNumber(config.quantity, 1)));
  const unitPrice = config.unitPrice != null ? toNumber(config.unitPrice, 0) : toNumber(product.price, 0);
  const toppings = Array.isArray(config.toppings) ? config.toppings : [];
  const selectedOptions = Array.isArray(config.selectedOptions) ? config.selectedOptions : [];
  const toppingTotal = toppings.reduce(
    (sum, topping) => sum + toNumber(topping.price, 0) * Math.max(1, Math.floor(toNumber(topping.quantity, 1))),
    0
  );
  const optionTotal = selectedOptions.reduce((sum, option) => sum + toNumber(option.price, 0), 0);
  const unitTotal = unitPrice + toppingTotal + optionTotal;
  const note = toText(config.note);
  const spice = toText(config.spice);
  const options = Array.isArray(config.options) && config.options.length
    ? config.options.filter(Boolean).map(toText).filter(Boolean)
    : buildOptionSummary(spice, toppings, selectedOptions);

  return {
    cartId: `${product.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: product.id,
    id: product.id,
    name: product.name,
    image: product.image || "",
    category: product.category || "",
    quantity,
    price: unitPrice,
    unitTotal,
    lineTotal: unitTotal * quantity,
    spice,
    toppings,
    selectedOptions,
    options,
    note,
    metadata: config.metadata && typeof config.metadata === "object" ? config.metadata : {}
  };
}

export function updatePosCartItemQuantity(item = {}, quantity = 1) {
  const safeQuantity = Math.max(1, Math.floor(toNumber(quantity, 1)));
  const unitTotal = toNumber(item.unitTotal ?? item.price, 0);

  return {
    ...item,
    quantity: safeQuantity,
    unitTotal,
    lineTotal: unitTotal * safeQuantity
  };
}

export function updatePosCartItemConfig(item = {}, product = {}, config = {}) {
  const quantity = Math.max(1, Math.floor(toNumber(config.quantity ?? item.quantity, 1)));
  const unitPrice = config.unitPrice != null
    ? toNumber(config.unitPrice, 0)
    : toNumber(item.price ?? product.price, 0);
  const toppings = Array.isArray(config.toppings) ? config.toppings : (Array.isArray(item.toppings) ? item.toppings : []);
  const selectedOptions = Array.isArray(config.selectedOptions)
    ? config.selectedOptions
    : (Array.isArray(item.selectedOptions) ? item.selectedOptions : []);
  const toppingTotal = toppings.reduce(
    (sum, topping) => sum + toNumber(topping.price, 0) * Math.max(1, Math.floor(toNumber(topping.quantity, 1))),
    0
  );
  const optionTotal = selectedOptions.reduce((sum, option) => sum + toNumber(option.price, 0), 0);
  const unitTotal = unitPrice + toppingTotal + optionTotal;
  const note = toText(config.note ?? item.note);
  const spice = toText(config.spice ?? item.spice);
  const options = Array.isArray(config.options) && config.options.length
    ? config.options.filter(Boolean).map(toText).filter(Boolean)
    : buildOptionSummary(spice, toppings, selectedOptions);

  return {
    ...item,
    productId: product.id || item.productId,
    id: product.id || item.id,
    name: product.name || item.name,
    image: product.image || item.image || "",
    category: product.category || item.category || "",
    quantity,
    price: unitPrice,
    unitTotal,
    lineTotal: unitTotal * quantity,
    spice,
    toppings,
    selectedOptions,
    options,
    note,
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {}
  };
}

export function calculatePosCartTotals(cart = []) {
  const items = Array.isArray(cart) ? cart : [];
  const quantity = items.reduce((sum, item) => sum + toNumber(item.quantity, 0), 0);
  const subtotal = items.reduce((sum, item) => sum + toNumber(item.lineTotal, 0), 0);

  return {
    quantity,
    subtotal,
    total: subtotal
  };
}
