import { createLocalStorageAdapter } from "../adapters/localStorageAdapter.js";
import { createSupabaseConfigAdapter } from "../adapters/supabaseConfigAdapter.js";
import { requireSupabaseClient } from "./dataSource.js";
import { getRuntimeStrategy } from "./runtimeStrategy.js";

let localAdapterSingleton = null;
let supabaseAdapterSingleton = null;
let supabaseAdapterClient = null;

export function getRuntimeSupabaseClient() {
  return requireSupabaseClient();
}

export function createRepositoryAdapter() {
  const strategy = getRuntimeStrategy();
  if (strategy.source === "supabase") {
    const client = requireSupabaseClient();
    if (!client) {
      if (!localAdapterSingleton) {
        localAdapterSingleton = createLocalStorageAdapter();
      }
      return localAdapterSingleton;
    }
    if (!supabaseAdapterSingleton || supabaseAdapterClient !== client) {
      supabaseAdapterSingleton = createSupabaseConfigAdapter({ supabaseClient: client });
      supabaseAdapterClient = client;
    }
    return supabaseAdapterSingleton;
  }
  if (!localAdapterSingleton) {
    localAdapterSingleton = createLocalStorageAdapter();
  }
  return localAdapterSingleton;
}

export function getRepositoryRuntimeInfo() {
  const strategy = getRuntimeStrategy();
  return {
    source: strategy.source,
    hasSupabaseClient: strategy.hasSupabaseClient,
    mode: strategy.mode,
    configSyncEnabled: strategy.configSyncEnabled,
    effectiveSource: strategy.effectiveSource
  };
}
