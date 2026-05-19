import { createRuntimeAppConfigRepository } from "./appConfigRepository.js";
import { getDataSource } from "./dataSource.js";
import { shouldWriteConfigKeyToSupabase } from "./writeThroughPolicy.js";

const SUPABASE_RETRY_COUNT = 1;

function useRuntimeRepository() {
  return getDataSource() === "supabase";
}

function getRuntimeRepository() {
  return createRuntimeAppConfigRepository();
}

function readStaticFallback(_key, fallback) {
  return fallback;
}

function writePassthrough(_key, value) {
  return value;
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
    return readStaticFallback(key, fallback);
  },
  get(key, fallback) {
    if (!useRuntimeRepository()) {
      return readStaticFallback(key, fallback);
    }
    return getRuntimeRepository().get(key, fallback);
  },
  set(key, value) {
    const savedValue = writePassthrough(key, value);
    if (!useRuntimeRepository() || !shouldWriteConfigKeyToSupabase(key)) {
      return savedValue;
    }
    return getRuntimeRepository().set(key, value);
  },
  async getAsync(key, fallback) {
    if (!useRuntimeRepository()) {
      return readStaticFallback(key, fallback);
    }
    try {
      return await runWithRetry(() => getRuntimeRepository().getAsync(key, fallback));
    } catch (error) {
      console.warn(`Supabase read failed for config key "${key}".`, error);
      throw error;
    }
  },
  async getManyAsync(keys = [], fallbackByKey = {}) {
    if (!useRuntimeRepository()) {
      return Object.fromEntries(
        keys.map((key) => [key, readStaticFallback(key, fallbackByKey[key])])
      );
    }
    try {
      return await runWithRetry(() => getRuntimeRepository().getManyAsync(keys, fallbackByKey));
    } catch (error) {
      console.warn("Supabase batch config read failed.", error);
      throw error;
    }
  },
  async setAsync(key, value) {
    const savedValue = writePassthrough(key, value);
    if (!useRuntimeRepository() || !shouldWriteConfigKeyToSupabase(key)) {
      return savedValue;
    }
    await runWithRetry(() => getRuntimeRepository().setAsync(key, value));
    return value;
  }
};
