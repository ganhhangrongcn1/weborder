import { getCustomerKey } from "../storageService.js";
import { createRuntimeAppConfigRepository } from "./appConfigRepository.js";
import { coreSupabaseRepository } from "./coreSupabaseRepository.js";
import { normalizeOrdersByPhoneMap } from "./phoneDataMigration.js";
import { getRuntimeStrategy } from "./runtimeStrategy.js";
import { STORAGE_KEYS } from "./storageKeys.js";
import { shouldAllowLocalFallbackForDomain, shouldWriteDomainToSupabase } from "./writeThroughPolicy.js";
import { enqueuePosOfflineOrder, removePosOfflineOrder } from "../posOfflineQueueService.js";

const repository = createRuntimeAppConfigRepository();
const REMOTE_CACHE_TTL_MS = 8000;
const CUSTOMER_REALTIME_SYNC_DELAY_MS = 900;
const DEFAULT_CUSTOMER_ORDER_SYNC_LIMIT = 6;
const CUSTOMER_ORDER_REMOTE_WRITE_TIMEOUT_MS = 15000;
const CUSTOMER_ORDER_REMOTE_VERIFY_TIMEOUT_MS = 7000;
const ORDER_SYNC_STATUS = {
  pending: "pending_sync",
  synced: "synced"
};
let ordersRemoteCache = { value: null, cachedAt: 0 };
let ordersReadInFlight = null;

function createOrderRemoteTimeoutError(code = "ORDER_REMOTE_WRITE_TIMEOUT") {
  const error = new Error("order_remote_timeout");
  error.code = code;
  return error;
}

