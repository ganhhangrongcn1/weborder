import { getKitchenRecipeOptions } from "./kitchenOptionDisplay.js";
import { parsePickupTimeText } from "../../utils/dateTimeDefaults.js";

export const KITCHEN_SCHEDULED_PICKUP_ACTIVE_WINDOW_MINUTES = 20;

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

function normalizeStatusText(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isPreorderStatus(value = "") {
  return ["preorder", "pre_order", "preordered", "scheduled", "dat_truoc", "dattruoc"].includes(
    normalizeStatusText(value)
  );
}

function getPickupScheduleSource(order = {}) {
  return order.pickupTimeText ||
    order.raw?.pickup_time_text ||
    order.raw?.metadata?.pickupTimeText ||
    order.raw?.metadata?.pickup_time_text;
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
    getRawValue(order, "kitchen_done_at")
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

export function getKitchenScheduledOrderInfo(order = {}, now = Date.now()) {
  const isPreorder = [
    order.kitchenStatus,
    order.kitchenWorkStatus,
    order.status,
    order.orderStatus,
    order.raw?.kitchen_status,
    order.raw?.kitchen_work_status,
    order.raw?.order_status,
    order.raw?.nexpos_status
  ].some(isPreorderStatus);

  if (isPreorder) {
    return {
      scheduled: true,
      reason: "preorder",
      activeWindowMinutes: KITCHEN_SCHEDULED_PICKUP_ACTIVE_WINDOW_MINUTES,
      minutesUntilPickup: Number.POSITIVE_INFINITY,
      timeValue: Number.POSITIVE_INFINITY,
      shouldShowInActive: false
    };
  }

  const isWebsitePickup =
    toText(order.sourceType).toLowerCase() === "website" &&
    toText(order.fulfillmentType).toLowerCase() === "pickup";
  if (!isWebsitePickup) {
    return {
      scheduled: false,
      shouldShowInActive: true,
      timeValue: getKitchenOrderTimeValue(order) || Number.POSITIVE_INFINITY
    };
  }

  const pickup = parsePickupTimeText(getPickupScheduleSource(order));
  if (!pickup.scheduled) {
    return {
      scheduled: false,
      shouldShowInActive: true,
      timeValue: getKitchenOrderTimeValue(order) || Number.POSITIVE_INFINITY
    };
  }

  const pickupTimeValue = pickup.dateTime.getTime();
  const minutesUntilPickup = Math.ceil((pickupTimeValue - now) / 60000);
  const shouldShowInActive = minutesUntilPickup <= KITCHEN_SCHEDULED_PICKUP_ACTIVE_WINDOW_MINUTES;

  return {
    scheduled: true,
    reason: "pickup",
    clock: pickup.clock,
    date: pickup.date,
    activeWindowMinutes: KITCHEN_SCHEDULED_PICKUP_ACTIVE_WINDOW_MINUTES,
    minutesUntilPickup,
    timeValue: pickupTimeValue,
    shouldShowInActive
  };
}

export function isKitchenOrderScheduledForLater(order = {}, now = Date.now()) {
  const info = getKitchenScheduledOrderInfo(order, now);
  return Boolean(info.scheduled && !info.shouldShowInActive);
}

function getScheduledPickupSortInfo(order = {}, now = Date.now()) {
  const scheduledInfo = getKitchenScheduledOrderInfo(order, now);
  if (!scheduledInfo.scheduled) {
    return {
      scheduled: false,
      priority: 1,
      timeValue: getKitchenOrderTimeValue(order) || Number.POSITIVE_INFINITY
    };
  }

  if (scheduledInfo.reason === "preorder") {
    return {
      scheduled: true,
      priority: 3,
      timeValue: Number.POSITIVE_INFINITY
    };
  }

  if (scheduledInfo.minutesUntilPickup <= 0) {
    return {
      scheduled: true,
      priority: 0,
      timeValue: scheduledInfo.timeValue
    };
  }

  if (scheduledInfo.shouldShowInActive) {
    return {
      scheduled: true,
      priority: 2,
      timeValue: scheduledInfo.timeValue
    };
  }

  return {
    scheduled: true,
    priority: 3,
    timeValue: scheduledInfo.timeValue
  };
}

export function sortKitchenOrdersForBoard(orders = []) {
  const now = Date.now();

  return [...orders].sort((first, second) => {
    const firstDoing = !isKitchenOrderDone(first);
    const secondDoing = !isKitchenOrderDone(second);

    if (firstDoing !== secondDoing) return firstDoing ? -1 : 1;

    if (firstDoing && secondDoing) {
      const firstSort = getScheduledPickupSortInfo(first, now);
      const secondSort = getScheduledPickupSortInfo(second, now);
      if (firstSort.priority !== secondSort.priority) return firstSort.priority - secondSort.priority;

      const firstTime = firstSort.timeValue;
      const secondTime = secondSort.timeValue;
      if (firstTime !== secondTime) return firstTime - secondTime;
    }

    if (!firstDoing && !secondDoing) {
      const firstDoneTime = getKitchenOrderDoneTimeValue(first);
      const secondDoneTime = getKitchenOrderDoneTimeValue(second);
      if (firstDoneTime !== secondDoneTime) return secondDoneTime - firstDoneTime;

      const firstOrderTime = getKitchenOrderTimeValue(first);
      const secondOrderTime = getKitchenOrderTimeValue(second);
      if (firstOrderTime !== secondOrderTime) return secondOrderTime - firstOrderTime;
    }

    return toText(first.displayOrderCode || first.orderCode || first.id).localeCompare(
      toText(second.displayOrderCode || second.orderCode || second.id),
      "vi"
    );
  });
}

export function sortKitchenDoneOrders(orders = []) {
  return [...orders].sort((first, second) => {
    const firstDoneTime = getKitchenOrderDoneTimeValue(first);
    const secondDoneTime = getKitchenOrderDoneTimeValue(second);
    if (firstDoneTime !== secondDoneTime) return secondDoneTime - firstDoneTime;

    const firstOrderTime = getKitchenOrderTimeValue(first);
    const secondOrderTime = getKitchenOrderTimeValue(second);
    if (firstOrderTime !== secondOrderTime) return secondOrderTime - firstOrderTime;

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
          activeOrderPendingQuantity: 0,
          otherOrdersPendingQuantity: 0,
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
      const orderKey = getKitchenOrderKey(order);
      group.totalQuantity += quantity;
      group.pendingQuantity += pendingQuantity;
      group.doneQuantity += doneQuantity;
      if (pendingQuantity > 0) {
        if (activeOrderKey && orderKey === activeOrderKey) {
          group.activeOrderPendingQuantity += pendingQuantity;
        } else {
          group.otherOrdersPendingQuantity += pendingQuantity;
        }
      }
      group.options.push(...recipeOptions.map((option) => option.label));

      if (pendingQuantity > 0) {
        group.oldestPendingTimeValue = Math.min(group.oldestPendingTimeValue, orderTime);
        if (group.firstPendingOrderTimeValue === Number.POSITIVE_INFINITY) {
          group.firstPendingOrderTimeValue = orderTime;
          group.firstPendingQuantity = pendingQuantity;
        }

          group.orders.push({
            key: orderKey,
            code: getOrderCode(order),
            platform: order.platform || "",
            quantity: pendingQuantity,
            itemIndex: firstItemNumber
          });
      }

      if (item.note && pendingQuantity > 0) {
        group.notes.push({
          orderKey,
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
