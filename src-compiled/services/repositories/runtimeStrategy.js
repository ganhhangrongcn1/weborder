import { getDataSource, requireSupabaseClient } from "./dataSource.js";
import { isSupabaseConfigSyncEnabled, isSupabaseStrictModeEnabled } from "../supabase/runtimeFlags.js";

const DATA_FLOW_MODE = {
  localOnly: "local-only",
  localFirstWithRemoteSync: "local-first-with-remote-sync",
  supabaseFirstWithLocalFallback: "supabase-first-with-local-fallback",
  supabaseOnly: "supabase-only"
};

export function getRuntimeStrategy() {
  const source = getDataSource();
  const strictModeEnabled = isSupabaseStrictModeEnabled();
  const hasSupabaseClient = Boolean(requireSupabaseClient());
  const configSyncEnabled = isSupabaseConfigSyncEnabled();

  // Do not hard-crash on first paint while runtime client is still bootstrapping.
  // Strict mode is enforced by mode selection and write policy, not by startup throw.
  const shouldReadThroughSupabase = source === "supabase" && hasSupabaseClient;
  const shouldWriteThroughSupabase = shouldReadThroughSupabase || configSyncEnabled;
  const mode = source === "supabase"
    ? strictModeEnabled
      ? DATA_FLOW_MODE.supabaseOnly
      : shouldReadThroughSupabase
        ? DATA_FLOW_MODE.supabaseFirstWithLocalFallback
        : DATA_FLOW_MODE.localFirstWithRemoteSync
    : shouldWriteThroughSupabase
      ? DATA_FLOW_MODE.localFirstWithRemoteSync
      : DATA_FLOW_MODE.localOnly;

  return {
    mode,
    source,
    strictModeEnabled,
    hasSupabaseClient,
    configSyncEnabled,
    shouldReadThroughSupabase,
    shouldWriteThroughSupabase,
    effectiveSource: shouldReadThroughSupabase ? "supabase" : "local"
  };
}
