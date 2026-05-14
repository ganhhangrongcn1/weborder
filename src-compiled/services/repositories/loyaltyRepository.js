import { getCustomerKey } from "../storageService.js";
import { createRuntimeAppConfigRepository } from "./appConfigRepository.js";
import { coreSupabaseRepository } from "./coreSupabaseRepository.js";
import { normalizeLoyaltyByPhoneMap } from "./phoneDataMigration.js";
import { getRepositoryRuntimeInfo } from "./repositoryRuntime.js";
import { STORAGE_KEYS } from "./storageKeys.js";
import { shouldAllowLocalFallbackForDomain, shouldWriteDomainToSupabase } from "./writeThroughPolicy.js";

const repository = createRuntimeAppConfigRepository();
const REMOTE_CACHE_TTL_MS = 8000;
let loyaltyRemoteCache = { value: null, cachedAt: 0 };
let loyaltyReadInFlight = null;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeLoyaltyRecord(current = {}, incoming = {}, phone = "") {
  const mergedPointHistory = dedupePointHistoryByOrder(
    mergeById(safeArray(current.pointHistory), safeArray(incoming.pointHistory))
  );
  const mergedVoucherHistory = mergeById(safeArray(current.voucherHistory), safeArray(incoming.voucherHistory));
  const mergedCheckinHistory = Array.from(new Set([...safeArray(current.checkinHistory), ...safeArray(incoming.checkinHistory)]));
  const mergedRewardHistory = Array.from(new Set([...safeArray(current.rewardHistory), ...safeArray(incoming.rewardHistory)]));
  const pointsFromHistory = mergedPointHistory.reduce((sum, entry) => sum + Number(entry?.points || 0), 0);
  const hasHistory = mergedPointHistory.length > 0;
  const mergedTotalPoints = hasHistory
    ? Math.max(0, pointsFromHistory)
    : Math.max(0, Number(incoming.totalPoints ?? current.totalPoints ?? 0));

  return {
    ...current,
    ...incoming,
    phone: phone || String(incoming.phone || current.phone || ""),
    pointHistory: mergedPointHistory,
    voucherHistory: mergedVoucherHistory,
    checkinHistory: mergedCheckinHistory,
    rewardHistory: mergedRewardHistory,
    totalPoints: mergedTotalPoints
  };
}

function notifyLoyaltyChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ghr:customer-data-changed"));
}

function mergeById(current = [], incoming = []) {
  const map = new Map();
  [...current, ...incoming].forEach((item) => {
    const key = String(item?.id || item?.orderId || item?.code || `${item?.type || ""}-${item?.createdAt || ""}-${item?.title || ""}`);
    if (!key) return;
    const prev = map.get(key) || {};
    map.set(key, { ...prev, ...(item || {}) });
  });
  return Array.from(map.values());
}

function logSupabaseError(scope, error, payload = null) {
  const meta = {
    code: error?.code || "",
    message: error?.message || String(error || ""),
    details: error?.details || "",
    hint: error?.hint || "",
    status: error?.status || ""
  };
  console.error(`[loyaltyRepository] ${scope} failed`, meta, payload || "");
}

function normalizeOrderEarnEntry(entry = {}) {
  const orderId = String(entry?.orderId || "").trim();
  const normalizedId = String(entry?.id || "").trim() || (orderId ? `point-${orderId}` : "");
  return {
    ...entry,
    id: normalizedId || `point-${Date.now()}-${Math.random()}`,
    orderId
  };
}

