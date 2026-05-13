import { createLocalStorageAdapter } from "../adapters/localStorageAdapter.js";
import { createAppConfigRepository, createRuntimeAppConfigRepository } from "./appConfigRepository.js";
import { getDataSource } from "./dataSource.js";
import { shouldWriteConfigKeyToSupabase } from "./writeThroughPolicy.js";

const localRepository = createAppConfigRepository(createLocalStorageAdapter());
const SUPABASE_RETRY_COUNT = 1;
const isDev = Boolean(import.meta?.env?.DEV);

function useRuntimeRepository() {
  return getDataSource() === "supabase";
}

function getRuntimeRepository() {
  return createRuntimeAppConfigRepository();
}

function readLocal(key, fallback) {
  if (useRuntimeRepository()) return fallback;
  return localRepository.get(key, fallback);
}

function writeLocal(key, value) {
  if (useRuntimeRepository()) return value;
  return localRepository.set(key, value);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry(task, retries = SUPABASE_RETRY_COUNT) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await wait(120 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

export const adminConfigRepository = {
  getLocal(key, fallback) {
    if (useRuntimeRepository()) return fallback;
    return readLocal(key, fallback);
  },
  get(key, fallback) {
    if (!useRuntimeRepository()) {
      return readLocal(key, fallback);
    }
    return getRuntimeRepository().get(key, fallback);
  },
  set(key, value) {
    const savedLocal = writeLocal(key, value);
    if (!useRuntimeRepository() || !shouldWriteConfigKeyToSupabase(key)) {
      return savedLocal;
    }
    try {
      return getRuntimeRepository().set(key, value);
    } catch (error) {
      if (isDev) {
        console.warn(`Supabase sync failed for config key "${key}" in sync set(). Kept local value.`, error);
      }
      return savedLocal;
    }
  },
  async getAsync(key, fallback) {
    if (!useRuntimeRepository()) {
      return readLocal(key, fallback);
    }
    try {
      return await runWithRetry(() => getRuntimeRepository().getAsync(key, fallback));
    } catch (_error) {
      console.warn(`Supabase read failed for config key "${key}".`, _error);
      throw _error;
    }
  },
  async getManyAsync(keys = [], fallbackByKey = {}) {
    if (!useRuntimeRepository()) {
      return Object.fromEntries(
        keys.map((key) => [key, readLocal(key, fallbackByKey[key])])
      );
    }
    try {
      return await runWithRetry(() => getRuntimeRepository().getManyAsync(keys, fallbackByKey));
    } catch (_error) {
      console.warn("Supabase batch config read failed.", _error);
      throw _error;
    }
  },
  async setAsync(key, value) {
    const savedLocal = writeLocal(key, value);
    if (!useRuntimeRepository() || !shouldWriteConfigKeyToSupabase(key)) {
      return savedLocal;
    }
    try {
      await runWithRetry(() => getRuntimeRepository().setAsync(key, value));
      return value;
    } catch (_error) {
      console.warn(`Supabase write failed for config key "${key}". Saved to local fallback.`, _error);
      return savedLocal;
    }
  }
};
