export const KITCHEN_UNIT_PROGRESS_STORAGE_KEY = "ghr:kitchen-unit-progress:v1";
export const KITCHEN_TOPPING_PROGRESS_STORAGE_KEY = "ghr:kitchen-topping-progress:v1";
export const KITCHEN_PROGRESS_EVENT = "ghr:kitchen-progress-change";

export function readKitchenProgress(storageKey) {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

export function getKitchenProgressItemKey(order = {}, item = {}) {
  return `${order.sourceType}-${order.id}-${item.sourceItemId || item.id}`;
}

export function isKitchenToppingDone({
  toppingProgress = {},
  order = {},
  item = {},
  unitIndex = 0,
  option = {}
}) {
  if (item.status === "done") return true;
  const itemKey = getKitchenProgressItemKey(order, item);
  return Boolean(toppingProgress[`${itemKey}-${unitIndex}-${option.label}`]);
}

export function isKitchenUnitDone({
  unitProgress = {},
  toppingProgress = {},
  order = {},
  item = {},
  unitIndex = 0
}) {
  if (item.status === "done") return true;

  const itemKey = getKitchenProgressItemKey(order, item);
  if (!unitProgress[`${itemKey}-${unitIndex}`]) return false;

  const paidToppings = Array.isArray(item.kitchenChecklistOptions)
    ? item.kitchenChecklistOptions
    : [];

  return paidToppings.every((option) => isKitchenToppingDone({
    toppingProgress,
    order,
    item,
    unitIndex,
    option
  }));
}
