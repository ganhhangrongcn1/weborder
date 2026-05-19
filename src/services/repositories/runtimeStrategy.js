import { getDataSource, requireSupabaseClient } from "./dataSource.js";
import { isSupabaseConfigSyncEnabled, isSupabaseStrictModeEnabled } from "../supabase/runtimeFlags.js";

const DATA_FLOW_MODE = {
  localOnly: "local-only",
  supabaseOnly: "supabase-only"
};

export function getRuntimeStrategy() {
  const source = getDataSource();
  const strictModeEnabled = isSupabaseStrictModeEnabled();
  const hasSupabaseClient = Boolean(requireSupabaseClient());
  const configSyncEnabled = isSupabaseConfigSyncEnabled();

  const shouldReadThroughSupabase = source === "supabase" && hasSupabaseClient;
  const shouldWriteThroughSupabase = source === "supabase" && (hasSupabaseClient || configSyncEnabled);
  const mode = source === "supabase" ? DATA_FLOW_MODE.supabaseOnly : DATA_FLOW_MODE.localOnly;

  return {
    mode,
    source,
    strictModeEnabled,
    hasSupabaseClient,
    configSyncEnabled,
    shouldReadThroughSupabase,
    shouldWriteThroughSupabase,
    effectiveSource: source === "supabase" ? "supabase" : "local"
  };
}