function runOrderTaskWithTimeout(task, timeoutMs, timeoutCode) {
  const controller = typeof globalThis.AbortController === "function"
    ? new globalThis.AbortController()
    : null;
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(createOrderRemoteTimeoutError(timeoutCode));
    }, timeoutMs);
  });
  return Promise.race([
    Promise.resolve().then(() => task(controller?.signal || null)),
    timeoutPromise
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function isLegacySeededDemoCart(cart = []) {
  if (!Array.isArray(cart) || !cart.length) return false;
  const totalQty = cart.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
  const totalLine = cart.reduce((sum, item) => sum + Number(item?.lineTotal || 0), 0);
  const names = cart.map((item) => String(item?.name || "").trim().toLowerCase());
  const hasLegacyNames =
    names.includes("bánh tráng tỏi bò cay cay") &&
    names.includes("bánh tráng phơi sương");
  return hasLegacyNames && totalQty === 3 && totalLine === 168000;
}

function notifyOrdersChanged(detail = {}) {
  if (typeof window === "undefined") return;
  const changedPhones = Array.from(
    new Set(
      (Array.isArray(detail.changedPhones) ? detail.changedPhones : [])
        .map((phone) => getCustomerKey(phone))
        .filter(Boolean)
    )
  );
  window.dispatchEvent(new CustomEvent("ghr:orders-changed", {
    detail: {
      ...detail,
      changedPhones,
      emittedAt: Date.now()
    }
  }));
}

function sortByCreatedAtDesc(items = []) {
  return [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOrderItemForRead(item = {}, index = 0) {
  const quantity = Math.max(1, toFiniteNumber(item.quantity, 1));
  const unitTotal = toFiniteNumber(item.unitTotal ?? item.price ?? item.unitPrice, 0);
  const lineTotal = toFiniteNumber(item.lineTotal, unitTotal * quantity);
  const sourceItemId = String(item.sourceItemId || item.source_item_id || item.rowId || "");
  const id = String(item.id || item.productId || item.product_id || sourceItemId || `item-${index}`);
  const productId = String(item.productId || item.product_id || id);
  const toppings = Array.isArray(item.toppings) ? item.toppings : [];
  const optionGroups = Array.isArray(item.optionGroups) ? item.optionGroups : [];
  const options = Array.from(
    new Set(
      [
        ...(Array.isArray(item.options) ? item.options : []),
        ...toppings.map((option) => option?.label || option?.name || option?.value || ""),
        ...optionGroups.flatMap((group) => {
          if (Array.isArray(group?.options)) return group.options;
          if (Array.isArray(group?.items)) return group.items;
          return Array.isArray(group) ? group : [group];
        }).map((option) => option?.label || option?.name || option?.value || option?.title || "")
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
  const kitchenItemStatus = String(item.kitchenItemStatus || item.kitchen_item_status || item.status || "pending");

  return {
    ...item,
    id,
    sourceItemId,
    orderId: String(item.orderId || item.order_id || ""),
    productId,
    product_id: productId,
    name: String(item.name || item.productName || item.product_name || ""),
    quantity,
    price: toFiniteNumber(item.price ?? unitTotal, unitTotal),
    unitTotal,
    lineTotal,
    spice: item.spice || "",
    note: item.note || "",
    toppings,
    optionGroups,
    options,
    kitchenItemStatus,
    status: kitchenItemStatus,
    metadata: item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
      ? item.metadata
      : {}
  };
}

function normalizeOrderForRead(order = {}, phoneFallback = "") {
  const id = String(order.id || order.orderCode || "");
  const orderCode = String(order.orderCode || id);
  const phoneKey = getCustomerKey(order.phone || order.customerPhoneKey || order.customerPhone || phoneFallback);
  const createdAt = order.createdAt || order.created_at || order.orderTime || "";
  const items = Array.isArray(order.items) ? order.items.map(normalizeOrderItemForRead) : [];
  const subtotal = toFiniteNumber(
    order.subtotal,
    items.reduce((sum, item) => sum + toFiniteNumber(item.lineTotal, 0), 0)
  );
  const totalAmount = toFiniteNumber(order.totalAmount ?? order.total, subtotal);
  const source = String(order.source || order.orderSource || order.channel || order.platform || "weborder");

  return {
    ...order,
    id: id || orderCode,
    orderCode: orderCode || id,
    sourceType: order.sourceType || "weborder",
    source,
    channel: order.channel || source,
    platform: order.platform || source,
    orderSource: order.orderSource || source,
    partnerSource: order.partnerSource || "weborder",
    phone: phoneKey || order.phone || "",
    customerPhoneKey: phoneKey || order.customerPhoneKey || "",
    rawCustomerPhone: order.rawCustomerPhone || order.customerPhone || order.phone || phoneFallback || "",
    customerPhone: order.customerPhone || phoneKey || "",
    customerName: order.customerName || order.orderCustomerName || "",
    orderCustomerName: order.orderCustomerName || order.customerName || "",
    status: order.status || order.orderStatus || "pending_zalo",
    orderStatus: order.orderStatus || order.status || "pending_zalo",
    fulfillmentType: order.fulfillmentType || "delivery",
    paymentMethod: order.paymentMethod || "cash",
    createdAt,
    orderTime: order.orderTime || createdAt,
    items,
    subtotal,
    totalAmount,
    total: toFiniteNumber(order.total ?? order.totalAmount, totalAmount),
    shippingFee: toFiniteNumber(order.shippingFee ?? order.deliveryFee, 0),
    deliveryFee: toFiniteNumber(order.deliveryFee ?? order.shippingFee, 0),
    originalShippingFee: toFiniteNumber(order.originalShippingFee ?? order.shippingFee ?? order.deliveryFee, 0),
    shippingSupportDiscount: toFiniteNumber(order.shippingSupportDiscount, 0),
    promoDiscount: toFiniteNumber(order.promoDiscount, 0),
    pointsDiscount: toFiniteNumber(order.pointsDiscount, 0),
    pointsEarned: toFiniteNumber(order.pointsEarned, 0)
  };
}

function normalizeOrdersByPhoneForRead(ordersByPhone = {}) {
  return Object.entries(ordersByPhone || {}).reduce((acc, [phone, orders]) => {
    const phoneKey = getCustomerKey(phone) || String(phone || "").trim();
    if (!phoneKey) return acc;
    acc[phoneKey] = sortByCreatedAtDesc(
      (Array.isArray(orders) ? orders : []).map((order) => normalizeOrderForRead(order, phoneKey))
    );
    return acc;
  }, {});
}

function filterOrdersByDateRange(ordersByPhone = {}, dateFrom = "", dateTo = "") {
  const fromTime = dateFrom ? new Date(dateFrom).getTime() : 0;
  const toTime = dateTo ? new Date(dateTo).getTime() : 0;
  const hasFrom = Number.isFinite(fromTime) && fromTime > 0;
  const hasTo = Number.isFinite(toTime) && toTime > 0;
  if (!hasFrom && !hasTo) return ordersByPhone;

  return Object.entries(ordersByPhone || {}).reduce((acc, [phone, orders]) => {
    const filtered = (Array.isArray(orders) ? orders : []).filter((order) => {
      const createdAt = order?.createdAt || order?.created_at || order?.orderTime || order?.order_time || "";
      const time = new Date(createdAt || 0).getTime();
      if (!Number.isFinite(time)) return false;
      if (hasFrom && time < fromTime) return false;
      if (hasTo && time >= toTime) return false;
      return true;
    });
    if (filtered.length) acc[phone] = filtered;
    return acc;
  }, {});
}

function canWriteOrdersToSupabase() {
  return shouldWriteDomainToSupabase("orders");
}

function resolveOrderStorageKey(order = {}) {
  const phoneKey = getCustomerKey(order.phone || order.customerPhone);
  if (phoneKey) return phoneKey;

  const customerPhoneKey = String(order.customerPhoneKey || "").trim();
  if (customerPhoneKey.startsWith("walkin:")) return customerPhoneKey;

  const orderId = String(order.id || order.orderCode || "").trim();
  return orderId ? `walkin:${orderId}` : "";
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isPosOrderForSync(order = {}) {
  const metadata = getObject(order.metadata);
  return [order.channel, order.platform, order.orderSource, order.partnerSource, metadata.channel, metadata.source, metadata.orderSource]
    .map((value) => String(value || "").trim().toLowerCase())
    .includes("pos");
}

function isCashPaidPosOrder(order = {}) {
  if (!isPosOrderForSync(order)) return false;
  const metadata = getObject(order.metadata);
  const paymentMethod = String(order.paymentMethod || metadata.paymentMethod || "").trim().toLowerCase();
  const paymentStatus = String(order.paymentStatus || metadata.paymentStatus || "").trim().toLowerCase();
  return paymentMethod === "cash" && paymentStatus === "paid";
}

function withOrderSyncStatus(order = {}, syncStatus = "", syncError = "") {
  if (!isPosOrderForSync(order) || !syncStatus) return order;
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

function sameOrderIdentity(order = {}, targetId = "") {
  const safeTargetId = String(targetId || "").trim();
  if (!safeTargetId) return false;
  return [order.id, order.orderCode].map((value) => String(value || "").trim()).includes(safeTargetId);
}

function hasCompleteRemoteOrder(remoteOrders = [], order = {}) {
  const orderId = String(order.id || order.orderCode || "").trim();
  if (!orderId) return false;
  const remoteOrder = (Array.isArray(remoteOrders) ? remoteOrders : []).find(
    (candidate) => sameOrderIdentity(candidate, orderId)
  );
  if (!remoteOrder) return false;

  const expectedItemCount = Array.isArray(order.items) ? order.items.length : 0;
  const remoteItemCount = Array.isArray(remoteOrder.items) ? remoteOrder.items.length : 0;
  return expectedItemCount === 0 || remoteItemCount >= expectedItemCount;
}

async function verifyOrderWasPersistedAfterError(order = {}) {
  const phone = getCustomerKey(order.phone || order.customerPhone);
  if (!phone) return false;
  try {
    const remoteOrders = await runOrderTaskWithTimeout(
      (signal) => coreSupabaseRepository.readOrdersForPhoneFromTable(
        phone,
        { limit: 20, includeItems: true, signal }
      ),
      CUSTOMER_ORDER_REMOTE_VERIFY_TIMEOUT_MS,
      "ORDER_REMOTE_VERIFY_TIMEOUT"
    );
    return hasCompleteRemoteOrder(remoteOrders, order);
  } catch (verificationError) {
    console.warn("[orderRepository] verify persisted order after write error failed", verificationError);
    return false;
  }
}

async function persistOrderLocalAsync(nextOrder, phoneKey) {
  await repository.setAsync(STORAGE_KEYS.lastCreatedOrderId, String(nextOrder.id || nextOrder.orderCode || "").trim());
  await repository.setAsync(STORAGE_KEYS.currentOrder, nextOrder || null);
  const all = await orderRepository.getAllByPhoneAsync();
  const current = Array.isArray(all[phoneKey]) ? all[phoneKey] : [];
  const orderId = String(nextOrder.id || nextOrder.orderCode || "").trim();
  const withoutCurrentOrder = current.filter((order) => !sameOrderIdentity(order, orderId));
  const next = { ...all, [phoneKey]: [nextOrder, ...withoutCurrentOrder] };
  const normalizedNext = normalizeOrdersByPhoneMap(next);
  await repository.setAsync(STORAGE_KEYS.ordersByPhone, normalizedNext);
  ordersRemoteCache = { value: normalizedNext, cachedAt: Date.now() };
  notifyOrdersChanged({ source: "persist-order-local", changedPhones: [phoneKey] });
  return nextOrder;
}

export const orderRepository = {
  getCartDraft(fallback = []) {
    const raw = repository.get(STORAGE_KEYS.cartDraft, fallback);
    const normalized = Array.isArray(raw) ? raw : fallback;
    if (isLegacySeededDemoCart(normalized)) {
      repository.set(STORAGE_KEYS.cartDraft, []);
      return [];
    }
    return normalized;
  },
  saveCartDraft(nextCart) {
    const normalized = Array.isArray(nextCart) ? nextCart : [];
    return repository.set(STORAGE_KEYS.cartDraft, normalized);
  },
  clearCartDraft() {
    return repository.set(STORAGE_KEYS.cartDraft, []);
  },
  getOrderStatus(fallback = "confirmed") {
    return repository.get(STORAGE_KEYS.legacyOrderStatus, fallback);
  },
  saveOrderStatus(nextStatus) {
    return nextStatus;
  },
  getCurrentOrder(fallback = null) {
    const current = repository.get(STORAGE_KEYS.currentOrder, fallback);
    return current ? normalizeOrderForRead(current) : current;
  },
  saveCurrentOrder(nextOrder) {
    return repository.set(STORAGE_KEYS.currentOrder, nextOrder || null);
  },
  saveCustomerActionToken(orderId, token) {
    const id = String(orderId || "").trim();
    const safeToken = String(token || "").trim();
    if (!id || !safeToken) return "";
    const current = repository.get(STORAGE_KEYS.customerOrderActionTokens, {});
    repository.set(STORAGE_KEYS.customerOrderActionTokens, {
      ...(current && typeof current === "object" ? current : {}),
      [id]: safeToken
    });
    return safeToken;
  },
  getCustomerActionToken(orderId) {
    const id = String(orderId || "").trim();
    if (!id) return "";
    const current = repository.get(STORAGE_KEYS.customerOrderActionTokens, {});
    return String(current?.[id] || "").trim();
  },
  clearCustomerActionToken(orderId) {
    const id = String(orderId || "").trim();
    if (!id) return false;
    const current = repository.get(STORAGE_KEYS.customerOrderActionTokens, {});
    if (!current || typeof current !== "object" || !(id in current)) return false;
    const next = { ...current };
    delete next[id];
    repository.set(STORAGE_KEYS.customerOrderActionTokens, next);
    return true;
  },
  hydrateRecoveredOrder(order = {}) {
    const nextOrder = normalizeOrderForRead(order);
    const orderId = String(nextOrder.id || nextOrder.orderCode || "").trim();
    if (!orderId) return null;

    const storageKey = resolveOrderStorageKey(nextOrder);
    this.saveLastCreatedOrderId(orderId);
    this.saveCurrentOrder(nextOrder);

    if (storageKey) {
      const all = this.getAllByPhone();
      const current = Array.isArray(all[storageKey]) ? all[storageKey] : [];
      const withoutRecoveredOrder = current.filter((item) => !sameOrderIdentity(item, orderId));
      this.saveAllByPhone(
        { ...all, [storageKey]: [nextOrder, ...withoutRecoveredOrder] },
        { skipRemote: true }
      );
    } else {
      notifyOrdersChanged({ source: "momo-return-recovery" });
    }

    return nextOrder;
  },
  saveLastCreatedOrderId(orderId) {
    const id = String(orderId || "").trim();
    return repository.set(STORAGE_KEYS.lastCreatedOrderId, id || "");
  },
  getLastCreatedOrderId() {
    return String(repository.get(STORAGE_KEYS.lastCreatedOrderId, "") || "").trim();
  },
  clearCurrentOrder() {
    return repository.set(STORAGE_KEYS.currentOrder, null);
  },
  getAllByPhone() {
    const allowLocalFallback = shouldAllowLocalFallbackForDomain("orders");
    if (!allowLocalFallback) {
      return normalizeOrdersByPhoneForRead(normalizeOrdersByPhoneMap(ordersRemoteCache.value || {}));
    }
    const raw = repository.get(STORAGE_KEYS.ordersByPhone, {});
    const normalized = normalizeOrdersByPhoneMap(raw);
    if (JSON.stringify(raw || {}) !== JSON.stringify(normalized || {})) {
      repository.set(STORAGE_KEYS.ordersByPhone, normalized);
    }
    return normalizeOrdersByPhoneForRead(normalized);
  },
  saveAllByPhone(next, options = {}) {
    const normalized = normalizeOrdersByPhoneMap(next || {});
    const saved = repository.set(STORAGE_KEYS.ordersByPhone, normalized);
    ordersRemoteCache = { value: normalized, cachedAt: Date.now() };
    notifyOrdersChanged({ source: "save-all-by-phone", changedPhones: Object.keys(normalized) });
    if (!options?.skipRemote && canWriteOrdersToSupabase()) {
      coreSupabaseRepository.writeOrdersByPhoneToTable(normalized).catch((error) => {
        console.warn("[orderRepository] write orders tables failed", error);
      });
    }
    return normalizeOrdersByPhoneForRead(saved);
  },
  getByPhone(phone) {
    const key = getCustomerKey(phone);
    if (!key) return [];
    const all = this.getAllByPhone();
    return Array.isArray(all[key]) ? all[key] : [];
  },
  getAll() {
    const all = this.getAllByPhone();
    return sortByCreatedAtDesc(Object.values(all).flat());
  },
  upsertOrder(order) {
    const nextOrder = { id: order.id || order.orderCode || `order_${Date.now()}`, ...order };
    const key = resolveOrderStorageKey(nextOrder);
    if (!key) return nextOrder;
    const normalizedPhone = getCustomerKey(nextOrder.phone || nextOrder.customerPhone);
    nextOrder.phone = normalizedPhone;
    nextOrder.customerPhone = normalizedPhone;
    nextOrder.customerPhoneKey = key;
    nextOrder.rawCustomerPhone = nextOrder.rawCustomerPhone || nextOrder.customerPhone || nextOrder.phone;
    this.saveLastCreatedOrderId(nextOrder.id || nextOrder.orderCode || "");
    this.saveCurrentOrder(nextOrder);
    const all = this.getAllByPhone();
    const current = Array.isArray(all[key]) ? all[key] : [];
    this.saveAllByPhone({ ...all, [key]: [nextOrder, ...current] }, { skipRemote: true });
    if (canWriteOrdersToSupabase()) {
      coreSupabaseRepository.upsertOrderToTable(nextOrder).catch((error) => {
        console.warn("[orderRepository] upsert single order failed", error);
      });
    }
    return nextOrder;
  },
  async getAllByPhoneAsync(options = {}) {
    const dateFrom = String(options?.dateFrom || "").trim();
    const dateTo = String(options?.dateTo || "").trim();
    const requireRemote = options?.requireRemote === true;
    const includeItems = options?.includeItems !== false;
    const hasDateFilter = Boolean(dateFrom || dateTo);
    const now = Date.now();
    if (!requireRemote && includeItems && !hasDateFilter && ordersRemoteCache.value && now - ordersRemoteCache.cachedAt < REMOTE_CACHE_TTL_MS) {
      return normalizeOrdersByPhoneForRead(normalizeOrdersByPhoneMap(ordersRemoteCache.value || {}));
    }
    if (!requireRemote && includeItems && !hasDateFilter && ordersReadInFlight) {
      return ordersReadInFlight;
    }
    const readTask = (async () => {
    const allowLocalFallback = !requireRemote && shouldAllowLocalFallbackForDomain("orders");
    const fallback = allowLocalFallback ? await repository.getAsync(STORAGE_KEYS.ordersByPhone, {}) : {};
    try {
      const remote = await coreSupabaseRepository.readOrdersByPhoneFromTable(
        {
          ...(hasDateFilter ? { dateFrom, dateTo } : {}),
          includeItems
        }
      );
      if (remote && typeof remote === "object") {
        const remoteOnly = normalizeOrdersByPhoneMap(remote);
        if (includeItems && !hasDateFilter) {
          repository.set(STORAGE_KEYS.ordersByPhone, remoteOnly);
          ordersRemoteCache = { value: remoteOnly, cachedAt: Date.now() };
        }
        return normalizeOrdersByPhoneForRead(remoteOnly);
      }
      if (requireRemote) {
        throw new Error("Không thể kết nối nguồn đơn hàng Supabase.");
      }
    } catch (error) {
      console.warn("[orderRepository] read orders tables failed", error);
      if (requireRemote) throw error;
    }
      let normalizedFallback = normalizeOrdersByPhoneMap(fallback);
      if (hasDateFilter) {
        normalizedFallback = filterOrdersByDateRange(normalizedFallback, dateFrom, dateTo);
      }
      if (includeItems && !hasDateFilter) {
        ordersRemoteCache = { value: normalizedFallback, cachedAt: Date.now() };
      }
      return normalizeOrdersByPhoneForRead(normalizedFallback);
    })();
    if (includeItems && !hasDateFilter) {
      ordersReadInFlight = readTask;
    }
    try {
      return await readTask;
    } finally {
      if (includeItems && !hasDateFilter) {
        ordersReadInFlight = null;
      }
    }
  },
  async saveAllByPhoneAsync(next, options = {}) {
    const normalized = normalizeOrdersByPhoneMap(next || {});
    const saved = await repository.setAsync(STORAGE_KEYS.ordersByPhone, normalized);
    ordersRemoteCache = { value: normalized, cachedAt: Date.now() };
    notifyOrdersChanged({ source: "save-all-by-phone-async", changedPhones: Object.keys(normalized) });
    if (!options?.skipRemote && canWriteOrdersToSupabase()) {
      try {
        await coreSupabaseRepository.writeOrdersByPhoneToTable(normalized);
      } catch (error) {
        console.warn("[orderRepository] write orders tables failed", error);
      }
    }
    return normalizeOrdersByPhoneForRead(saved);
  },
  async getByPhoneAsync(phone, options = {}) {
    const key = getCustomerKey(phone);
    if (!key) return [];
    const limit = Number(options?.limit || 0);
    try {
      const remoteOrders = await coreSupabaseRepository.readOrdersForPhoneFromTable(
        key,
        {
          ...(Number.isFinite(limit) && limit > 0 ? { limit: Math.floor(limit) } : {}),
          includeItems: options?.includeItems !== false
        }
      );
      if (Array.isArray(remoteOrders)) {
        const all = normalizeOrdersByPhoneMap(await repository.getAsync(STORAGE_KEYS.ordersByPhone, {}));
        const nextAll = normalizeOrdersByPhoneMap({ ...all, [key]: remoteOrders });
        await repository.setAsync(STORAGE_KEYS.ordersByPhone, nextAll);
        ordersRemoteCache = { value: nextAll, cachedAt: Date.now() };
        const readable = normalizeOrdersByPhoneForRead(nextAll);
        return Array.isArray(readable[key]) ? readable[key] : [];
      }
    } catch (error) {
      console.warn("[orderRepository] read orders by phone failed", error);
    }
    const all = await this.getAllByPhoneAsync();
    const fallbackOrders = Array.isArray(all[key]) ? all[key] : [];
    return Number.isFinite(limit) && limit > 0 ? fallbackOrders.slice(0, Math.floor(limit)) : fallbackOrders;
  },
  async getAllAsync(options = {}) {
    const all = await this.getAllByPhoneAsync(options);
    return sortByCreatedAtDesc(Object.values(all).flat());
  },
  async upsertOrderAsync(order) {
    const nextOrder = { id: order.id || order.orderCode || `order_${Date.now()}`, ...order };
    const key = resolveOrderStorageKey(nextOrder);
    if (!key) return nextOrder;
    const normalizedPhone = getCustomerKey(nextOrder.phone || nextOrder.customerPhone);
    nextOrder.phone = normalizedPhone;
    nextOrder.customerPhone = normalizedPhone;
    nextOrder.customerPhoneKey = key;
    nextOrder.rawCustomerPhone = nextOrder.rawCustomerPhone || nextOrder.customerPhone || nextOrder.phone;
    const localPendingOrder = withOrderSyncStatus(nextOrder, ORDER_SYNC_STATUS.pending);
    const runtime = getRuntimeStrategy();
    const shouldWriteOrders = canWriteOrdersToSupabase();
    const shouldWaitForLocalBeforeRemote = !shouldWriteOrders || isCashPaidPosOrder(nextOrder);
    if (shouldWaitForLocalBeforeRemote) {
      await persistOrderLocalAsync(localPendingOrder, key);
    } else {
      // Một số trình duyệt nhúng trên iPhone có thể treo IndexedDB. Không để
      // bộ nhớ cục bộ chặn việc ghi đơn lên Supabase.
      persistOrderLocalAsync(localPendingOrder, key).catch((localSyncError) => {
        console.warn("[orderRepository] pending order local sync failed", localSyncError);
      });
    }
    console.info("[order-debug] upsertOrderAsync:runtime", {
      source: runtime?.source,
      effectiveSource: runtime?.effectiveSource,
      strictModeEnabled: runtime?.strictModeEnabled,
      hasSupabaseClient: runtime?.hasSupabaseClient,
      shouldReadThroughSupabase: runtime?.shouldReadThroughSupabase,
      shouldWriteThroughSupabase: runtime?.shouldWriteThroughSupabase,
      shouldWriteOrders
    });
    if (shouldWriteOrders) {
      let remoteWriteConfirmed = false;
      try {
        console.info("[order-debug] upsertOrderAsync:remote-write:start", {
          orderId: nextOrder.id,
          orderCode: nextOrder.orderCode
        });
        await runOrderTaskWithTimeout(
          (signal) => coreSupabaseRepository.upsertOrderToTable(nextOrder, { signal }),
          CUSTOMER_ORDER_REMOTE_WRITE_TIMEOUT_MS,
          "ORDER_REMOTE_WRITE_TIMEOUT"
        );
        remoteWriteConfirmed = true;
        console.info("[order-debug] upsertOrderAsync:remote-write:ok", {
          orderId: nextOrder.id
        });
      } catch (error) {
        remoteWriteConfirmed = await verifyOrderWasPersistedAfterError(nextOrder);
        if (remoteWriteConfirmed) {
          console.warn("[orderRepository] write response failed but order is already complete in Supabase", {
            orderId: nextOrder.id || nextOrder.orderCode || ""
          });
          console.info("[order-debug] upsertOrderAsync:remote-write:verified-after-error", {
            orderId: nextOrder.id || nextOrder.orderCode || ""
          });
        } else {
          console.warn("[orderRepository] upsert single order failed", error);
          console.error("[order-debug] upsertOrderAsync:remote-write:failed", {
            message: error?.message || String(error || ""),
            code: error?.code || "",
            details: error?.details || "",
            hint: error?.hint || ""
          });
          if (isCashPaidPosOrder(nextOrder)) {
            const pendingOrder = withOrderSyncStatus(
              nextOrder,
              ORDER_SYNC_STATUS.pending,
              error?.message || "Supabase write failed"
            );
            await persistOrderLocalAsync(pendingOrder, key);
            enqueuePosOfflineOrder(pendingOrder, error?.message || "Supabase write failed");
            return pendingOrder;
          }
          throw error;
        }
      }

      if (remoteWriteConfirmed) {
        const syncedOrder = withOrderSyncStatus(nextOrder, ORDER_SYNC_STATUS.synced);
        if (syncedOrder !== nextOrder) {
          // Supabase is the source of truth at this point. Do not keep the
          // checkout overlay waiting for browser storage, which can stall in
          // mobile in-app browsers even though the order is already complete.
          persistOrderLocalAsync(syncedOrder, key).catch((localSyncError) => {
            console.warn("[orderRepository] order was saved remotely but local sync failed", localSyncError);
          });
        }
        removePosOfflineOrder(syncedOrder);
        return syncedOrder;
      }
    } else {
      console.warn("[order-debug] upsertOrderAsync:remote-write:skipped");
      if (isCashPaidPosOrder(nextOrder)) {
        enqueuePosOfflineOrder(localPendingOrder, "Supabase chưa sẵn sàng.");
      }
    }
    return localPendingOrder;
  },
  subscribeRealtimeByPhone(phone, onSynced) {
    const key = getCustomerKey(phone);
    if (!key) return () => {};
    if (!canWriteOrdersToSupabase()) return () => {};
    let syncTimer = null;

    const syncOrders = async () => {
      try {
        const remoteOrders = await coreSupabaseRepository.readOrdersForPhoneFromTable(
          key,
          { limit: DEFAULT_CUSTOMER_ORDER_SYNC_LIMIT }
        );
        const all = this.getAllByPhone();
        const merged = normalizeOrdersByPhoneMap({
          ...all,
          [key]: Array.isArray(remoteOrders) ? remoteOrders : []
        });
        const readable = normalizeOrdersByPhoneForRead(merged);
        repository.set(STORAGE_KEYS.ordersByPhone, merged);
        ordersRemoteCache = { value: merged, cachedAt: Date.now() };
        if (Array.isArray(readable[key]) && readable[key].length) {
          this.saveCurrentOrder(readable[key][0]);
        }
        notifyOrdersChanged({ source: "customer-realtime", changedPhones: [key] });
        if (typeof onSynced === "function") onSynced(readable[key] || []);
      } catch (error) {
        console.warn("[orderRepository] subscribe realtime sync failed", error);
      }
    };

    const scheduleSync = () => {
      if (typeof window === "undefined") {
        syncOrders();
        return;
      }
      if (syncTimer) window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        syncTimer = null;
        syncOrders();
      }, CUSTOMER_REALTIME_SYNC_DELAY_MS);
    };

    const handleChange = ({ table, payload }) => {
      if (table === "order_items") {
        const changedOrderId = String(payload?.new?.order_id || payload?.old?.order_id || "").trim();
        const localOrders = this.getByPhone(key);
        const belongsToPhone = localOrders.some((order) => {
          const orderId = String(order?.id || "").trim();
          const orderCode = String(order?.orderCode || "").trim();
          return changedOrderId && (changedOrderId === orderId || changedOrderId === orderCode);
        });
        if (!belongsToPhone) return;
      } else {
        const changedPhone = getCustomerKey(
          payload?.new?.customer_phone || payload?.old?.customer_phone || ""
        );
        if (changedPhone && changedPhone !== key) return;
      }

      scheduleSync();
    };

    const unsubscribe = coreSupabaseRepository.subscribeOrdersRealtime(handleChange);

    return () => {
      if (syncTimer && typeof window !== "undefined") {
        window.clearTimeout(syncTimer);
        syncTimer = null;
      }
      unsubscribe?.();
    };
  }
};
