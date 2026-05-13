import { adminConfigRepository } from "./adminConfigRepository.js";
import {
  readCatalogFromStandardTable,
  writeCatalogToStandardTable,
  writeOptionGroupsSnapshotToTables
} from "./catalogSupabaseRepository.js";
import { getRuntimeStrategy } from "./runtimeStrategy.js";
import { shouldWriteConfigKeyToSupabase } from "./writeThroughPolicy.js";

export const CATALOG_CONFIG_KEYS = {
  products: "ghr_products",
  toppings: "ghr_toppings",
  promos: "ghr_promos",
  banners: "ghr_banners",
  homeContent: "ghr_home_content",
  coupons: "ghr_coupons",
  smartPromotions: "ghr_smart_promotions",
  campaigns: "ghr_campaigns",
  branches: "ghr_branches",
  hours: "ghr_hours",
  zones: "ghr_zones",
  categories: "ghr_categories"
};

export const INITIAL_CATALOG_CONFIG_KEYS = [
  CATALOG_CONFIG_KEYS.products,
  CATALOG_CONFIG_KEYS.toppings,
  CATALOG_CONFIG_KEYS.promos,
  CATALOG_CONFIG_KEYS.homeContent,
  CATALOG_CONFIG_KEYS.banners,
  CATALOG_CONFIG_KEYS.smartPromotions,
  CATALOG_CONFIG_KEYS.branches,
  CATALOG_CONFIG_KEYS.hours,
  CATALOG_CONFIG_KEYS.categories
];

export const LAZY_CATALOG_CONFIG_KEYS = [
  CATALOG_CONFIG_KEYS.coupons,
  CATALOG_CONFIG_KEYS.campaigns,
  CATALOG_CONFIG_KEYS.zones
];

const lazyCatalogKeySet = new Set(LAZY_CATALOG_CONFIG_KEYS);
export const catalogConfigRepository = {
  get(key, fallback) {
    if (lazyCatalogKeySet.has(key)) {
      return adminConfigRepository.getLocal(key, fallback);
    }
    return adminConfigRepository.get(key, fallback);
  },
  set(key, value) {
    return adminConfigRepository.set(key, value);
  },
  async getAsync(key, fallback) {
    const strategy = getRuntimeStrategy();
    if (strategy.shouldReadThroughSupabase) {
      const standardValue = await readCatalogFromStandardTable(key, fallback);
      const hasStandardValue = Array.isArray(standardValue)
        ? standardValue.length > 0
        : standardValue !== fallback;
      if (hasStandardValue) return standardValue;
    }
    return adminConfigRepository.getAsync(key, fallback);
  },
  async getManyAsync(keyFallbackPairs = []) {
    const entries = keyFallbackPairs.filter((item) => item?.key);
    const values = {};
    await Promise.all(
      entries.map(async ({ key, fallback }) => {
        values[key] = await this.getAsync(key, fallback);
      })
    );
    return values;
  },
  async setAsync(key, value) {
    const savedValue = await adminConfigRepository.setAsync(key, value);
    if (shouldWriteConfigKeyToSupabase(key)) {
      try {
        await writeCatalogToStandardTable(key, savedValue);
      } catch (error) {
        // Best-effort write-through: keep app_config as source-safe fallback.
        console.warn(`[catalogConfigRepository] write-through failed for key "${key}"`, error);
      }
    }
    return savedValue;
  }
};

export async function syncMenuCatalogToSupabase({
  products = [],
  categories = [],
  toppings = [],
  optionGroupPresets = []
} = {}) {
  const strategy = getRuntimeStrategy();
  if (!strategy.shouldReadThroughSupabase) {
    return { ok: false, reason: "supabase_read_disabled" };
  }

  await writeCatalogToStandardTable(CATALOG_CONFIG_KEYS.products, Array.isArray(products) ? products : []);
  await writeCatalogToStandardTable(CATALOG_CONFIG_KEYS.categories, Array.isArray(categories) ? categories : []);
  await writeCatalogToStandardTable(CATALOG_CONFIG_KEYS.toppings, Array.isArray(toppings) ? toppings : []);
  await writeOptionGroupsSnapshotToTables({
    optionGroupPresets: Array.isArray(optionGroupPresets) ? optionGroupPresets : [],
    products: Array.isArray(products) ? products : []
  });

  return { ok: true };
}

export async function syncPromotionCatalogToSupabase({
  promos = [],
  campaigns = [],
  coupons = [],
  smartPromotions = []
} = {}) {
  const strategy = getRuntimeStrategy();
  if (!strategy.shouldReadThroughSupabase) {
    return { ok: false, reason: "supabase_read_disabled" };
  }

  await writeCatalogToStandardTable(CATALOG_CONFIG_KEYS.promos, Array.isArray(promos) ? promos : []);
  await writeCatalogToStandardTable(CATALOG_CONFIG_KEYS.campaigns, Array.isArray(campaigns) ? campaigns : []);
  await writeCatalogToStandardTable(CATALOG_CONFIG_KEYS.coupons, Array.isArray(coupons) ? coupons : []);
  await writeCatalogToStandardTable(CATALOG_CONFIG_KEYS.smartPromotions, Array.isArray(smartPromotions) ? smartPromotions : []);

  return { ok: true };
}

export async function syncAppearanceCatalogToSupabase({
  homeContent = [],
  banners = []
} = {}) {
  const strategy = getRuntimeStrategy();
  if (!strategy.shouldReadThroughSupabase) {
    return { ok: false, reason: "supabase_read_disabled" };
  }

  await writeCatalogToStandardTable(CATALOG_CONFIG_KEYS.homeContent, Array.isArray(homeContent) ? homeContent : []);
  await writeCatalogToStandardTable(CATALOG_CONFIG_KEYS.banners, Array.isArray(banners) ? banners : []);

  return { ok: true };
}

export async function syncBranchesToSupabase(branches = []) {
  const strategy = getRuntimeStrategy();
  if (!strategy.shouldReadThroughSupabase) {
    return { ok: false, reason: "supabase_read_disabled" };
  }
  await writeCatalogToStandardTable(CATALOG_CONFIG_KEYS.branches, Array.isArray(branches) ? branches : []);
  return { ok: true };
}

export async function syncLocalCatalogToSupabase() {
  const keys = Object.values(CATALOG_CONFIG_KEYS);
  const results = [];

  for (const key of keys) {
    try {
      const localValue = adminConfigRepository.get(key, null);
      await adminConfigRepository.setAsync(key, localValue);
      results.push({ key, ok: true });
    } catch (error) {
      console.warn(`[catalogConfigRepository] sync local -> supabase failed for key "${key}"`, error);
      results.push({ key, ok: false, error });
    }
  }

  return results;
}
