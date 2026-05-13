const FALLBACK_SUPABASE_URL = "https://qjaklysckgzdfjthzkzu.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_VPLwhy64zz2QQUyy02xzsg_CXs2A1JI";

export function isSupabaseConfigSyncEnabled() {
  return String(import.meta.env?.VITE_ENABLE_SUPABASE_CONFIG_SYNC || "false").toLowerCase() === "true";
}

export function isMenuSchemaBridgeMigrationEnabled() {
  return String(import.meta.env?.VITE_ENABLE_MENU_SCHEMA_BRIDGE_MIGRATION || "false").toLowerCase() === "true";
}

export function isSupabaseSeedMigrationEnabled() {
  return String(import.meta.env?.VITE_ENABLE_SUPABASE_SEED_MIGRATION || "false").toLowerCase() === "true";
}

export function isSupabaseRuntimeWriteEnabled() {
  return String(import.meta.env?.VITE_ENABLE_SUPABASE_RUNTIME_WRITES || "false").toLowerCase() === "true";
}

export function isSupabaseStrictModeEnabled() {
  return String(import.meta.env?.VITE_SUPABASE_STRICT_MODE || "false").toLowerCase() === "true";
}

export function getSupabaseEnvConfig() {
  const envUrl = String(import.meta.env?.VITE_SUPABASE_URL || "").trim();
  const envAnonKey = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || "").trim();
  return {
    url: envUrl || FALLBACK_SUPABASE_URL,
    anonKey: envAnonKey || FALLBACK_SUPABASE_ANON_KEY
  };
}
