import { getCustomerKey } from "../storageService.js";
import { createRuntimeAppConfigRepository } from "./appConfigRepository.js";
import { coreSupabaseRepository } from "./coreSupabaseRepository.js";
import { normalizeAddressesByPhoneMap, normalizeUsersMap } from "./phoneDataMigration.js";
import { orderRepository } from "./orderRepository.js";
import { getRepositoryRuntimeInfo } from "./repositoryRuntime.js";
import { STORAGE_KEYS } from "./storageKeys.js";
import { shouldWriteDomainToSupabase } from "./writeThroughPolicy.js";

const repository = createRuntimeAppConfigRepository();
const LEGACY_USERS_KEY = "ghr_users_demo";
const LEGACY_USER_KEY = "ghr_user_demo";
let suppressRemoteCustomerWriteUntil = 0;
const REMOTE_USERS_CACHE_TTL_MS = 8000;
let usersRemoteCache = { value: null, cachedAt: 0 };
let usersReadInFlight = null;

function notifyCustomerDataChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ghr:customer-data-changed"));
}

function logSupabaseError(scope, error, payload = null) {
  const meta = {
    code: error?.code || "",
    message: error?.message || String(error || ""),
    details: error?.details || "",
    hint: error?.hint || "",
    status: error?.status || ""
  };
  console.error(`[customerRepository] ${scope} failed`, meta, payload || "");
}

function getTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isPlaceholderName(name = "") {
  const normalized = String(name || "").trim().toLowerCase();
  return !normalized || normalized === "khách" || normalized === "khách vãng lai" || normalized === "khach" || normalized === "khach vang lai";
}

function mergeUsersByPriority(localUsers = {}, remoteUsers = {}) {
  const keys = new Set([...Object.keys(localUsers || {}), ...Object.keys(remoteUsers || {})]);
  const merged = {};
  keys.forEach((key) => {
    const local = localUsers[key] || null;
    const remote = remoteUsers[key] || null;
    if (!local) {
      merged[key] = remote;
      return;
    }
    if (!remote) {
      merged[key] = local;
      return;
    }
    const localTime = Math.max(getTime(local.updatedAt), getTime(local.createdAt));
    const remoteTime = Math.max(getTime(remote.updatedAt), getTime(remote.createdAt));
    const preferRemote = remoteTime > localTime;
    const base = preferRemote ? local : remote;
    const winner = preferRemote ? remote : local;
    const localName = String(local.name || "").trim();
    const remoteName = String(remote.name || "").trim();
    const resolvedName = remoteName && remoteName !== localName
      ? remoteName
      : !isPlaceholderName(local.name) && isPlaceholderName(remote.name)
        ? local.name
        : !isPlaceholderName(remote.name) && isPlaceholderName(local.name)
          ? remote.name
          : String((preferRemote ? remote.name : local.name) || "");
    merged[key] = {
      ...base,
      ...winner,
      phone: key,
      // In Supabase mode, prefer remote non-empty name to avoid stale local display.
      name: resolvedName,
      // Registration state must never be downgraded by stale local cache.
      registered: Boolean(remote?.registered || local?.registered)
    };
  });
  return normalizeUsersMap(merged);
}

function normalizeAddressFromOrder(order = {}) {
  const detail = String(order.deliveryAddress || "").trim();
  if (!detail) return null;
  const now = new Date().toISOString();
  return {
    id: `order-address-${String(order.id || order.orderCode || Date.now())}`,
    label: "Địa chỉ từ đơn cũ",
    receiverName: String(order.customerName || order.orderCustomerName || "").trim(),
    phone: String(order.customerPhone || order.phone || "").trim(),
    address: detail,
    note: "",
    isDefault: true,
    createdAt: now,
    updatedAt: now
  };
}

