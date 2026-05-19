import { createSupabaseConfigAdapter } from "../adapters/supabaseConfigAdapter.js";
import { requireSupabaseClient } from "./dataSource.js";
import { getRuntimeStrategy } from "./runtimeStrategy.js";

let supabaseAdapterSingleton = null;
let supabaseAdapterClient = null;

export function getRuntimeSupabaseClient() {
  return requireSupabaseClient();
}

export function createRepositoryAdapter() {
  const strategy = getRuntimeStrategy();
  if (strategy.source === "supabase") {
    const client = requireSupabaseClient();
    if (!supabaseAdapterSingleton || supabaseAdapterClient !== client) {
      supabaseAdapterSingleton = createSupabaseConfigAdapter({ supabaseClient: client });
      supabaseAdapterClient = client;
    }
    return supabaseAdapterSingleton;
  }
  return createSupabaseConfigAdapter({ supabaseClient: null });
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
