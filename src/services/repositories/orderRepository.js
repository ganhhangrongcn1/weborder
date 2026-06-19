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
const ORDER_SYNC_STATUS = {
  pending: "pending_sync",
  synced: "synced"
};
let ordersRemoteCache = { value: null, cachedAt: 0 };
let ordersReadInFlight = null;

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
    const hasDateFilter = Boolean(dateFrom || dateTo);
    const now = Date.now();
    if (!hasDateFilter && ordersRemoteCache.value && now - ordersRemoteCache.cachedAt < REMOTE_CACHE_TTL_MS) {
      return normalizeOrdersByPhoneForRead(normalizeOrdersByPhoneMap(ordersRemoteCache.value || {}));
    }
    if (!hasDateFilter && ordersReadInFlight) {
      return ordersReadInFlight;
    }
    const readTask = (async () => {
    const allowLocalFallback = shouldAllowLocalFallbackForDomain("orders");
    const fallback = allowLocalFallback ? await repository.getAsync(STORAGE_KEYS.ordersByPhone, {}) : {};
    try {
      const remote = await coreSupabaseRepository.readOrdersByPhoneFromTable(
        hasDateFilter ? { dateFrom, dateTo } : undefined
      );
      if (remote && typeof remote === "object") {
        const remoteOnly = normalizeOrdersByPhoneMap(remote);
        if (!hasDateFilter) {
          repository.set(STORAGE_KEYS.ordersByPhone, remoteOnly);
          ordersRemoteCache = { value: remoteOnly, cachedAt: Date.now() };
        }
        return normalizeOrdersByPhoneForRead(remoteOnly);
      }
    } catch (error) {
      console.warn("[orderRepository] read orders tables failed", error);
    }
      const normalizedFallback = normalizeOrdersByPhoneMap(fallback);
      if (!hasDateFilter) {
        ordersRemoteCache = { value: normalizedFallback, cachedAt: Date.now() };
      }
      return normalizeOrdersByPhoneForRead(normalizedFallback);
    })();
    if (!hasDateFilter) {
      ordersReadInFlight = readTask;
    }
    try {
      return await readTask;
    } finally {
      if (!hasDateFilter) {
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
    await persistOrderLocalAsync(localPendingOrder, key);
    const runtime = getRuntimeStrategy();
    const shouldWriteOrders = canWriteOrdersToSupabase();
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
      try {
        console.info("[order-debug] upsertOrderAsync:remote-write:start", {
          orderId: nextOrder.id,
          orderCode: nextOrder.orderCode
        });
        await coreSupabaseRepository.upsertOrderToTable(nextOrder);
        console.info("[order-debug] upsertOrderAsync:remote-write:ok", {
          orderId: nextOrder.id
        });
        const syncedOrder = withOrderSyncStatus(nextOrder, ORDER_SYNC_STATUS.synced);
        await persistOrderLocalAsync(syncedOrder, key);
        removePosOfflineOrder(syncedOrder);
        return syncedOrder;
      } catch (error) {
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