function mergeAddressesByPhoneMaps(localMap = {}, remoteMap = {}) {
  const keys = new Set([...Object.keys(localMap || {}), ...Object.keys(remoteMap || {})]);
  const merged = {};
  keys.forEach((phone) => {
    const local = Array.isArray(localMap?.[phone]) ? localMap[phone] : [];
    const remote = Array.isArray(remoteMap?.[phone]) ? remoteMap[phone] : [];
    const byId = new Map();
    [...remote, ...local].forEach((item) => {
      const id = String(item?.id || "");
      if (!id) return;
      if (!byId.has(id)) byId.set(id, item);
    });
    const list = Array.from(byId.values());
    const hasDefault = list.some((item) => Boolean(item?.isDefault));
    merged[phone] = hasDefault ? list : list.map((item, index) => ({ ...item, isDefault: index === 0 }));
  });
  return normalizeAddressesByPhoneMap(merged);
}

function getChangedUserKeys(prevUsers = {}, nextUsers = {}) {
  const allKeys = new Set([...Object.keys(prevUsers || {}), ...Object.keys(nextUsers || {})]);
  const changed = [];
  allKeys.forEach((key) => {
    const prev = prevUsers?.[key] || null;
    const next = nextUsers?.[key] || null;
    if (JSON.stringify(prev) !== JSON.stringify(next)) changed.push(key);
  });
  return changed;
}

