import { readCatalogFromStandardTable } from "./repositories/catalogSupabaseRepository.js";
import { getRuntimeStrategy } from "./repositories/runtimeStrategy.js";

export async function getCustomerOrderCatalogAsync(localProducts = null) {
  if (!getRuntimeStrategy().shouldReadThroughSupabase) return localProducts;
  // Checkout/reorder must not use the twenty-minute display cache or stale fallback.
  let timer;
  const products = await Promise.race([
    readCatalogFromStandardTable("ghr_products", null, { force: true, strict: true }),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("order_catalog_timeout")), 8000); })
  ]).finally(() => clearTimeout(timer));
  if (!Array.isArray(products)) throw new Error("order_catalog_unavailable");
  return products;
}
