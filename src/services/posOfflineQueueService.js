import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";

const POS_OFFLINE_QUEUE_KEY = "ghr_pos_offline_order_queue_v1";
const POS_OFFLINE_QUEUE_EVENT = "ghr:pos-offline-queue-changed";
const PENDING_SYNC = "pending_sync";
const SYNCED = "synced";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  } catch {
  }
  return null;
}

function notifyQueueChanged(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(POS_OFFLINE_QUEUE_EVENT, {
    detail: {
      ...detail,
      emittedAt: Date.now()
    }
  }));
}

function readQueue() {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const parsed = JSON.parse(storage.getItem(POS_OFFLINE_QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry) => entry?.order) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue = []) {
  const storage = getStorage();
  const normalized = Array.isArray(queue) ? queue.filter((entry) => entry?.order) : [];
  if (!storage) return normalized;

  try {
    if (normalized.length) {
      storage.setItem(POS_OFFLINE_QUEUE_KEY, JSON.stringify(normalized));
    } else {
      storage.removeItem(POS_OFFLINE_QUEUE_KEY);
    }
  } catch {
  }

  notifyQueueChanged({ pendingCount: normalized.length });
  return normalized;
}

function getOrderId(order = {}) {
  return toText(order.id || order.orderCode);
}

function getOrderBranchKeys(order = {}) {
  const metadata = getObject(order.metadata);
  return [
    order.branchUuid,
    order.branch_uuid,
    order.pickupBranchUuid,
    order.pickup_branch_uuid,
    order.deliveryBranchUuid,
    order.delivery_branch_uuid,
    order.branchId,
    order.branch_id,
    metadata.branchUuid,
    metadata.branch_uuid,
    metadata.pickupBranchUuid,
    metadata.pickup_branch_uuid,
    metadata.deliveryBranchUuid,
    metadata.delivery_branch_uuid,
    metadata.branchId,
    metadata.branch_id,
    metadata.posBranchUuid,
    metadata.pos_branch_uuid
  ].map(toText).filter(Boolean);
}

function matchesBranch(order = {}, branchValue = "") {
  const safeBranchValue = toText(branchValue);
  if (!safeBranchValue) return true;
  return getOrderBranchKeys(order).includes(safeBranchValue);
}

function stampOrderSyncStatus(order = {}, syncStatus = PENDING_SYNC, syncError = "") {
  const metadata = getObject(order.metadata);
  const nextMetadata = {
    ...metadata,
    syncStatus,
    syncUpdatedAt: new Date().toISOString()
  };

  if (syncError) {
    nextMetadata.syncError = syncError;
  } else {
    delete nextMetadata.syncError;
  }

  return {
    ...order,
    syncStatus,
    syncError: syncError || "",
    metadata: nextMetadata
  };
}

function buildQueueEntry(order = {}, error = "") {
  const now = new Date().toISOString();
  const previousMetadata = getObject(order.metadata);
  const previousAttempts = Number(order.syncAttemptCount || previousMetadata.syncAttemptCount || 0);
  const syncError = toText(error || order.syncError || previousMetadata.syncError);
  const stampedOrder = stampOrderSyncStatus(order, PENDING_SYNC, syncError);

  return {
    id: getOrderId(stampedOrder),
    order: {
      ...stampedOrder,
      syncAttemptCount: previousAttempts,
      metadata: {
        ...getObject(stampedOrder.metadata),
        syncAttemptCount: previousAttempts
      }
    },
    queuedAt: toText(previousMetadata.syncQueuedAt) || now,
    updatedAt: now,
    lastError: syncError
  };
}

function sortQueue(queue = []) {
  return [...queue].sort((first, second) => {
    const firstTime = new Date(first.queuedAt || first.updatedAt || 0).getTime();
    const secondTime = new Date(second.queuedAt || second.updatedAt || 0).getTime();
    return firstTime - secondTime;
  });
}