function dedupePointHistoryByOrder(pointHistory = []) {
  const orderEarnByOrderId = new Map();
  const nonOrderEntries = [];
  (Array.isArray(pointHistory) ? pointHistory : []).forEach((rawEntry) => {
    const entry = normalizeOrderEarnEntry(rawEntry || {});
    const type = String(entry?.type || "").toUpperCase();
    if (type !== "ORDER_EARN") {
      nonOrderEntries.push(entry);
      return;
    }
    if (!entry.orderId) {
      nonOrderEntries.push(entry);
      return;
    }
    const existing = orderEarnByOrderId.get(entry.orderId);
    const existingTime = new Date(existing?.createdAt || 0).getTime();
    const nextTime = new Date(entry?.createdAt || 0).getTime();
    if (!existing || nextTime >= existingTime) {
      orderEarnByOrderId.set(entry.orderId, entry);
    }
  });
  return [...Array.from(orderEarnByOrderId.values()), ...nonOrderEntries].sort(
    (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
  );
}

function isSameLoyaltyPayload(current = {}, next = {}) {
  return JSON.stringify(current || {}) === JSON.stringify(next || {});
}

export const loyaltyRepository = {
  getDemo(fallback) {
    return repository.get(STORAGE_KEYS.loyaltyDemo, fallback);
  },
  saveDemo(data) {
    return repository.set(STORAGE_KEYS.loyaltyDemo, data);
  },
  clearDemo(fallback) {
    repository.set(STORAGE_KEYS.loyaltyDemo, fallback);
    return fallback;
  },
  getAllByPhone() {
    const allowLocalFallback = shouldAllowLocalFallbackForDomain("loyalty");
    if (!allowLocalFallback) {
      return normalizeLoyaltyByPhoneMap(loyaltyRemoteCache.value || {});
    }
    const raw = repository.get(STORAGE_KEYS.loyaltyByPhone, {});
    const normalized = normalizeLoyaltyByPhoneMap(raw);
    if (JSON.stringify(raw || {}) !== JSON.stringify(normalized || {})) {
      repository.set(STORAGE_KEYS.loyaltyByPhone, normalized);
    }
    return normalized;
  },
  getByPhone(phone, fallback) {
    const key = getCustomerKey(phone);
    if (!key) return fallback;
    const all = this.getAllByPhone();
    return all[key] || { ...fallback, phone: key };
  },
  saveByPhone(phone, loyalty, fallback) {
    const key = getCustomerKey(phone);
    if (!key) return { ...fallback };
    const all = this.getAllByPhone();
    const currentRecord = all[key] || { ...fallback, phone: key };
    const next = {
      ...fallback,
      ...loyalty,
      phone: key,
      pointHistory: dedupePointHistoryByOrder(loyalty?.pointHistory || fallback?.pointHistory || [])
    };
    if (isSameLoyaltyPayload(currentRecord, next)) {
      return currentRecord;
    }
    const nextAll = normalizeLoyaltyByPhoneMap({ ...all, [key]: next });
    repository.set(STORAGE_KEYS.loyaltyByPhone, nextAll);
    notifyLoyaltyChanged();
    const shouldWriteRemote = shouldWriteDomainToSupabase("loyalty");
    if (import.meta?.env?.DEV) {
      console.info("[loyaltyRepository] saveByPhone", {
        phone: key,
        vouchers: Array.isArray(next?.voucherHistory) ? next.voucherHistory.length : 0,
        pointHistory: Array.isArray(next?.pointHistory) ? next.pointHistory.length : 0,
        shouldWriteRemote,
        runtime: getRepositoryRuntimeInfo()
      });
    }
    if (shouldWriteRemote) {
      coreSupabaseRepository
        .readLoyaltyByPhoneFromTable()
        .then((remoteMap) => {
          const remoteCurrent = remoteMap?.[key] || {};
          const mergedForWrite = mergeLoyaltyRecord(remoteCurrent, next, key);
          if (isSameLoyaltyPayload(remoteCurrent, mergedForWrite)) {
            return null;
          }
          const currentAll = normalizeLoyaltyByPhoneMap(repository.get(STORAGE_KEYS.loyaltyByPhone, {}));
          const mergedAll = normalizeLoyaltyByPhoneMap({
            ...currentAll,
            [key]: mergedForWrite
          });
          repository.set(STORAGE_KEYS.loyaltyByPhone, mergedAll);
          loyaltyRemoteCache = { value: mergedAll, cachedAt: Date.now() };
          notifyLoyaltyChanged();
          return coreSupabaseRepository.writeLoyaltyPhoneToTable(key, mergedForWrite);
        })
        .catch((error) => {
          logSupabaseError("write loyalty tables", error, {
            phone: key,
            vouchers: Array.isArray(next?.voucherHistory) ? next.voucherHistory.length : 0
          });
        });
    }
    return next;
  },
  getCrmConfig(fallback) {
    return repository.get(STORAGE_KEYS.crmLoyalty, fallback);
  },
  saveCrmConfig(config) {
    return repository.set(STORAGE_KEYS.crmLoyalty, config);
  },
  getLoyaltyRule(fallback) {
    return this.getCrmConfig(fallback);
  },
  saveLoyaltyRule(rule) {
    return this.saveCrmConfig(rule);
  },
  async getDemoAsync(fallback) {
    return repository.getAsync(STORAGE_KEYS.loyaltyDemo, fallback);
  },
  async saveDemoAsync(data) {
    return repository.setAsync(STORAGE_KEYS.loyaltyDemo, data);
  },
  async clearDemoAsync(fallback) {
    await repository.setAsync(STORAGE_KEYS.loyaltyDemo, fallback);
    return fallback;
  },
  async getAllByPhoneAsync() {
    const now = Date.now();
    if (loyaltyRemoteCache.value && now - loyaltyRemoteCache.cachedAt < REMOTE_CACHE_TTL_MS) {
      return loyaltyRemoteCache.value;
    }
    if (loyaltyReadInFlight) return loyaltyReadInFlight;
    loyaltyReadInFlight = (async () => {
    const allowLocalFallback = shouldAllowLocalFallbackForDomain("loyalty");
    const fallback = allowLocalFallback
      ? normalizeLoyaltyByPhoneMap(await repository.getAsync(STORAGE_KEYS.loyaltyByPhone, {}))
      : {};
    try {
      const remote = await coreSupabaseRepository.readLoyaltyByPhoneFromTable();
      if (remote && typeof remote === "object" && Object.keys(remote).length) {
        const normalizedRemote = normalizeLoyaltyByPhoneMap(remote);
        await repository.setAsync(STORAGE_KEYS.loyaltyByPhone, normalizedRemote);
        loyaltyRemoteCache = { value: normalizedRemote, cachedAt: Date.now() };
        return normalizedRemote;
      }
    } catch (error) {
      logSupabaseError("read loyalty tables", error);
    }
      const normalizedFallback = normalizeLoyaltyByPhoneMap(fallback);
      loyaltyRemoteCache = { value: normalizedFallback, cachedAt: Date.now() };
      return normalizedFallback;
    })();
    try {
      return await loyaltyReadInFlight;
    } finally {
      loyaltyReadInFlight = null;
    }
  },
  async getByPhoneAsync(phone, fallback) {
    const key = getCustomerKey(phone);
    if (!key) return fallback;
    try {
      const remoteSingle = await coreSupabaseRepository.readLoyaltyForPhoneFromTable(key);
      if (remoteSingle && typeof remoteSingle === "object") {
        const normalizedRemote = normalizeLoyaltyByPhoneMap({
          [key]: remoteSingle
        });
        const remoteOnly = normalizedRemote[key] || { ...fallback, phone: key };
        const localAll = normalizeLoyaltyByPhoneMap(await repository.getAsync(STORAGE_KEYS.loyaltyByPhone, {}));
        const nextAll = normalizeLoyaltyByPhoneMap({
          ...localAll,
          [key]: remoteOnly
        });
        await repository.setAsync(STORAGE_KEYS.loyaltyByPhone, nextAll);
        loyaltyRemoteCache = { value: nextAll, cachedAt: Date.now() };
        return remoteOnly;
      }
    } catch (error) {
      logSupabaseError("read loyalty single phone", error, { phone: key });
    }
    const all = await this.getAllByPhoneAsync();
    return all[key] || { ...fallback, phone: key };
  },
  async saveByPhoneAsync(phone, loyalty, fallback) {
    const key = getCustomerKey(phone);
    if (!key) return { ...fallback };
    const all = await this.getAllByPhoneAsync();
    const currentRecord = all[key] || { ...fallback, phone: key };
    const next = {
      ...fallback,
      ...loyalty,
      phone: key,
      pointHistory: dedupePointHistoryByOrder(loyalty?.pointHistory || fallback?.pointHistory || [])
    };
    if (isSameLoyaltyPayload(currentRecord, next)) {
      return currentRecord;
    }
    let mergedForWrite = next;
    try {
      const remoteMap = await coreSupabaseRepository.readLoyaltyByPhoneFromTable();
      const remoteCurrent = remoteMap?.[key] || {};
      mergedForWrite = mergeLoyaltyRecord(remoteCurrent, next, key);
    } catch (error) {
      logSupabaseError("read remote before write loyalty", error, { phone: key });
    }
    const nextAll = normalizeLoyaltyByPhoneMap({ ...all, [key]: mergedForWrite });
    await repository.setAsync(STORAGE_KEYS.loyaltyByPhone, nextAll);
    loyaltyRemoteCache = { value: nextAll, cachedAt: Date.now() };
    notifyLoyaltyChanged();
    if (shouldWriteDomainToSupabase("loyalty")) {
      try {
        if (!isSameLoyaltyPayload(currentRecord, mergedForWrite)) {
          await coreSupabaseRepository.writeLoyaltyPhoneToTable(key, mergedForWrite);
        }
      } catch (error) {
        logSupabaseError("write loyalty tables (async)", error, {
          phone: key,
          vouchers: Array.isArray(mergedForWrite?.voucherHistory) ? mergedForWrite.voucherHistory.length : 0
        });
      }
    }
    return mergedForWrite;
  },
  async markVoucherUsedByPhoneAsync(phone, { voucherId = "", voucherCode = "", orderId = "", usedAt = "" } = {}, fallback) {
    const key = getCustomerKey(phone);
    if (!key) return null;
    const nowIso = String(usedAt || new Date().toISOString());
    const upperCode = String(voucherCode || "").trim().toUpperCase();
    const normalizedVoucherId = String(voucherId || "").trim();

    let remoteCurrent = null;
    try {
      const remoteMap = await coreSupabaseRepository.readLoyaltyByPhoneFromTable();
      remoteCurrent = remoteMap?.[key] || null;
    } catch (error) {
      logSupabaseError("read loyalty before mark voucher used", error, { phone: key, voucherId: normalizedVoucherId, voucherCode: upperCode });
    }

    const localCurrentAll = await this.getAllByPhoneAsync();
    const localCurrent = localCurrentAll?.[key] || null;
    const baseCurrent = remoteCurrent || localCurrent || { ...(fallback || {}), phone: key };
    const voucherHistory = safeArray(baseCurrent.voucherHistory);

    const nextVoucherHistory = voucherHistory.map((voucher) => {
      const sameId = normalizedVoucherId && String(voucher?.id || "").trim() === normalizedVoucherId;
      const sameCode = upperCode && String(voucher?.code || "").trim().toUpperCase() === upperCode;
      if (!sameId && !sameCode) return voucher;
      return {
        ...voucher,
        used: true,
        usedAt: nowIso,
        orderCode: String(orderId || voucher?.orderCode || "")
      };
    });

    const nextRecord = mergeLoyaltyRecord(baseCurrent, {
      ...baseCurrent,
      phone: key,
      voucherHistory: nextVoucherHistory
    }, key);

    const nextAll = normalizeLoyaltyByPhoneMap({
      ...(localCurrentAll || {}),
      [key]: nextRecord
    });
    await repository.setAsync(STORAGE_KEYS.loyaltyByPhone, nextAll);
    loyaltyRemoteCache = { value: nextAll, cachedAt: Date.now() };
    notifyLoyaltyChanged();

    if (shouldWriteDomainToSupabase("loyalty")) {
      try {
        await coreSupabaseRepository.upsertLoyaltyAccountByPhone(key, nextRecord);
      } catch (error) {
        logSupabaseError("mark voucher used write loyalty account", error, { phone: key, voucherId: normalizedVoucherId, voucherCode: upperCode, orderId });
      }
    }

    return nextRecord;
  },
  async getCrmConfigAsync(fallback) {
    return repository.getAsync(STORAGE_KEYS.crmLoyalty, fallback);
  },
  async saveCrmConfigAsync(config) {
    return repository.setAsync(STORAGE_KEYS.crmLoyalty, config);
  },
  async getLoyaltyRuleAsync(fallback) {
    return this.getCrmConfigAsync(fallback);
  },
  async saveLoyaltyRuleAsync(rule) {
    return this.saveCrmConfigAsync(rule);
  },
  async appendEventByPhoneAsync(phone, event = {}, fallback = {}) {
    const key = getCustomerKey(phone);
    if (!key) return { ...(fallback || {}), phone: key };
    if (!shouldWriteDomainToSupabase("loyalty")) {
      return this.getByPhoneAsync(key, fallback);
    }
    try {
      const remote = await coreSupabaseRepository.applyLoyaltyEvent({
        phone: key,
        entryType: event.entryType || event.type || "OTHER",
        points: Number(event.points || 0),
        orderId: event.orderId || "",
        amount: Number(event.amount || 0),
        title: event.title || "",
        note: event.note || "",
        metadata: event.metadata || {},
        createdAt: event.createdAt || new Date().toISOString()
      });
      const localAll = normalizeLoyaltyByPhoneMap(await repository.getAsync(STORAGE_KEYS.loyaltyByPhone, {}));
      const remoteOnly = normalizeLoyaltyByPhoneMap({ [key]: remote || {} })[key] || { ...(fallback || {}), phone: key };
      const nextAll = normalizeLoyaltyByPhoneMap({ ...localAll, [key]: remoteOnly });
      await repository.setAsync(STORAGE_KEYS.loyaltyByPhone, nextAll);
      loyaltyRemoteCache = { value: nextAll, cachedAt: Date.now() };
      notifyLoyaltyChanged();
      return remoteOnly;
    } catch (error) {
      logSupabaseError("append loyalty event", error, { phone: key, eventType: event.entryType || event.type || "OTHER" });
      return this.getByPhoneAsync(key, fallback);
    }
  }
};
