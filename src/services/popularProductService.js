import {
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";

const POPULAR_PRODUCTS_RPC = "get_customer_popular_products";
const POPULAR_PRODUCTS_CACHE_TTL_MS = 15 * 60 * 1000;
const MISSING_RPC_CACHE_TTL_MS = 5 * 60 * 1000;
const MISSING_RPC_CODES = new Set(["42883", "PGRST202"]);

let popularProductsCache = {
  key: "",
  productIds: [],
  expiresAt: 0
};
let popularProductsRequest = null;

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
    message.includes("could not find the function") ||
    message.includes("does not exist")
  );
}

function normalizePopularProductIds(rows = []) {
  return [...rows]
    .sort((first, second) => Number(first?.sales_rank || 0) - Number(second?.sales_rank || 0))
    .map((row) => String(row?.product_id || "").trim())
    .filter(Boolean);
}

function setPopularProductsCache(key, productIds, ttlMs) {
  popularProductsCache = {
    key,
    productIds,
    expiresAt: Date.now() + ttlMs
  };
  return productIds;
}

export async function getCustomerPopularProductIds({
  days = 30,
  limit = 12
} = {}) {
  const safeDays = clampInteger(days, 30, 1, 90);
  const safeLimit = clampInteger(limit, 12, 1, 50);
  const cacheKey = `${safeDays}:${safeLimit}`;
  const now = Date.now();

  if (
    popularProductsCache.key === cacheKey &&
    popularProductsCache.expiresAt > now
  ) {
    return popularProductsCache.productIds;
  }

  if (popularProductsRequest?.key === cacheKey) {
    return popularProductsRequest.promise;
  }

  const request = (async () => {
    const client = getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
    if (!client) return [];

    try {
      const { data, error } = await client.rpc(POPULAR_PRODUCTS_RPC, {
        p_days: safeDays,
        p_limit: safeLimit
      });

      if (error) {
        const ttlMs = isMissingRpcError(error) ? MISSING_RPC_CACHE_TTL_MS : 0;
        if (ttlMs > 0) return setPopularProductsCache(cacheKey, [], ttlMs);
        return [];
      }

      const productIds = normalizePopularProductIds(Array.isArray(data) ? data : []);
      return setPopularProductsCache(
        cacheKey,
        productIds,
        POPULAR_PRODUCTS_CACHE_TTL_MS
      );
    } catch {
      return [];
    }
  })();

  popularProductsRequest = {
    key: cacheKey,
    promise: request
  };

  try {
    return await request;
  } finally {
    if (popularProductsRequest?.promise === request) {
      popularProductsRequest = null;
    }
  }
}

export function clearCustomerPopularProductsCache() {
  popularProductsCache = {
    key: "",
    productIds: [],
    expiresAt: 0
  };
  popularProductsRequest = null;
}

export default {
  getCustomerPopularProductIds,
  clearCustomerPopularProductsCache
};
