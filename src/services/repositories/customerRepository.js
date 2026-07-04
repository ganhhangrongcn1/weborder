import { getCustomerKey } from "../storageService.js";
import { createRuntimeAppConfigRepository } from "./appConfigRepository.js";
import { coreSupabaseRepository } from "./coreSupabaseRepository.js";
import { normalizeAddressesByPhoneMap, normalizeUsersMap } from "./phoneDataMigration.js";
import { orderRepository } from "./orderRepository.js";
import { getRepositoryRuntimeInfo } from "./repositoryRuntime.js";
import { STORAGE_KEYS } from "./storageKeys.js";
import { shouldAllowLocalFallbackForDomain, shouldWriteDomainToSupabase } from "./writeThroughPolicy.js";

const repository = createRuntimeAppConfigRepository();
const LEGACY_USERS_KEY = "ghr_users_demo";
const LEGACY_USER_KEY = "ghr_user_demo";
const CUSTOMER_PROFILE_DOMAIN = "customers";
let suppressRemoteCustomerWriteUntil = 0;
const REMOTE_USERS_CACHE_TTL_MS = 8000;
let usersRemoteCache = { value: null, cachedAt: 0 };
let usersReadInFlight = null;
let registeredUsersRemoteCache = { value: null, cachedAt: 0 };
let registeredUsersReadInFlight = null;

function invalidateRegisteredUsersCache() {
  registeredUsersRemoteCache = { value: null, cachedAt: 0 };
  registeredUsersReadInFlight = null;
}

function getBrowserLocalStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  } catch {
  }
  return null;
}