export const customerRepository = {
  suppressRemoteWrite(ms = 0) {
    const ttl = Math.max(0, Number(ms) || 0);
    suppressRemoteCustomerWriteUntil = Date.now() + ttl;
  },
  getUsers() {
    const raw = repository.get(STORAGE_KEYS.users, {});
    const normalized = normalizeUsersMap(raw);
    if (JSON.stringify(raw || {}) !== JSON.stringify(normalized || {})) {
      repository.set(STORAGE_KEYS.users, normalized);
    }
    return normalized;
  },
  saveUsers(users) {
    const previous = normalizeUsersMap(repository.get(STORAGE_KEYS.users, {}));
    const normalized = normalizeUsersMap(users || {});
    if (JSON.stringify(previous) === JSON.stringify(normalized)) {
      return previous;
    }
    const saved = repository.set(STORAGE_KEYS.users, normalized);
    usersRemoteCache = { value: normalized, cachedAt: Date.now() };
    notifyCustomerDataChanged();
    const shouldWriteRemote = shouldWriteDomainToSupabase("customers");
    if (import.meta?.env?.DEV) {
      console.info("[customerRepository] saveUsers", {
        totalUsers: Object.keys(normalized || {}).length,
        shouldWriteRemote,
        runtime: getRepositoryRuntimeInfo()
      });
    }
    const canWriteRemote = Date.now() >= suppressRemoteCustomerWriteUntil;
    if (shouldWriteRemote && canWriteRemote) {
      const changedKeys = getChangedUserKeys(previous, normalized);
      changedKeys.forEach((phone) => {
        coreSupabaseRepository.writeCustomerRowToTable(normalized[phone] || {}).catch((error) => {
          logSupabaseError("write single customer row", error, { phone });
        });
      });
    }
    return saved;
  },
  async upsertCustomerByPhone(phone, profile = {}, options = {}) {
    const key = getCustomerKey(phone || profile?.phone);
    if (!key) return null;
    const now = new Date().toISOString();
    const users = normalizeUsersMap(repository.get(STORAGE_KEYS.users, {}));
    const existing = users[key] || {};
    const nextUser = normalizeUsersMap({
      ...users,
      [key]: {
        ...existing,
        ...profile,
        phone: key,
        createdAt: existing?.createdAt || profile?.createdAt || now,
        updatedAt: now
      }
    })[key];

    repository.set(STORAGE_KEYS.users, normalizeUsersMap({ ...users, [key]: nextUser }));
    usersRemoteCache = {
      value: normalizeUsersMap({ ...users, [key]: nextUser }),
      cachedAt: Date.now()
    };
    notifyCustomerDataChanged();

    const shouldWriteRemote = options?.writeRemote !== false && shouldWriteDomainToSupabase("customers");
    if (shouldWriteRemote) {
      await coreSupabaseRepository.writeCustomerRowToTable(nextUser);
    }
    return nextUser;
  },
  getUserByPhone(phone) {
    const key = getCustomerKey(phone);
    if (!key) return null;
    const users = this.getUsers();
    return users[key] || null;
  },
  saveCurrentPhone(phone) {
    return repository.set(STORAGE_KEYS.currentPhone, getCustomerKey(phone));
  },
  getCurrentPhone() {
    return repository.get(STORAGE_KEYS.currentPhone, "");
  },
  clearCurrentPhone() {
    return repository.set(STORAGE_KEYS.currentPhone, "");
  },
  saveSessionPointer({ phone = "", customerId = "", authUserId = "" } = {}) {
    const normalizedPhone = getCustomerKey(phone);
    repository.set(STORAGE_KEYS.currentCustomerPhone, normalizedPhone || "");
    repository.set(STORAGE_KEYS.currentCustomerId, String(customerId || ""));
    repository.set(STORAGE_KEYS.currentAuthUserId, String(authUserId || ""));
    if (normalizedPhone) {
      repository.set(STORAGE_KEYS.currentPhone, normalizedPhone);
    }
    return {
      phone: normalizedPhone || "",
      customerId: String(customerId || ""),
      authUserId: String(authUserId || "")
    };
  },
  getSessionPointer() {
    return {
      phone: getCustomerKey(repository.get(STORAGE_KEYS.currentCustomerPhone, "") || repository.get(STORAGE_KEYS.currentPhone, "")) || "",
      customerId: String(repository.get(STORAGE_KEYS.currentCustomerId, "") || ""),
      authUserId: String(repository.get(STORAGE_KEYS.currentAuthUserId, "") || "")
    };
  },
  clearSessionPointer() {
    repository.set(STORAGE_KEYS.currentCustomerPhone, "");
    repository.set(STORAGE_KEYS.currentCustomerId, "");
    repository.set(STORAGE_KEYS.currentAuthUserId, "");
    repository.set(STORAGE_KEYS.currentPhone, "");
  },
  getCustomersMeta() {
    return repository.get(STORAGE_KEYS.crmCustomers, {});
  },
  saveCustomersMeta(meta) {
    return repository.set(STORAGE_KEYS.crmCustomers, meta || {});
  },
  getAddressesByPhone(phone) {
    const key = getCustomerKey(phone);
    if (!key) return [];
    const raw = repository.get(STORAGE_KEYS.addressesByPhone, {});
    const all = normalizeAddressesByPhoneMap(raw);
    if (JSON.stringify(raw || {}) !== JSON.stringify(all || {})) {
      repository.set(STORAGE_KEYS.addressesByPhone, all);
    }
    const existing = Array.isArray(all[key]) ? all[key] : [];
    if (existing.length) {
      coreSupabaseRepository
        .readAddressesByPhoneFromTable(key)
        .then((remoteMap) => {
          if (!remoteMap || typeof remoteMap !== "object") return;
          const normalizedRemote = normalizeAddressesByPhoneMap(remoteMap);
          const remoteList = Array.isArray(normalizedRemote[key]) ? normalizedRemote[key] : [];
          const mergedList = mergeAddressesByPhoneMaps({ [key]: existing }, { [key]: remoteList })[key] || [];
          if (JSON.stringify(mergedList) !== JSON.stringify(existing)) {
            const nextAll = normalizeAddressesByPhoneMap({ ...all, [key]: mergedList });
            repository.set(STORAGE_KEYS.addressesByPhone, nextAll);
            notifyCustomerDataChanged();
          }
        })
        .catch((error) => {
          logSupabaseError("read customer addresses table", error);
        });
      return existing;
    }

    const orderFallback = orderRepository
      .getByPhone(key)
      .map(normalizeAddressFromOrder)
      .filter(Boolean);
    if (!orderFallback.length) return [];

    const uniqueByAddress = Object.values(
      orderFallback.reduce((acc, item) => {
        const addressKey = String(item.address || "").toLowerCase();
        if (!addressKey || acc[addressKey]) return acc;
        acc[addressKey] = item;
        return acc;
      }, {})
    );
    const hydrated = uniqueByAddress.map((item, index) => ({ ...item, isDefault: index === 0 }));
    repository.set(STORAGE_KEYS.addressesByPhone, normalizeAddressesByPhoneMap({ ...all, [key]: hydrated }));
    notifyCustomerDataChanged();
    return hydrated;
  },
  saveAddressesByPhone(phone, addresses = []) {
    const key = getCustomerKey(phone);
    if (!key) return Array.isArray(addresses) ? addresses : [];
    const all = normalizeAddressesByPhoneMap(repository.get(STORAGE_KEYS.addressesByPhone, {}));
    const normalized = Array.isArray(addresses) ? addresses : [];
    const nextAll = normalizeAddressesByPhoneMap({ ...all, [key]: normalized });
    repository.set(STORAGE_KEYS.addressesByPhone, nextAll);
    if (shouldWriteDomainToSupabase("customerAddresses")) {
      coreSupabaseRepository.writeAddressesForPhoneToTable(key, normalized).catch((error) => {
        logSupabaseError("write customer addresses table", error, { phone: key });
      });
    }
    notifyCustomerDataChanged();
    return normalized;
  },
  async getAddressesByPhoneAsync(phone) {
    const key = getCustomerKey(phone);
    if (!key) return [];
    const localAll = normalizeAddressesByPhoneMap(await repository.getAsync(STORAGE_KEYS.addressesByPhone, {}));
    try {
      const remote = await coreSupabaseRepository.readAddressesByPhoneFromTable(key);
      if (remote && typeof remote === "object") {
        const remoteMap = normalizeAddressesByPhoneMap(remote);
        const merged = mergeAddressesByPhoneMaps(localAll, { [key]: remoteMap[key] || [] });
        await repository.setAsync(STORAGE_KEYS.addressesByPhone, merged);
        return Array.isArray(merged[key]) ? merged[key] : [];
      }
    } catch (error) {
      logSupabaseError("read customer addresses table (async)", error);
    }
    const existing = Array.isArray(localAll[key]) ? localAll[key] : [];
    if (existing.length) return existing;
    const orderFallback = (await orderRepository.getByPhoneAsync(key)).map(normalizeAddressFromOrder).filter(Boolean);
    return orderFallback;
  },
  async saveAddressesByPhoneAsync(phone, addresses = []) {
    const key = getCustomerKey(phone);
    if (!key) return Array.isArray(addresses) ? addresses : [];
    const all = normalizeAddressesByPhoneMap(await repository.getAsync(STORAGE_KEYS.addressesByPhone, {}));
    const normalized = Array.isArray(addresses) ? addresses : [];
    const nextAll = normalizeAddressesByPhoneMap({ ...all, [key]: normalized });
    await repository.setAsync(STORAGE_KEYS.addressesByPhone, nextAll);
    if (shouldWriteDomainToSupabase("customerAddresses")) {
      try {
        await coreSupabaseRepository.writeAddressesForPhoneToTable(key, normalized);
      } catch (error) {
        logSupabaseError("write customer addresses table (async)", error, { phone: key });
      }
    }
    notifyCustomerDataChanged();
    return normalized;
  },
  getUserProfile(fallback) {
    return repository.get(STORAGE_KEYS.legacyUserProfile, fallback);
  },
  saveUserProfile(profile) {
    return profile;
  },
  getLegacyUsers(fallback = []) {
    return repository.get(LEGACY_USERS_KEY, fallback);
  },
  getLegacyUser(fallback = null) {
    return repository.get(LEGACY_USER_KEY, fallback);
  },
  async getUsersAsync() {
    const now = Date.now();
    if (usersRemoteCache.value && now - usersRemoteCache.cachedAt < REMOTE_USERS_CACHE_TTL_MS) {
      return usersRemoteCache.value;
    }
    if (usersReadInFlight) return usersReadInFlight;
    usersReadInFlight = (async () => {
    const fallback = await repository.getAsync(STORAGE_KEYS.users, {});
    try {
      const remote = await coreSupabaseRepository.readCustomersMapFromTable();
      if (remote && typeof remote === "object" && Object.keys(remote).length) {
        const normalizedRemote = normalizeUsersMap(remote);
        usersRemoteCache = { value: normalizedRemote, cachedAt: Date.now() };
        return normalizedRemote;
      }
    } catch (error) {
      logSupabaseError("read customers table", error);
    }
      const normalizedFallback = normalizeUsersMap(fallback);
      usersRemoteCache = { value: normalizedFallback, cachedAt: Date.now() };
      return normalizedFallback;
    })();
    try {
      return await usersReadInFlight;
    } finally {
      usersReadInFlight = null;
    }
  },
  async hydrateUsersFromRemote() {
    const localUsers = normalizeUsersMap(repository.get(STORAGE_KEYS.users, {}));
    try {
      const remote = await coreSupabaseRepository.readCustomersMapFromTable();
      if (!remote || typeof remote !== "object" || !Object.keys(remote).length) {
        return localUsers;
      }
      const merged = mergeUsersByPriority(localUsers, normalizeUsersMap(remote));
      if (JSON.stringify(localUsers) !== JSON.stringify(merged)) {
        repository.set(STORAGE_KEYS.users, merged);
        notifyCustomerDataChanged();
      }
      return merged;
    } catch (error) {
      logSupabaseError("hydrate customers from remote", error);
      return localUsers;
    }
  },
  async saveUsersAsync(users) {
    const previous = normalizeUsersMap(await repository.getAsync(STORAGE_KEYS.users, {}));
    const normalized = normalizeUsersMap(users || {});
    const saved = await repository.setAsync(STORAGE_KEYS.users, normalized);
    usersRemoteCache = { value: normalized, cachedAt: Date.now() };
    notifyCustomerDataChanged();
    if (shouldWriteDomainToSupabase("customers")) {
      const changedKeys = getChangedUserKeys(previous, normalized);
      for (const phone of changedKeys) {
        try {
          await coreSupabaseRepository.writeCustomerRowToTable(normalized[phone] || {});
        } catch (error) {
          logSupabaseError("write single customer row (async)", error, { phone });
        }
      }
    }
    return saved;
  },
  async getUserByPhoneAsync(phone) {
    const key = getCustomerKey(phone);
    if (!key) return null;
    const users = await this.getUsersAsync();
    return users[key] || null;
  },
  async saveCurrentPhoneAsync(phone) {
    return repository.setAsync(STORAGE_KEYS.currentPhone, getCustomerKey(phone));
  },
  async getCurrentPhoneAsync() {
    return repository.getAsync(STORAGE_KEYS.currentPhone, "");
  },
  async clearCurrentPhoneAsync() {
    return repository.setAsync(STORAGE_KEYS.currentPhone, "");
  },
  async getCustomersMetaAsync() {
    return repository.getAsync(STORAGE_KEYS.crmCustomers, {});
  },
  async saveCustomersMetaAsync(meta) {
    return repository.setAsync(STORAGE_KEYS.crmCustomers, meta || {});
  },
  subscribeAddressesRealtime(onChange) {
    return coreSupabaseRepository.subscribeCustomerAddressesRealtime(async () => {
      try {
        const localAll = normalizeAddressesByPhoneMap(repository.get(STORAGE_KEYS.addressesByPhone, {}));
        const remote = await coreSupabaseRepository.readAddressesByPhoneFromTable();
        if (!remote || typeof remote !== "object") return;
        const merged = mergeAddressesByPhoneMaps(localAll, normalizeAddressesByPhoneMap(remote));
        if (JSON.stringify(merged) !== JSON.stringify(localAll)) {
          repository.set(STORAGE_KEYS.addressesByPhone, merged);
          notifyCustomerDataChanged();
        }
        if (typeof onChange === "function") onChange(merged);
      } catch (error) {
        logSupabaseError("realtime customer addresses sync", error);
      }
    });
  },
  subscribeUsersRealtime(onChange) {
    return coreSupabaseRepository.subscribeCustomersRealtime(async () => {
      try {
        const localUsers = normalizeUsersMap(repository.get(STORAGE_KEYS.users, {}));
        const remoteUsers = await coreSupabaseRepository.readCustomersMapFromTable();
        if (!remoteUsers || typeof remoteUsers !== "object") return;
        const merged = mergeUsersByPriority(localUsers, normalizeUsersMap(remoteUsers));
        if (JSON.stringify(merged) !== JSON.stringify(localUsers)) {
          repository.set(STORAGE_KEYS.users, merged);
          notifyCustomerDataChanged();
        }
        if (typeof onChange === "function") onChange(merged);
      } catch (error) {
        logSupabaseError("realtime customers sync", error);
      }
    });
  }
};
