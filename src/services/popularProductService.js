import {
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import createKeyedReadCache from "./keyedReadCache.js";

const POPULAR_PRODUCTS_RPC = "get_customer_popular_products";
const POPULAR_PRODUCTS_CACHE_TTL_MS = 15 * 60 * 1000;
const MISSING_RPC_CACHE_TTL_MS = 5 * 60 * 1000;
const MISSING_RPC_CODES = new Set(["42883", "PGRST202"]);
const TRANSIENT_ERROR_CACHE_TTL_MS = 30000;
const popularProductsCache = createKeyedReadCache();

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isMissingRpcError(error = null) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return (
    MISSING_RPC_CODES.has(code) ||
    message.includes("could not find the function public.get_customer_popular_products")
  );
}

function normalizePopularProductIds(rows = []) {
  return [...rows]
    .sort((first, second) => Number(first?.sales_rank || 0) - Number(second?.sales_rank || 0))
    .map((row) => String(row?.product_id || "").trim())
    .filter(Boolean);
}

export async function getCustomerPopularProductIds({
  days = 30,
  limit = 12
} = {}) {
  const safeDays = clampInteger(days, 30, 1, 90);
  const safeLimit = clampInteger(limit, 12, 1, 50);
  const cacheKey = `${safeDays}:${safeLimit}`;
  return popularProductsCache.read(cacheKey, async () => {
    try {
      const client = getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
      if (!client) return { value: [], ttlMs: 0 };
      const { data, error } = await client.rpc(POPULAR_PRODUCTS_RPC, {
        p_days: safeDays,
        p_limit: safeLimit
      });

      if (error) {
        return {
          value: [],
          ttlMs: isMissingRpcError(error)
            ? MISSING_RPC_CACHE_TTL_MS : TRANSIENT_ERROR_CACHE_TTL_MS
        };
      }

      const productIds = normalizePopularProductIds(Array.isArray(data) ? data : []);
      return { value: productIds, ttlMs: POPULAR_PRODUCTS_CACHE_TTL_MS };
    } catch {
      return { value: [], ttlMs: TRANSIENT_ERROR_CACHE_TTL_MS };
    }
  });
}

export function clearCustomerPopularProductsCache() {
  popularProductsCache.clear();
}

export default {
  getCustomerPopularProductIds,
  clearCustomerPopularProductsCache
};