function readLocalSessionValue(key, fallback = "") {
  const storage = getBrowserLocalStorage();
  if (!storage) return fallback;
  try {
    const value = storage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeLocalSessionValue(key, value = "") {
  const storage = getBrowserLocalStorage();
  const safeValue = String(value || "");
  if (storage) {
    try {
      if (safeValue) {
        storage.setItem(key, safeValue);
      } else {
        storage.removeItem(key);
      }
    } catch {
    }
  }
  return safeValue;
}

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
    const allowLocalFallback = shouldAllowLocalFallbackForDomain(CUSTOMER_PROFILE_DOMAIN);
    if (!allowLocalFallback) {
      return normalizeUsersMap(usersRemoteCache.value || {});
    }
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
    invalidateRegisteredUsersCache();
    notifyCustomerDataChanged();
    const shouldWriteRemote = shouldWriteDomainToSupabase(CUSTOMER_PROFILE_DOMAIN);
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
        coreSupabaseRepository.writeProfileRowToTable(normalized[phone] || {}).catch((error) => {
          logSupabaseError("write single profile row", error, { phone });
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
    invalidateRegisteredUsersCache();
    notifyCustomerDataChanged();

    const shouldWriteRemote = options?.writeRemote !== false && shouldWriteDomainToSupabase(CUSTOMER_PROFILE_DOMAIN);
    if (shouldWriteRemote) {
      await coreSupabaseRepository.writeProfileRowToTable(nextUser);
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
    const normalizedPhone = getCustomerKey(phone);
    writeLocalSessionValue(STORAGE_KEYS.currentPhone, normalizedPhone);
    return repository.set(STORAGE_KEYS.currentPhone, normalizedPhone);
  },
  getCurrentPhone() {
    const localPhone = getCustomerKey(readLocalSessionValue(STORAGE_KEYS.currentPhone, ""));
    return localPhone || repository.get(STORAGE_KEYS.currentPhone, "");
  },
  clearCurrentPhone() {
    writeLocalSessionValue(STORAGE_KEYS.currentPhone, "");
    return repository.set(STORAGE_KEYS.currentPhone, "");
  },
  saveSessionPointer({ phone = "", customerId = "", authUserId = "" } = {}) {
    const normalizedPhone = getCustomerKey(phone);
    writeLocalSessionValue(STORAGE_KEYS.currentCustomerPhone, normalizedPhone || "");
    writeLocalSessionValue(STORAGE_KEYS.currentCustomerId, customerId || "");
    writeLocalSessionValue(STORAGE_KEYS.currentAuthUserId, authUserId || "");
    writeLocalSessionValue(STORAGE_KEYS.currentPhone, normalizedPhone || "");
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
    const localPhone = readLocalSessionValue(STORAGE_KEYS.currentCustomerPhone, "") || readLocalSessionValue(STORAGE_KEYS.currentPhone, "");
    const localCustomerId = readLocalSessionValue(STORAGE_KEYS.currentCustomerId, "");
    const localAuthUserId = readLocalSessionValue(STORAGE_KEYS.currentAuthUserId, "");
    return {
      phone: getCustomerKey(localPhone || repository.get(STORAGE_KEYS.currentCustomerPhone, "") || repository.get(STORAGE_KEYS.currentPhone, "")) || "",
      customerId: String(localCustomerId || repository.get(STORAGE_KEYS.currentCustomerId, "") || ""),
      authUserId: String(localAuthUserId || repository.get(STORAGE_KEYS.currentAuthUserId, "") || "")
    };
  },
  clearSessionPointer() {
    writeLocalSessionValue(STORAGE_KEYS.currentCustomerPhone, "");
    writeLocalSessionValue(STORAGE_KEYS.currentCustomerId, "");
    writeLocalSessionValue(STORAGE_KEYS.currentAuthUserId, "");
    writeLocalSessionValue(STORAGE_KEYS.currentPhone, "");
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
    const allowLocalFallback = shouldAllowLocalFallbackForDomain("customerAddresses");
    if (!allowLocalFallback) {
      return [];
    }
    const raw = repository.get(STORAGE_KEYS.addressesByPhone, {});
    const all = normalizeAddressesByPhoneMap(raw);
    if (JSON.stringify(raw || {}) !== JSON.stringify(all || {})) {
      repository.set(STORAGE_KEYS.addressesByPhone, all);
    }
    const existing = allowLocalFallback && Array.isArray(all[key]) ? all[key] : [];
    if (existing.length) {
      coreSupabaseRepository
        .readAddressesByPhoneFromTable(key)
        .then((remoteMap) => {
          if (!remoteMap || typeof remoteMap !== "object") return;
          const normalizedRemote = normalizeAddressesByPhoneMap(remoteMap);
          const remoteList = Array.isArray(normalizedRemote[key]) ? normalizedRemote[key] : [];
          if (JSON.stringify(remoteList) !== JSON.stringify(existing)) {
            const nextAll = normalizeAddressesByPhoneMap({ ...all, [key]: remoteList });
            repository.set(STORAGE_KEYS.addressesByPhone, nextAll);
            notifyCustomerDataChanged();
          }
        })
        .catch((error) => {
          logSupabaseError("read customer addresses table", error);
        });
      return existing;
    }

    if (!allowLocalFallback) return [];

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
    const allowLocalFallback = shouldAllowLocalFallbackForDomain("customerAddresses");
    const localAll = allowLocalFallback
      ? normalizeAddressesByPhoneMap(await repository.getAsync(STORAGE_KEYS.addressesByPhone, {}))
      : {};
    try {
      const remote = await coreSupabaseRepository.readAddressesByPhoneFromTable(key);
      if (remote && typeof remote === "object") {
        const remoteMap = normalizeAddressesByPhoneMap(remote);
        const remoteList = Array.isArray(remoteMap[key]) ? remoteMap[key] : [];
        const nextAll = normalizeAddressesByPhoneMap({ ...localAll, [key]: remoteList });
        await repository.setAsync(STORAGE_KEYS.addressesByPhone, nextAll);
        return Array.isArray(nextAll[key]) ? nextAll[key] : [];
      }
    } catch (error) {
      logSupabaseError("read customer addresses table (async)", error);
    }
    const existing = allowLocalFallback && Array.isArray(localAll[key]) ? localAll[key] : [];
    if (existing.length) return existing;
    if (!allowLocalFallback) return [];
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
    const allowLocalFallback = shouldAllowLocalFallbackForDomain(CUSTOMER_PROFILE_DOMAIN);
    const fallback = allowLocalFallback ? await repository.getAsync(STORAGE_KEYS.users, {}) : {};
    try {
      const remote = await coreSupabaseRepository.readProfilesMapFromTable();
      if (remote && typeof remote === "object" && Object.keys(remote).length) {
        const normalizedRemote = normalizeUsersMap(remote);
        await repository.setAsync(STORAGE_KEYS.users, normalizedRemote);
        usersRemoteCache = { value: normalizedRemote, cachedAt: Date.now() };
        return normalizedRemote;
      }
    } catch (error) {
      logSupabaseError("read profiles table", error);
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
  async getRegisteredUsersAsync() {
    const now = Date.now();
    if (
      registeredUsersRemoteCache.value &&
      now - registeredUsersRemoteCache.cachedAt < REMOTE_USERS_CACHE_TTL_MS
    ) {
      return registeredUsersRemoteCache.value;
    }
    if (registeredUsersReadInFlight) return registeredUsersReadInFlight;

    registeredUsersReadInFlight = (async () => {
      const allowLocalFallback = shouldAllowLocalFallbackForDomain(CUSTOMER_PROFILE_DOMAIN);
      const localUsers = allowLocalFallback
        ? normalizeUsersMap(await repository.getAsync(STORAGE_KEYS.users, {}))
        : {};
      const fallback = Object.fromEntries(
        Object.entries(localUsers).filter(([, user]) => (
          Boolean(user?.registered) && String(user?.status || "active") === "active"
        ))
      );

      try {
        const remote = await coreSupabaseRepository.readRegisteredProfilesMapFromTable();
        if (remote && typeof remote === "object") {
          const normalizedRemote = normalizeUsersMap(remote);
          registeredUsersRemoteCache = {
            value: normalizedRemote,
            cachedAt: Date.now()
          };
          return normalizedRemote;
        }
      } catch (error) {
        logSupabaseError("read registered profiles table", error);
      }

      registeredUsersRemoteCache = {
        value: fallback,
        cachedAt: Date.now()
      };
      return fallback;
    })();

    try {
      return await registeredUsersReadInFlight;
    } finally {
      registeredUsersReadInFlight = null;
    }
  },
  async hydrateUsersFromRemote() {
    const allowLocalFallback = shouldAllowLocalFallbackForDomain(CUSTOMER_PROFILE_DOMAIN);
    const localUsers = allowLocalFallback ? normalizeUsersMap(repository.get(STORAGE_KEYS.users, {})) : {};
    try {
      const remote = await coreSupabaseRepository.readProfilesMapFromTable();
      if (!remote || typeof remote !== "object" || !Object.keys(remote).length) {
        return localUsers;
      }
      const remoteOnly = normalizeUsersMap(remote);
      if (JSON.stringify(localUsers) !== JSON.stringify(remoteOnly)) {
        repository.set(STORAGE_KEYS.users, remoteOnly);
        invalidateRegisteredUsersCache();
        notifyCustomerDataChanged();
      }
      return remoteOnly;
    } catch (error) {
      logSupabaseError("hydrate profiles from remote", error);
      return localUsers;
    }
  },
  async saveUsersAsync(users) {
    const previous = normalizeUsersMap(await repository.getAsync(STORAGE_KEYS.users, {}));
    const normalized = normalizeUsersMap(users || {});
    const saved = await repository.setAsync(STORAGE_KEYS.users, normalized);
    usersRemoteCache = { value: normalized, cachedAt: Date.now() };
    invalidateRegisteredUsersCache();
    notifyCustomerDataChanged();
    if (shouldWriteDomainToSupabase(CUSTOMER_PROFILE_DOMAIN)) {
      const changedKeys = getChangedUserKeys(previous, normalized);
      for (const phone of changedKeys) {
        try {
          await coreSupabaseRepository.writeProfileRowToTable(normalized[phone] || {});
        } catch (error) {
          logSupabaseError("write single profile row (async)", error, { phone });
        }
      }
    }
    return saved;
  },
  async getUserByPhoneAsync(phone) {
    const key = getCustomerKey(phone);
    if (!key) return null;
    try {
      const remoteUser = await coreSupabaseRepository.readProfileForPhoneFromTable(key);
      if (remoteUser) {
        const allowLocalFallback = shouldAllowLocalFallbackForDomain(CUSTOMER_PROFILE_DOMAIN);
        const localUsers = allowLocalFallback
          ? normalizeUsersMap(await repository.getAsync(STORAGE_KEYS.users, {}))
          : {};
        const nextUsers = normalizeUsersMap({
          ...localUsers,
          [key]: remoteUser
        });
        if (allowLocalFallback) {
          await repository.setAsync(STORAGE_KEYS.users, nextUsers);
        }
        if (allowLocalFallback || usersRemoteCache.value) {
          usersRemoteCache = {
            value: normalizeUsersMap({
              ...(usersRemoteCache.value || {}),
              ...nextUsers
            }),
            cachedAt: Date.now()
          };
        }
        return remoteUser;
      }
      if (!shouldAllowLocalFallbackForDomain(CUSTOMER_PROFILE_DOMAIN)) return null;
    } catch (error) {
      logSupabaseError("read profile by phone", error, { phone: key });
    }

    const users = await this.getUsersAsync();
    return users[key] || null;
  },
  async saveCurrentPhoneAsync(phone) {
    const normalizedPhone = getCustomerKey(phone);
    writeLocalSessionValue(STORAGE_KEYS.currentPhone, normalizedPhone);
    return repository.setAsync(STORAGE_KEYS.currentPhone, normalizedPhone);
  },
  async getCurrentPhoneAsync() {
    const localPhone = getCustomerKey(readLocalSessionValue(STORAGE_KEYS.currentPhone, ""));
    return localPhone || repository.getAsync(STORAGE_KEYS.currentPhone, "");
  },
  async clearCurrentPhoneAsync() {
    writeLocalSessionValue(STORAGE_KEYS.currentPhone, "");
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
        const allowLocalFallback = shouldAllowLocalFallbackForDomain("customerAddresses");
        const localAll = allowLocalFallback ? normalizeAddressesByPhoneMap(repository.get(STORAGE_KEYS.addressesByPhone, {})) : {};
        const remote = await coreSupabaseRepository.readAddressesByPhoneFromTable();
        if (!remote || typeof remote !== "object") return;
        const remoteOnly = normalizeAddressesByPhoneMap(remote);
        if (JSON.stringify(remoteOnly) !== JSON.stringify(localAll)) {
          repository.set(STORAGE_KEYS.addressesByPhone, remoteOnly);
          notifyCustomerDataChanged();
        }
        if (typeof onChange === "function") onChange(remoteOnly);
      } catch (error) {
        logSupabaseError("realtime customer addresses sync", error);
      }
    });
  },
  subscribeUsersRealtime(onChange) {
    return coreSupabaseRepository.subscribeProfilesRealtime(async () => {
      try {
        const allowLocalFallback = shouldAllowLocalFallbackForDomain(CUSTOMER_PROFILE_DOMAIN);
        const localUsers = allowLocalFallback ? normalizeUsersMap(repository.get(STORAGE_KEYS.users, {})) : {};
        const remoteUsers = await coreSupabaseRepository.readProfilesMapFromTable();
        if (!remoteUsers || typeof remoteUsers !== "object") return;
        const remoteOnly = normalizeUsersMap(remoteUsers);
        if (JSON.stringify(remoteOnly) !== JSON.stringify(localUsers)) {
          repository.set(STORAGE_KEYS.users, remoteOnly);
          notifyCustomerDataChanged();
        }
        if (typeof onChange === "function") onChange(remoteOnly);
      } catch (error) {
        logSupabaseError("realtime profiles sync", error);
      }
    });
  }
};

