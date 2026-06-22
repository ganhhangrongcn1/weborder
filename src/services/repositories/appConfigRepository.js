import { createRepositoryAdapter } from "./repositoryRuntime.js";
import { shouldWriteConfigKeyToSupabase } from "./writeThroughPolicy.js";
import { getDataSource } from "./dataSource.js";

function shouldLogPolicyBlock() {
  return Boolean(import.meta?.env?.DEV);
}

function returnWithoutLocalWrite(key, value) {
  if (getDataSource() === "supabase") {
    return value;
  }
  return value;
}

function isWriteBlockedByPolicy(enforceWritePolicy, key) {
  if (!enforceWritePolicy) return false;
  return !shouldWriteConfigKeyToSupabase(key);
}

export function createAppConfigRepository(adapter = createRepositoryAdapter(), options = {}) {
  const { enforceWritePolicy = false } = options;

  return {
    prime(key, value) {
      if (adapter.prime) return adapter.prime(key, value);
      return value;
    },
    get(key, fallback) {
      return adapter.load(key, fallback);
    },
    set(key, value) {
      if (isWriteBlockedByPolicy(enforceWritePolicy, key)) {
        if (shouldLogPolicyBlock()) {
          console.info(`[appConfigRepository] blocked supabase write for key "${key}" by writeThroughPolicy.`);
        }
        return returnWithoutLocalWrite(key, value);
      }
      return adapter.save(key, value);
    },
    async getAsync(key, fallback) {
      if (adapter.loadAsync) return adapter.loadAsync(key, fallback);
      return adapter.load(key, fallback);
    },
    async getManyAsync(keys, fallbackByKey = {}) {
      if (adapter.loadManyAsync) return adapter.loadManyAsync(keys, fallbackByKey);
      const pairs = await Promise.all(
        (keys || []).map(async (key) => [key, await this.getAsync(key, fallbackByKey[key])])
      );
      return Object.fromEntries(pairs);
    },
    async setAsync(key, value) {
      if (isWriteBlockedByPolicy(enforceWritePolicy, key)) {
        if (shouldLogPolicyBlock()) {
          console.info(`[appConfigRepository] blocked async supabase write for key "${key}" by writeThroughPolicy.`);
        }
        return returnWithoutLocalWrite(key, value);
      }
      if (adapter.saveAsync) return adapter.saveAsync(key, value);
      return adapter.save(key, value);
    }
  };
}

export function createRuntimeAppConfigRepository() {
  return createAppConfigRepository(createRepositoryAdapter(), { enforceWritePolicy: true });
}
