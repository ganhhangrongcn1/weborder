// Persisted quantities are in the item's base unit, like minimum_stock/reorder_point.
const fields = ["minimumStock", "reorderPoint"];
const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

function normalizePair(value, factor, strict) {
  if (!isObject(value)) return null;
  const result = {};
  for (const field of fields) {
    const number = Number(value[field]);
    if (value[field] == null || !Number.isFinite(number) || number < 0) {
      if (strict) throw new Error("Ngưỡng tồn kho phải là số từ 0 trở lên.");
      return null;
    }
    result[field] = Math.round(number * factor * 1e6) / 1e6;
  }
  return result;
}

export function normalizeInventoryStockThresholds(value = {}, factor = 1, strict = false) {
  const config = isObject(value) ? value : {};
  const warehouses = {};
  for (const [id, pair] of Object.entries(isObject(config.warehouses) ? config.warehouses : {})) {
    const normalized = normalizePair(pair, factor, strict);
    if (id && normalized) warehouses[id] = normalized;
  }
  return { branch: normalizePair(config.branch, factor, strict), warehouses };
}

export function getInventoryStockThresholds(item = {}, warehouse = {}) {
  const defaults = { minimumStock: Number(item.minimumStock || 0), reorderPoint: Number(item.reorderPoint || 0) };
  const type = warehouse.warehouseType || warehouse.warehouse_type;
  if (type !== "branch") return defaults;
  const config = item.stockThresholds || item.metadata?.stock_thresholds || {};
  const id = warehouse.id || warehouse.warehouseId;
  return normalizePair(config.warehouses?.[id], 1, false)
    || normalizePair(config.branch, 1, false)
    || defaults;
}

export default { normalizeInventoryStockThresholds, getInventoryStockThresholds };
