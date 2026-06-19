const POS_CATALOG_CACHE_KEY = "ghr_pos_catalog_cache_v1";
const POS_CATALOG_CACHE_EVENT = "ghr:pos-catalog-cache-changed";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function getStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  } catch {
  }
  return null;
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCache(raw = {}) {
  if (!raw || typeof raw !== "object") {
    return {
      products: [],
      categories: [],
      branches: [],
      cachedAt: ""
    };
  }

  return {
    products: getArray(raw.products),
    categories: getArray(raw.categories).map(toText).filter(Boolean),
    branches: getArray(raw.branches),
    cachedAt: toText(raw.cachedAt)
  };
}

function notifyCatalogCacheChanged(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(POS_CATALOG_CACHE_EVENT, {
    detail: {
      ...detail,
      emittedAt: Date.now()
    }
  }));
}

export function readPosCatalogCache() {
  const storage = getStorage();
  if (!storage) return normalizeCache();

  try {
    return normalizeCache(JSON.parse(storage.getItem(POS_CATALOG_CACHE_KEY) || "null"));
  } catch {
    return normalizeCache();
  }
}

export function savePosCatalogCache({ products = [], categories = [], branches = [] } = {}) {
  const current = readPosCatalogCache();
  const nextProducts = getArray(products);
  const nextCategories = getArray(categories).map(toText).filter(Boolean);
  const nextBranches = getArray(branches);
  const next = normalizeCache({
    products: nextProducts.length ? nextProducts : current.products,
    categories: nextCategories.length ? nextCategories : current.categories,
    branches: nextBranches.length ? nextBranches : current.branches,
    cachedAt: new Date().toISOString()
  });

  const storage = getStorage();
  if (!storage) return next;

  try {
    storage.setItem(POS_CATALOG_CACHE_KEY, JSON.stringify(next));
  } catch {
  }

  notifyCatalogCacheChanged({
    productsCount: next.products.length,
    categoriesCount: next.categories.length,
    branchesCount: next.branches.length,
    cachedAt: next.cachedAt
  });
  return next;
}

export function subscribePosCatalogCache(onChange) {
  if (typeof window === "undefined" || typeof onChange !== "function") return () => {};
  const handler = (event) => onChange(event.detail || {});
  window.addEventListener(POS_CATALOG_CACHE_EVENT, handler);
  return () => window.removeEventListener(POS_CATALOG_CACHE_EVENT, handler);
}
