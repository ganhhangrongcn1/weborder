import { getCustomerKey } from "../storageService.js";
import { createRuntimeAppConfigRepository } from "./appConfigRepository.js";
import { coreSupabaseRepository } from "./coreSupabaseRepository.js";
import { normalizeOrdersByPhoneMap } from "./phoneDataMigration.js";
import { STORAGE_KEYS } from "./storageKeys.js";
import { shouldAllowLocalFallbackForDomain, shouldWriteDomainToSupabase } from "./writeThroughPolicy.js";

const repository = createRuntimeAppConfigRepository();
const REMOTE_CACHE_TTL_MS = 8000;
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

function notifyOrdersChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ghr:orders-changed"));
}

function sortByCreatedAtDesc(items = []) {
  return [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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
    return repository.get(STORAGE_KEYS.currentOrder, fallback);
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
      return normalizeOrdersByPhoneMap(ordersRemoteCache.value || {});
    }
    const raw = repository.get(STORAGE_KEYS.ordersByPhone, {});
    const normalized = normalizeOrdersByPhoneMap(raw);
    if (JSON.stringify(raw || {}) !== JSON.stringify(normalized || {})) {
      repository.set(STORAGE_KEYS.ordersByPhone, normalized);
    }
    return normalized;
  },
  saveAllByPhone(next, options = {}) {
    const normalized = normalizeOrdersByPhoneMap(next || {});
    const saved = repository.set(STORAGE_KEYS.ordersByPhone, normalized);
    ordersRemoteCache = { value: normalized, cachedAt: Date.now() };
    notifyOrdersChanged();
    if (!options?.skipRemote && shouldWriteDomainToSupabase("orders")) {
      coreSupabaseRepository.writeOrdersByPhoneToTable(normalized).catch((error) => {
        console.warn("[orderRepository] write orders tables failed", error);
      });
    }
    return saved;
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
    const key = getCustomerKey(nextOrder.phone || nextOrder.customerPhone);
    if (!key) return nextOrder;
    nextOrder.phone = key;
    nextOrder.customerPhoneKey = key;
    nextOrder.rawCustomerPhone = nextOrder.rawCustomerPhone || nextOrder.customerPhone || nextOrder.phone;
    this.saveLastCreatedOrderId(nextOrder.id || nextOrder.orderCode || "");
    this.saveCurrentOrder(nextOrder);
    const all = this.getAllByPhone();
    const current = Array.isArray(all[key]) ? all[key] : [];
    this.saveAllByPhone({ ...all, [key]: [nextOrder, ...current] }, { skipRemote: true });
    if (shouldWriteDomainToSupabase("orders")) {
      coreSupabaseRepository.upsertOrderToTable(nextOrder).catch((error) => {
        console.warn("[orderRepository] upsert single order failed", error);
      });
    }
    return nextOrder;
  },
  async getAllByPhoneAsync() {
    const now = Date.now();
    if (ordersRemoteCache.value && now - ordersRemoteCache.cachedAt < REMOTE_CACHE_TTL_MS) {
      return ordersRemoteCache.value;
    }
    if (ordersReadInFlight) {
      return ordersReadInFlight;
    }
    ordersReadInFlight = (async () => {
    const allowLocalFallback = shouldAllowLocalFallbackForDomain("orders");
    const fallback = allowLocalFallback ? await repository.getAsync(STORAGE_KEYS.ordersByPhone, {}) : {};
    try {
      const remote = await coreSupabaseRepository.readOrdersByPhoneFromTable();
      if (remote && typeof remote === "object") {
        const remoteOnly = normalizeOrdersByPhoneMap(remote);
        repository.set(STORAGE_KEYS.ordersByPhone, remoteOnly);
        ordersRemoteCache = { value: remoteOnly, cachedAt: Date.now() };
        return remoteOnly;
      }
    } catch (error) {
      console.warn("[orderRepository] read orders tables failed", error);
    }
      const normalizedFallback = normalizeOrdersByPhoneMap(fallback);
      ordersRemoteCache = { value: normalizedFallback, cachedAt: Date.now() };
      return normalizedFallback;
    })();
    try {
      return await ordersReadInFlight;
    } finally {
      ordersReadInFlight = null;
    }
  },
  async saveAllByPhoneAsync(next, options = {}) {
    const normalized = normalizeOrdersByPhoneMap(next || {});
    const saved = await repository.setAsync(STORAGE_KEYS.ordersByPhone, normalized);
    ordersRemoteCache = { value: normalized, cachedAt: Date.now() };
    notifyOrdersChanged();
    if (!options?.skipRemote && shouldWriteDomainToSupabase("orders")) {
      try {
        await coreSupabaseRepository.writeOrdersByPhoneToTable(normalized);
      } catch (error) {
        console.warn("[orderRepository] write orders tables failed", error);
      }
    }
    return saved;
  },
  async getByPhoneAsync(phone) {
    const key = getCustomerKey(phone);
    if (!key) return [];
    try {
      const remoteOrders = await coreSupabaseRepository.readOrdersForPhoneFromTable(key);
      if (Array.isArray(remoteOrders)) {
        const all = normalizeOrdersByPhoneMap(await repository.getAsync(STORAGE_KEYS.ordersByPhone, {}));
        const nextAll = normalizeOrdersByPhoneMap({ ...all, [key]: remoteOrders });
        await repository.setAsync(STORAGE_KEYS.ordersByPhone, nextAll);
        ordersRemoteCache = { value: nextAll, cachedAt: Date.now() };
        return Array.isArray(nextAll[key]) ? nextAll[key] : [];
      }
    } catch (error) {
      console.warn("[orderRepository] read orders by phone failed", error);
    }
    const all = await this.getAllByPhoneAsync();
    return Array.isArray(all[key]) ? all[key] : [];
  },
  async getAllAsync() {
    const all = await this.getAllByPhoneAsync();
    return sortByCreatedAtDesc(Object.values(all).flat());
  },
  async upsertOrderAsync(order) {
    const nextOrder = { id: order.id || order.orderCode || `order_${Date.now()}`, ...order };
    const key = getCustomerKey(nextOrder.phone || nextOrder.customerPhone);
    if (!key) return nextOrder;
    nextOrder.phone = key;
    nextOrder.customerPhoneKey = key;
    nextOrder.rawCustomerPhone = nextOrder.rawCustomerPhone || nextOrder.customerPhone || nextOrder.phone;
    await repository.setAsync(STORAGE_KEYS.lastCreatedOrderId, String(nextOrder.id || nextOrder.orderCode || "").trim());
    await repository.setAsync(STORAGE_KEYS.currentOrder, nextOrder || null);
    const all = await this.getAllByPhoneAsync();
    const current = Array.isArray(all[key]) ? all[key] : [];
    const next = { ...all, [key]: [nextOrder, ...current] };
    const normalizedNext = normalizeOrdersByPhoneMap(next);
    await repository.setAsync(STORAGE_KEYS.ordersByPhone, normalizedNext);
    ordersRemoteCache = { value: normalizedNext, cachedAt: Date.now() };
    notifyOrdersChanged();
    if (shouldWriteDomainToSupabase("orders")) {
      try {
        await coreSupabaseRepository.upsertOrderToTable(nextOrder);
      } catch (error) {
        console.warn("[orderRepository] upsert single order failed", error);
        throw error;
      }
    }
    return nextOrder;
  },
  subscribeRealtimeByPhone(phone, onSynced) {
    const key = getCustomerKey(phone);
    if (!key) return () => {};
    if (!shouldWriteDomainToSupabase("orders")) return () => {};

    const handleChange = async ({ payload }) => {
      const changedPhone = getCustomerKey(
        payload?.new?.customer_phone || payload?.old?.customer_phone || ""
      );
      if (changedPhone && changedPhone !== key) return;
      try {
        const remoteOrders = await coreSupabaseRepository.readOrdersForPhoneFromTable(key);
        const all = this.getAllByPhone();
        const merged = normalizeOrdersByPhoneMap({
          ...all,
          [key]: Array.isArray(remoteOrders) ? remoteOrders : []
        });
        repository.set(STORAGE_KEYS.ordersByPhone, merged);
        ordersRemoteCache = { value: merged, cachedAt: Date.now() };
        if (Array.isArray(remoteOrders) && remoteOrders.length) {
          this.saveCurrentOrder(remoteOrders[0]);
        }
        notifyOrdersChanged();
        if (typeof onSynced === "function") onSynced(remoteOrders || []);
      } catch (error) {
        console.warn("[orderRepository] subscribe realtime sync failed", error);
      }
    };

    return coreSupabaseRepository.subscribeOrdersRealtime(handleChange);
  }
};
