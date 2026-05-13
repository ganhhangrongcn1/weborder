const MINUTE = 60 * 1000;

export const DATA_STRATEGY = {
  HYBRID_CACHE: "hybrid-cache",
  SUPABASE_FIRST: "supabase-first",
  REALTIME: "realtime",
  LOCAL_ONLY: "local-only"
};

export const CONFIG_KEY_TTL_MS = {
  ghr_products: 5 * MINUTE,
  ghr_categories: 5 * MINUTE,
  ghr_toppings: 5 * MINUTE,
  ghr_option_group_presets: 5 * MINUTE,
  ghr_home_content: 5 * MINUTE,
  ghr_banners: 5 * MINUTE,
  ghr_smart_promotions: 2 * MINUTE,
  ghr_coupons: 2 * MINUTE,
  ghr_promos: 2 * MINUTE,
  ghr_campaigns: 2 * MINUTE,
  ghr_shipping_config: 2 * MINUTE,
  ghr_branches: 2 * MINUTE,
  ghr_hours: 2 * MINUTE,
  ghr_zones: 2 * MINUTE,
  ghr_loyalty: 5 * MINUTE,
  ghr_zalo_config: 5 * MINUTE
};

export const HYBRID_CACHE_KEYS = new Set(Object.keys(CONFIG_KEY_TTL_MS));

export const SUPABASE_FIRST_KEYS = new Set([
  "ghr_customers",
  "ghr_users",
  "ghr_addresses_by_phone",
  "ghr_loyalty_by_phone",
  "ghr_orders_by_phone"
]);

export const REALTIME_TABLES = new Set([
  "orders",
  "order_items",
  "kitchen_status",
  "delivery_status"
]);

export function getConfigTtlMs(key, fallbackMs) {
  const normalizedKey = String(key || "").trim();
  return CONFIG_KEY_TTL_MS[normalizedKey] ?? fallbackMs;
}

export function shouldUseHybridCacheForKey(key) {
  return HYBRID_CACHE_KEYS.has(String(key || "").trim());
}

export function shouldUseSupabaseFirstForKey(key) {
  return SUPABASE_FIRST_KEYS.has(String(key || "").trim());
}
