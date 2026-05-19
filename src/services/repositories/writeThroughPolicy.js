import { getRuntimeStrategy } from "./runtimeStrategy.js";
import { isSupabaseRuntimeWriteEnabled, isSupabaseSeedMigrationEnabled } from "../supabase/runtimeFlags.js";

export const DATA_FLOW_MODE = {
  localOnly: "local-only",
  supabaseOnly: "supabase-only"
};

export const DOMAIN_DATA_POLICY = {
  menuCatalog: {
    mode: DATA_FLOW_MODE.supabaseOnly,
    readStrategy: "supabase-only",
    writeStrategy: "remote-only",
    allowRuntimeWrites: true,
    allowFallbackLocal: false,
    strictRemoteWrite: true
  },
  marketingPromos: {
    mode: DATA_FLOW_MODE.supabaseOnly,
    readStrategy: "supabase-only",
    writeStrategy: "remote-only",
    allowRuntimeWrites: true,
    allowFallbackLocal: false,
    strictRemoteWrite: true
  },
  smartPromotions: {
    mode: DATA_FLOW_MODE.supabaseOnly,
    readStrategy: "supabase-only",
    writeStrategy: "remote-only",
    allowRuntimeWrites: true,
    allowFallbackLocal: false,
    strictRemoteWrite: true
  },
  coupons: {
    mode: DATA_FLOW_MODE.supabaseOnly,
    readStrategy: "supabase-only",
    writeStrategy: "remote-only",
    allowRuntimeWrites: true,
    allowFallbackLocal: false,
    strictRemoteWrite: true
  },
  campaigns: {
    mode: DATA_FLOW_MODE.supabaseOnly,
    readStrategy: "supabase-only",
    writeStrategy: "remote-only",
    allowRuntimeWrites: true,
    allowFallbackLocal: false,
    strictRemoteWrite: true
  },
  appConfigs: {
    mode: DATA_FLOW_MODE.supabaseOnly,
    readStrategy: "supabase-only",
    writeStrategy: "remote-only",
    allowRuntimeWrites: true,
    allowFallbackLocal: false,
    strictRemoteWrite: true
  },
  customers: {
    mode: DATA_FLOW_MODE.supabaseOnly,
    readStrategy: "supabase-only",
    writeStrategy: "remote-only",
    allowRuntimeWrites: true,
    allowFallbackLocal: false,
    strictRemoteWrite: true
  },
  customerAddresses: {
    mode: DATA_FLOW_MODE.supabaseOnly,
    readStrategy: "supabase-only",
    writeStrategy: "remote-only",
    allowRuntimeWrites: true,
    allowFallbackLocal: false,
    strictRemoteWrite: true
  },
  orders: {
    mode: DATA_FLOW_MODE.supabaseOnly,
    readStrategy: "supabase-only",
    writeStrategy: "remote-only",
    allowRuntimeWrites: true,
    allowFallbackLocal: false,
    strictRemoteWrite: true
  },
  loyalty: {
    mode: DATA_FLOW_MODE.supabaseOnly,
    readStrategy: "supabase-only",
    writeStrategy: "remote-only",
    allowRuntimeWrites: true,
    allowFallbackLocal: false,
    strictRemoteWrite: true
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
  if (policy.mode === DATA_FLOW_MODE.supabaseOnly) {
    return supabaseReady && runtimeWriteEnabled;
  }
  return false;
}

export function shouldWriteConfigKeyToSupabase(key) {
  const domain = resolveDomainForConfigKey(key);
  if (!shouldWriteDomainToSupabase(domain)) return false;

  if (isSupabaseSeedMigrationEnabled()) return true;
  return resolveDomainForConfigKey(key) !== "localSession";
}

export function isStrictSupabaseDomainMode() {
  const strategy = getRuntimeStrategy();
  return strategy?.source === "supabase" && strategy?.strictModeEnabled;
}

export function shouldAllowLocalFallbackForDomain(domain) {
  if (isStrictSupabaseDomainMode()) return false;
  const policy = getDomainDataPolicy(domain);
  return Boolean(policy?.allowFallbackLocal);
}
