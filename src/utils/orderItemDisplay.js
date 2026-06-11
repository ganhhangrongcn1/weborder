function normalizeOptionText(value = "") {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isToppingAlreadyShownInSpice(item = {}, topping = {}) {
  const spiceText = String(item.spice || "").trim();
  const toppingName = String(topping.name || topping.label || topping.value || "").trim();
  const groupName = String(topping.groupName || topping.group || "").trim();

  if (!spiceText || !toppingName) return false;

  const normalizedSpice = normalizeOptionText(spiceText);
  const normalizedTopping = normalizeOptionText(toppingName);
  const normalizedGroupPair = groupName ? normalizeOptionText(`${groupName}: ${toppingName}`) : "";

  return (
    normalizedSpice === normalizedGroupPair ||
    normalizedSpice.endsWith(` ${normalizedTopping}`) ||
    normalizedSpice === normalizedTopping
  );
}

export function getDisplayToppings(item = {}) {
  return (Array.isArray(item.toppings) ? item.toppings : [])
    .filter((topping) => !isToppingAlreadyShownInSpice(item, topping));
}

export function getOrderItemOptionLabels(item = {}, { includeNote = true, includeQuantity = false } = {}) {
  const toppingLabels = getDisplayToppings(item)
    .map((topping) => {
      const name = String(topping.name || topping.label || topping.value || "").trim();
      if (!name) return "";
      const quantity = Number(topping.quantity || 0);
      return includeQuantity && quantity > 1 ? `${name} x${quantity}` : name;
    })
    .filter(Boolean);

  return [
    item.spice,
    ...toppingLabels,
    includeNote && item.note ? `Ghi chú: ${item.note}` : ""
  ].filter(Boolean);
}
