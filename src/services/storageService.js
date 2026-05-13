import { createRuntimeAppConfigRepository } from "./repositories/appConfigRepository.js";
import { getRuntimeStrategy } from "./repositories/runtimeStrategy.js";
import { LEGACY_STORAGE_KEYS, LOCAL_ONLY_STORAGE_KEYS, STORAGE_KEYS } from "./repositories/storageKeys.js";

const runtimeRepository = createRuntimeAppConfigRepository();
const localListeners = new Map();
const loggedLegacyReads = new Set();
const loggedLegacyWriteBlocks = new Set();
const isDev = Boolean(import.meta?.env?.DEV);
const BLOCKED_LEGACY_WRITE_KEYS = new Set([
  "ghr_users_demo",
  "ghr_user_demo",
  STORAGE_KEYS.legacyOrderStatus
]);
const legacyKeySet = new Set(LEGACY_STORAGE_KEYS);

function logLegacyReadOnce(key, hasValue) {
  const mark = `${key}:${hasValue ? "1" : "0"}`;
  if (loggedLegacyReads.has(mark)) return;
  loggedLegacyReads.add(mark);
  console.info(`[legacy-storage] read key "${key}" (${hasValue ? "has value" : "empty"}).`);
}

function logLegacyWriteBlockOnce(key) {
  if (loggedLegacyWriteBlocks.has(key)) return;
  loggedLegacyWriteBlocks.add(key);
  console.warn(`[legacy-storage] blocked write to deprecated key "${key}".`);
}

function safeParseJson(value, fallback) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function emitLocalChange(key, value) {
  const listeners = localListeners.get(key);
  if (!listeners || !listeners.size) return;
  listeners.forEach((callback) => {
    try {
      callback(value);
    } catch {
      // Keep adapter resilient: one listener failure must not break others.
    }
  });
}

export function readLocal(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    if (legacyKeySet.has(key)) {
      logLegacyReadOnce(key, saved != null);
    }
    return safeParseJson(saved, fallback);
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  if (BLOCKED_LEGACY_WRITE_KEYS.has(key)) {
    logLegacyWriteBlockOnce(key);
    return value;
  }
  localStorage.setItem(key, JSON.stringify(value));
  emitLocalChange(key, value);
  return value;
}

export function removeLocal(key) {
  if (BLOCKED_LEGACY_WRITE_KEYS.has(key)) {
    logLegacyWriteBlockOnce(key);
    return;
  }
  localStorage.removeItem(key);
  emitLocalChange(key, undefined);
}

export function subscribeLocal(key, callback) {
  if (!localListeners.has(key)) {
    localListeners.set(key, new Set());
  }
  const listeners = localListeners.get(key);
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    if (!listeners.size) {
      localListeners.delete(key);
    }
  };
}

export function loadMock(key, fallback) {
  const strategy = getRuntimeStrategy();
  const isStrictSupabaseMode = strategy.source === "supabase" && strategy.strictModeEnabled;
  if (isStrictSupabaseMode && !LOCAL_ONLY_STORAGE_KEYS.includes(key)) {
    return fallback;
  }

  const localValue = readLocal(key, fallback);
  let hasLocal = false;
  try {
    hasLocal = localStorage.getItem(key) !== null;
  } catch {
    hasLocal = false;
  }
  if (hasLocal) return localValue;
  if (LOCAL_ONLY_STORAGE_KEYS.includes(key)) return fallback;

  if (strategy.shouldReadThroughSupabase || strategy.shouldWriteThroughSupabase) {
    runtimeRepository
      .getAsync(key, fallback)
      .then((remote) => {
        let stillMissingLocal = false;
        try {
          stillMissingLocal = localStorage.getItem(key) === null;
        } catch {
          stillMissingLocal = false;
        }
        if (remote !== undefined && stillMissingLocal) {
          writeLocal(key, remote);
        }
      })
      .catch((error) => {
        if (isDev) {
          console.warn(`[storageService] loadMock remote hydrate failed for key "${key}"`, error);
        }
      });
  }

  return fallback;
}

export function saveMock(key, value) {
  const strategy = getRuntimeStrategy();
  const isStrictSupabaseMode = strategy.source === "supabase" && strategy.strictModeEnabled;
  if (!isDev && LOCAL_ONLY_STORAGE_KEYS.includes(key) && key === STORAGE_KEYS.loyaltyDemo) {
    console.warn("[storageService] loyalty demo data is active in non-DEV runtime.");
  }
  if (!isStrictSupabaseMode || LOCAL_ONLY_STORAGE_KEYS.includes(key)) {
    writeLocal(key, value);
  }
  if (LOCAL_ONLY_STORAGE_KEYS.includes(key)) return value;

  if (strategy.shouldWriteThroughSupabase) {
    runtimeRepository.setAsync(key, value).catch((error) => {
      console.warn(`[storageService] sync failed for key "${key}"`, error);
    });
  }
  return value;
}

export function getCustomerKey(phone) {
  return normalizeVietnamPhone(phone);
}

function normalizeVietnamPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("0084")) {
    digits = `84${digits.slice(4)}`;
  }
  if (digits.startsWith("84")) {
    digits = `0${digits.slice(2)}`;
  } else if (!digits.startsWith("0") && digits.length === 9) {
    digits = `0${digits}`;
  }

  // Canonical key for VN mobile in this app: 0xxxxxxxxx (10 digits)
  if (!/^0\d{9}$/.test(digits)) return "";
  return digits;
}
