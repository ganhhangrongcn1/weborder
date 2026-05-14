const FALLBACK_SUPABASE_URL = "https://qjaklysckgzdfjthzkzu.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_VPLwhy64zz2QQUyy02xzsg_CXs2A1JI";

function readBooleanEnv(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

export function isSupabaseConfigSyncEnabled() {
  return readBooleanEnv(import.meta.env?.VITE_ENABLE_SUPABASE_CONFIG_SYNC, false);
}

export function isMenuSchemaBridgeMigrationEnabled() {
  return readBooleanEnv(import.meta.env?.VITE_ENABLE_MENU_SCHEMA_BRIDGE_MIGRATION, false);
}

export function isSupabaseSeedMigrationEnabled() {
  return readBooleanEnv(import.meta.env?.VITE_ENABLE_SUPABASE_SEED_MIGRATION, false);
}

export function isSupabaseRuntimeWriteEnabled() {
  return readBooleanEnv(import.meta.env?.VITE_ENABLE_SUPABASE_RUNTIME_WRITES, false);
}

export function isSupabaseStrictModeEnabled() {
  return readBooleanEnv(import.meta.env?.VITE_SUPABASE_STRICT_MODE, false);
}

export function getSupabaseEnvConfig() {
  const envUrl = String(import.meta.env?.VITE_SUPABASE_URL || "").trim();
  const envAnonKey = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || "").trim();
  return {
    url: envUrl || FALLBACK_SUPABASE_URL,
    anonKey: envAnonKey || FALLBACK_SUPABASE_ANON_KEY
  };
}