export function enqueuePosOfflineOrder(order = {}, error = "") {
  const id = getOrderId(order);
  if (!id) return null;

  const queue = readQueue();
  const current = queue.find((entry) => entry.id === id);
  const entry = buildQueueEntry({
    ...(current?.order || {}),
    ...order,
    metadata: {
      ...getObject(current?.order?.metadata),
      ...getObject(order.metadata),
      syncQueuedAt: current?.queuedAt || getObject(order.metadata).syncQueuedAt || new Date().toISOString()
    }
  }, error || current?.lastError || "");

  writeQueue(sortQueue([
    ...queue.filter((item) => item.id !== id),
    entry
  ]));

  return entry.order;
}

export function removePosOfflineOrder(orderOrId = "") {
  const id = typeof orderOrId === "string" ? toText(orderOrId) : getOrderId(orderOrId);
  if (!id) return readQueue();
  return writeQueue(readQueue().filter((entry) => entry.id !== id));
}

export function getPendingPosOfflineOrders({ branchValue = "" } = {}) {
  return sortQueue(readQueue())
    .map((entry) => entry.order)
    .filter((order) => matchesBranch(order, branchValue));
}

export function getPendingPosOfflineOrderCount(options = {}) {
  return getPendingPosOfflineOrders(options).length;
}

function canUseNetwork() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

function markSyncFailure(entry = {}, error = null) {
  const message = toText(error?.message || error?.details || error?.hint || "Không đồng bộ được đơn POS.");
  const attempts = Math.max(0, Number(entry.order?.syncAttemptCount || entry.order?.metadata?.syncAttemptCount || 0)) + 1;
  const failedOrder = stampOrderSyncStatus(entry.order, PENDING_SYNC, message);

  return {
    ...entry,
    order: {
      ...failedOrder,
      syncAttemptCount: attempts,
      metadata: {
        ...getObject(failedOrder.metadata),
        syncAttemptCount: attempts
      }
    },
    updatedAt: new Date().toISOString(),
    lastError: message
  };
}

function buildRemoteOrder(order = {}) {
  const syncedOrder = stampOrderSyncStatus(order, SYNCED);
  return {
    ...syncedOrder,
    syncError: "",
    metadata: {
      ...getObject(syncedOrder.metadata),
      syncSource: "pos_offline_queue"
    }
  };
}

export async function syncPendingPosOfflineOrders({ branchValue = "", limit = 20 } = {}) {
  const queue = sortQueue(readQueue());
  const targets = queue
    .filter((entry) => matchesBranch(entry.order, branchValue))
    .slice(0, Math.max(1, Math.floor(Number(limit || 20))));

  if (!targets.length) {
    return { ok: true, syncedCount: 0, failedCount: 0, pendingCount: queue.length, skipped: false };
  }

  if (!canUseNetwork()) {
    return { ok: false, syncedCount: 0, failedCount: 0, pendingCount: queue.length, skipped: true, message: "Thiết bị đang offline." };
  }

  const targetIds = new Set(targets.map((entry) => entry.id));
  const untouched = queue.filter((entry) => !targetIds.has(entry.id));
  const failed = [];
  let syncedCount = 0;

  for (const entry of targets) {
    try {
      await coreSupabaseRepository.upsertOrderToTable(buildRemoteOrder(entry.order));
      syncedCount += 1;
    } catch (error) {
      failed.push(markSyncFailure(entry, error));
    }
  }

  const nextQueue = writeQueue(sortQueue([...untouched, ...failed]));
  return {
    ok: failed.length === 0,
    syncedCount,
    failedCount: failed.length,
    pendingCount: nextQueue.length,
    skipped: false,
    message: failed.length
      ? `Còn ${failed.length} đơn POS chưa đồng bộ được.`
      : syncedCount
        ? `Đã đồng bộ ${syncedCount} đơn POS.`
        : ""
  };
}

export function subscribePosOfflineQueue(onChange) {
  if (typeof window === "undefined" || typeof onChange !== "function") return () => {};
  const handler = (event) => onChange(event.detail || {});
  window.addEventListener(POS_OFFLINE_QUEUE_EVENT, handler);
  return () => window.removeEventListener(POS_OFFLINE_QUEUE_EVENT, handler);
}

