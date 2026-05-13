import { getConfigTtlMs } from "../repositories/dataStrategyMatrix.js";
import { isSupabaseStrictModeEnabled } from "../supabase/runtimeFlags.js";

export function createSupabaseConfigAdapter({
  supabaseClient,
  table = "app_configs",
  keyColumn = "id",
  valueColumn = "value"
}) {
  const SMALL_CONFIG_TTL_MS = 5 * 60 * 1000;
  const DEFAULT_TTL_MS = 5 * 60 * 1000;
  const cache = new Map();
  const inFlight = new Map();
  const pendingBatch = new Map();
  const readFailures = new Map();
  let batchScheduled = false;
  const READ_ERROR_BACKOFF_BASE_MS = 4000;
  const READ_ERROR_BACKOFF_MAX_MS = 30000;
  const isDev = Boolean(import.meta?.env?.DEV);
  const strictModeEnabled = isSupabaseStrictModeEnabled();

  function getTtlMs(key) {
    return getConfigTtlMs(key, SMALL_CONFIG_TTL_MS || DEFAULT_TTL_MS);
  }

  function getFreshCache(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() - item.cachedAt > getTtlMs(key)) {
      if (isDev) console.info(`[supabaseConfigAdapter] cache stale: ${key}`);
      return null;
    }
    if (isDev) console.info(`[supabaseConfigAdapter] cache hit: ${key}`);
    return item;
  }

  function setCache(key, value, updatedAt = "") {
    cache.set(key, {
      value,
      updatedAt,
      cachedAt: Date.now()
    });
  }

  function getReadFailureState(key) {
    return readFailures.get(key) || { count: 0, nextRetryAt: 0 };
  }

  function isInReadBackoff(key) {
    const state = getReadFailureState(key);
    return Date.now() < Number(state.nextRetryAt || 0);
  }

  function markReadFailure(key) {
    const current = getReadFailureState(key);
    const nextCount = Math.max(1, Number(current.count || 0) + 1);
    const backoff = Math.min(READ_ERROR_BACKOFF_MAX_MS, READ_ERROR_BACKOFF_BASE_MS * (2 ** (nextCount - 1)));
    readFailures.set(key, {
      count: nextCount,
      nextRetryAt: Date.now() + backoff
    });
  }

  function clearReadFailure(key) {
    readFailures.delete(key);
  }

  function readLocalFallback(key, fallback) {
    if (strictModeEnabled) return fallback;
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeLocalFallback(key, value) {
    if (strictModeEnabled) return value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage write errors to keep adapter non-blocking.
    }
    return value;
  }

  async function fetchBatch(keys) {
    if (!supabaseClient) return new Map();
    const { data, error } = await supabaseClient
      .from(table)
      .select(`${keyColumn},${valueColumn},updated_at`)
      .in(keyColumn, keys);
    if (error) {
      throw error;
    }
    return new Map((data || []).map((row) => [row[keyColumn], row]));
  }

  function scheduleBatchFlush() {
    if (batchScheduled) return;
    batchScheduled = true;
    queueMicrotask(async () => {
      batchScheduled = false;
      const entries = Array.from(pendingBatch.entries());
      pendingBatch.clear();
      const keys = entries.map(([key]) => key);

      try {
        const rowsByKey = await fetchBatch(keys);
        entries.forEach(([key, pending]) => {
          const row = rowsByKey.get(key);
          const value = row ? row[valueColumn] : pending.fallback;
          setCache(key, value, row?.updated_at || "");
          clearReadFailure(key);
          if (row) {
            writeLocalFallback(key, value);
          }
          pending.resolve(value ?? pending.fallback);
          inFlight.delete(key);
        });
      } catch (error) {
        entries.forEach(([key, pending]) => {
          markReadFailure(key);
          setCache(key, pending.fallback, "");
          if (isDev) {
            console.warn(`[supabaseConfigAdapter] fetch failed, fallback local: ${key}`, {
              message: error?.message || String(error || "")
            });
          }
          pending.resolve(pending.fallback);
          inFlight.delete(key);
        });
      }
    });
  }

  async function loadAsync(key, fallback) {
    if (!supabaseClient) return fallback;
    const cached = getFreshCache(key);
    if (cached) return cached.value ?? fallback;
    if (isInReadBackoff(key)) {
      setCache(key, fallback, "");
      return fallback;
    }
    if (inFlight.has(key)) return inFlight.get(key);

    const promise = new Promise((resolve, reject) => {
      pendingBatch.set(key, { fallback, resolve, reject });
      scheduleBatchFlush();
    });
    if (isDev) console.info(`[supabaseConfigAdapter] background refresh scheduled: ${key}`);
    inFlight.set(key, promise);
    return promise;
  }

  async function loadManyAsync(keys = [], fallbackByKey = {}) {
    const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
    if (!uniqueKeys.length) return {};
    const pairs = await Promise.all(
      uniqueKeys.map(async (key) => [key, await loadAsync(key, fallbackByKey[key])])
    );
    return Object.fromEntries(pairs);
  }

  async function saveAsync(key, value) {
    if (!supabaseClient) return value;
    const { error } = await supabaseClient
      .from(table)
      .upsert(
        {
          [keyColumn]: key,
          [valueColumn]: value,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: keyColumn
        }
      );
    if (error) {
      throw error;
    }
    setCache(key, value, new Date().toISOString());
    return value;
  }

  return {
    load(key, fallback) {
      const localValue = readLocalFallback(key, fallback);
      loadAsync(key, localValue)
        .then((remoteValue) => {
          if (remoteValue !== undefined) {
            writeLocalFallback(key, remoteValue);
          }
        })
        .catch((error) => {
          console.warn(`[supabaseConfigAdapter] read failed for key "${key}". Using local fallback.`, error);
        });
      return localValue;
    },
    save(key, value) {
      writeLocalFallback(key, value);
      saveAsync(key, value).catch((error) => {
        console.warn(`[supabaseConfigAdapter] write failed for key "${key}". Kept local fallback.`, error);
      });
      return value;
    },
    loadManyAsync,
    loadAsync,
    saveAsync
  };
}
