import { getRuntimeStrategy } from "./runtimeStrategy.js";
import { isSupabaseRuntimeWriteEnabled, isSupabaseSeedMigrationEnabled } from "../supabase/runtimeFlags.js";

export const DATA_FLOW_MODE = {
  localOnly: "local-only",
  localFirstWithRemoteSync: "local-first-with-remote-sync",
  supabaseFirstWithLocalFallback: "supabase-first-with-local-fallback",
  supabaseOnly: "supabase-only"
};

export const DOMAIN_DATA_POLICY = {
  menuCatalog: {
    mode: DATA_FLOW_MODE.supabaseFirstWithLocalFallback,
    readStrategy: "supabase-first",
    writeStrategy: "write-through",
    allowRuntimeWrites: true,
    allowFallbackLocal: true,
    strictRemoteWrite: false
  },
  marketingPromos: {
    mode: DATA_FLOW_MODE.supabaseFirstWithLocalFallback,
    readStrategy: "supabase-first",
    writeStrategy: "write-through",
    allowRuntimeWrites: true,
    allowFallbackLocal: true,
    strictRemoteWrite: false
  },
  smartPromotions: {
    mode: DATA_FLOW_MODE.supabaseFirstWithLocalFallback,
    readStrategy: "supabase-first",
    writeStrategy: "write-through",
    allowRuntimeWrites: true,
    allowFallbackLocal: true,
    strictRemoteWrite: false
  },
  coupons: {
    mode: DATA_FLOW_MODE.supabaseFirstWithLocalFallback,
    readStrategy: "supabase-first",
    writeStrategy: "write-through",
    allowRuntimeWrites: true,
    allowFallbackLocal: true,
    strictRemoteWrite: false
  },
  campaigns: {
    mode: DATA_FLOW_MODE.supabaseFirstWithLocalFallback,
    readStrategy: "supabase-first",
    writeStrategy: "write-through",
    allowRuntimeWrites: true,
    allowFallbackLocal: true,
    strictRemoteWrite: false
  },
  appConfigs: {
    mode: DATA_FLOW_MODE.supabaseFirstWithLocalFallback,
    readStrategy: "supabase-first",
    writeStrategy: "write-through",
    allowRuntimeWrites: true,
    allowFallbackLocal: true,
    strictRemoteWrite: false
  },
  customers: {
    mode: DATA_FLOW_MODE.supabaseFirstWithLocalFallback,
    readStrategy: "supabase-first",
    writeStrategy: "write-through",
    allowRuntimeWrites: true,
    allowFallbackLocal: true,
    strictRemoteWrite: false
  },
  customerAddresses: {
    mode: DATA_FLOW_MODE.supabaseFirstWithLocalFallback,
    readStrategy: "supabase-first",
    writeStrategy: "write-through",
    allowRuntimeWrites: true,
    allowFallbackLocal: true,
    strictRemoteWrite: false
  },
  orders: {
    mode: DATA_FLOW_MODE.supabaseFirstWithLocalFallback,
    readStrategy: "supabase-first",
    writeStrategy: "write-through",
    allowRuntimeWrites: true,
    allowFallbackLocal: true,
    strictRemoteWrite: false
  },
  loyalty: {
    mode: DATA_FLOW_MODE.supabaseFirstWithLocalFallback,
    readStrategy: "supabase-first",
    writeStrategy: "write-through",
    allowRuntimeWrites: true,
    allowFallbackLocal: true,
    strictRemoteWrite: false
  },
  localSession: {
    mode: DATA_FLOW_MODE.localOnly,
    readStrategy: "local-only",
    writeStrategy: "local-only",
    allowRuntimeWrites: false,
    allowFallbackLocal: true,
    strictRemoteWrite: false
  }
};

export const CONFIG_KEY_DOMAIN_MAP = {
  ghr_products: "menuCatalog",
  ghr_categories: "menuCatalog",
  ghr_toppings: "menuCatalog",
  ghr_promos: "marketingPromos",
  ghr_smart_promotions: "smartPromotions",
  ghr_coupons: "coupons",
  ghr_campaigns: "campaigns",
  ghr_shipping_config: "appConfigs",
  ghr_zalo_config: "appConfigs",
  ghr_hours: "appConfigs",
  ghr_home_content: "appConfigs",
  ghr_banners: "appConfigs",
  ghr_option_group_presets: "appConfigs",
  ghr_branches: "appConfigs",
  ghr_zones: "appConfigs",
  ghr_menu_schema: "appConfigs",
  ghr_loyalty: "appConfigs"
};

export function resolveDomainForConfigKey(key) {
  return CONFIG_KEY_DOMAIN_MAP[String(key || "").trim()] || "localSession";
}

export function getDomainDataPolicy(domain) {
  return DOMAIN_DATA_POLICY[domain] || DOMAIN_DATA_POLICY.localSession;
}

export function shouldWriteDomainToSupabase(domain) {
  const strategy = getRuntimeStrategy();
  const policy = getDomainDataPolicy(domain);
  const supabaseReady = strategy?.effectiveSource === "supabase";
  const runtimeWriteEnabled = isSupabaseRuntimeWriteEnabled();

  if (!policy.allowRuntimeWrites) return false;
  if (policy.mode === DATA_FLOW_MODE.localOnly) return false;
  if (policy.mode === DATA_FLOW_MODE.localFirstWithRemoteSync) {
    return supabaseReady;
  }
  if (policy.mode === DATA_FLOW_MODE.supabaseFirstWithLocalFallback) {
    return supabaseReady && runtimeWriteEnabled;
  }
  if (policy.mode === DATA_FLOW_MODE.supabaseOnly) {
    return supabaseReady && runtimeWriteEnabled;
  }
  return false;
}

export function shouldWriteConfigKeyToSupabase(key) {
  const domain = resolveDomainForConfigKey(key);
  if (!shouldWriteDomainToSupabase(domain)) return false;

  // Guard go-live: only allow explicit-safe config writes by default in Supabase mode.
  if (isSupabaseSeedMigrationEnabled()) return true;

  const safeConfigKeys = new Set([
    "ghr_shipping_config",
    "ghr_zalo_config",
    "ghr_hours",
    "ghr_loyalty",
    "ghr_menu_schema",
    "ghr_option_group_presets",
    "ghr_goong_config",
    "ghr_goong_api_key",
    "ghr_goong_maptiles_key",
    "ghr_loyalty_ui_text",
    "ghr_loyalty_rule_rows",
    "ghr_loyalty_bonus_display",
    "ghr_loyalty_milestones"
  ]);

  return safeConfigKeys.has(String(key || "").trim());
}
