import { getKitchenRecipeOptions } from "./kitchenOptionDisplay.js";

function toText(value = "") {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeGroupText(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTimeValue(...values) {
  for (const value of values) {
    if (!value) continue;
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function getRawValue(source = {}, key = "") {
  return source?.raw && typeof source.raw === "object" ? source.raw[key] : "";
}

export function getKitchenOrderKey(order = {}) {
  return `${order.sourceType || "order"}-${order.id || ""}`;
}

export function getKitchenOrderTimeValue(order = {}) {
  return getTimeValue(order.createdAt, order.orderTime, order.updatedAt);
}

export function getKitchenOrderDoneTimeValue(order = {}) {
  return getTimeValue(
    order.doneAt,
    getRawValue(order, "kitchen_done_at"),
    order.updatedAt,
    order.createdAt
  );
}

export function isKitchenOrderDone(order = {}) {
  const kitchenStatus = toText(order.kitchenStatus).toLowerCase();
  const orderStatus = toText(order.status).toLowerCase();
  const isWebsiteHandoff = ["ready_for_pickup", "ready_for_delivery", "delivering"].includes(orderStatus);
  if (["done", "completed", "cancelled"].includes(orderStatus)) return true;
  if (order.sourceType === "website" && kitchenStatus === "done" && !isWebsiteHandoff) return true;
  return order.sourceType === "partner" && ["done", "cancelled"].includes(kitchenStatus);
}

export function sortKitchenOrdersForBoard(orders = []) {
  return [...orders].sort((first, second) => {
    const firstDoing = !isKitchenOrderDone(first);
    const secondDoing = !isKitchenOrderDone(second);

    if (firstDoing !== secondDoing) return firstDoing ? -1 : 1;

    if (firstDoing && secondDoing) {
      const firstTime = getKitchenOrderTimeValue(first) || Number.POSITIVE_INFINITY;
      const secondTime = getKitchenOrderTimeValue(second) || Number.POSITIVE_INFINITY;
      if (firstTime !== secondTime) return firstTime - secondTime;
    }

    if (!firstDoing && !secondDoing) {
      const firstDoneTime = getKitchenOrderDoneTimeValue(first);
      const secondDoneTime = getKitchenOrderDoneTimeValue(second);
      if (firstDoneTime !== secondDoneTime) return secondDoneTime - firstDoneTime;
    }

    return toText(first.displayOrderCode || first.orderCode || first.id).localeCompare(
      toText(second.displayOrderCode || second.orderCode || second.id),
      "vi"
    );
  });
}

export function getKitchenItemGroupKey(item = {}) {
  const name = normalizeGroupText(item.name || "Không tên món");
  const options = getKitchenRecipeOptions(item.options)
    .map((option) => normalizeGroupText(option.label))
    .filter(Boolean);

  return `${name}__${options.join("|")}`;
}

export function getPendingItemGroupKeysForOrder(order = {}) {
  if (isKitchenOrderDone(order)) return [];

  return (Array.isArray(order.items) ? order.items : [])
    .filter((item) => item.status !== "done")
    .map(getKitchenItemGroupKey);
}

export function orderContainsKitchenItemGroup(order = {}, groupKey = "") {
  if (!groupKey) return false;
  return (Array.isArray(order.items) ? order.items : []).some(
    (item) => item.status !== "done" && getKitchenItemGroupKey(item) === groupKey
  );
}

function getOrderCode(order = {}) {
  return toText(order.displayOrderCode || order.orderCode || order.id) || "Chưa có mã";
}

export function groupKitchenItemsFromOrders(orders = [], activeOrderKey = "") {
  const map = new Map();
  const pendingOrdersByOldest = sortKitchenOrdersForBoard(orders).filter(
    (order) => !isKitchenOrderDone(order)
  );

  pendingOrdersByOldest.forEach((order) => {
    const orderTime = getKitchenOrderTimeValue(order) || Number.POSITIVE_INFINITY;
    const items = Array.isArray(order.items) ? order.items : [];
    let displayItemNumber = 1;

    items.forEach((item, itemIndex) => {
      const quantity = Math.max(0, toNumber(item.quantity, 1) || 1);
      const doneQuantity = item.status === "done" ? quantity : 0;
      const pendingQuantity = Math.max(0, quantity - doneQuantity);
      const key = getKitchenItemGroupKey(item);
      const recipeOptions = getKitchenRecipeOptions(item.options);
      const itemNumbers = Array.from({ length: pendingQuantity }).map((_, index) => displayItemNumber + index);
      const firstItemNumber = itemNumbers[0] || displayItemNumber;
      displayItemNumber += quantity;

      if (!map.has(key)) {
        map.set(key, {
          key,
          name: toText(item.name) || "Không tên món",
          totalQuantity: 0,
          pendingQuantity: 0,
          doneQuantity: 0,
          options: [],
          recipeOptions,
          notes: [],
          orders: [],
          oldestPendingTimeValue: Number.POSITIVE_INFINITY,
          firstPendingOrderTimeValue: Number.POSITIVE_INFINITY,
          firstPendingQuantity: 0
        });
      }

      const group = map.get(key);
      group.totalQuantity += quantity;
      group.pendingQuantity += pendingQuantity;
      group.doneQuantity += doneQuantity;
      group.options.push(...recipeOptions.map((option) => option.label));

      if (pendingQuantity > 0) {
        group.oldestPendingTimeValue = Math.min(group.oldestPendingTimeValue, orderTime);
        if (group.firstPendingOrderTimeValue === Number.POSITIVE_INFINITY) {
          group.firstPendingOrderTimeValue = orderTime;
          group.firstPendingQuantity = pendingQuantity;
        }

          group.orders.push({
            key: getKitchenOrderKey(order),
            code: getOrderCode(order),
            platform: order.platform || "",
            quantity: pendingQuantity,
            itemIndex: firstItemNumber
          });
      }

      if (item.note && pendingQuantity > 0) {
        group.notes.push({
          orderKey: getKitchenOrderKey(order),
          orderCode: getOrderCode(order),
          platform: order.platform || "",
          text: item.note,
          itemIndex: firstItemNumber,
          itemIndexes: itemNumbers
        });
      }
    });
  });

  const groups = Array.from(map.values())
    .filter((group) => group.pendingQuantity > 0)
    .sort((first, second) => {
      if (first.firstPendingOrderTimeValue !== second.firstPendingOrderTimeValue) {
        return first.firstPendingOrderTimeValue - second.firstPendingOrderTimeValue;
      }
      if (second.firstPendingQuantity !== first.firstPendingQuantity) {
        return second.firstPendingQuantity - first.firstPendingQuantity;
      }
      if (second.pendingQuantity !== first.pendingQuantity) {
        return second.pendingQuantity - first.pendingQuantity;
      }
      return first.name.localeCompare(second.name, "vi");
    });

  if (!activeOrderKey) return groups;

  const activeOrder = orders.find((order) => getKitchenOrderKey(order) === activeOrderKey);
  const priorityKeys = getPendingItemGroupKeysForOrder(activeOrder);
  if (!priorityKeys.length) return groups;

  return [...groups].sort((first, second) => {
    const firstIndex = priorityKeys.indexOf(first.key);
    const secondIndex = priorityKeys.indexOf(second.key);
    const firstInActiveOrder = firstIndex !== -1;
    const secondInActiveOrder = secondIndex !== -1;

    if (firstInActiveOrder && secondInActiveOrder) return firstIndex - secondIndex;
    if (firstInActiveOrder) return -1;
    if (secondInActiveOrder) return 1;
    return 0;
  });
}
