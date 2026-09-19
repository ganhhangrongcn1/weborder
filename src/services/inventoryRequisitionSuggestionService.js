import { isInventoryItemAvailableAtWarehouse } from "./inventoryMasterDataService.js";
import { getInventoryStockState } from "./inventoryStockReportCalculations.js";
import { getInventoryStockThresholds } from "./inventoryStockThresholds.js";
import { getInventoryItemInputUnitConfig } from "./inventoryUnitConversion.js";

const toNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const toText = (value = "") => String(value || "").trim().toLowerCase();

function isDiscreteUnit(unit = {}) {
  const label = toText(`${unit.code || ""} ${unit.symbol || ""} ${unit.name || ""}`);
  return !/(^|\s)(kg|kilogram|g|gr|gram|l|lit|lít|ml|millilit)(\s|$)/i.test(label);
}

function roundSuggestedQuantity(value, unit) {
  if (isDiscreteUnit(unit)) return Math.ceil(value - 1e-9);
  return Math.ceil(value * 1000 - 1e-9) / 1000;
}

export function buildInventoryRequisitionSuggestions({
  warehouse = {},
  items = [],
  units = [],
  stockRows = [],
  pendingRows = []
} = {}) {
  if (!warehouse?.id) return [];
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const stockByItem = new Map(stockRows.filter((row) => row.warehouseId === warehouse.id).map((row) => [row.itemId, row]));
  const pendingByItem = pendingRows.reduce((map, row) => map.set(row.itemId, toNumber(map.get(row.itemId)) + toNumber(row.quantity)), new Map());

  return items
    .filter((item) => item?.id && item.isActive !== false && isInventoryItemAvailableAtWarehouse(item, warehouse.id))
    .map((item) => {
      const stockRow = stockByItem.get(item.id) || { warehouseId: warehouse.id, itemId: item.id, quantity: 0 };
      if (getInventoryStockState(stockRow.quantity, item, { ...warehouse, ...stockRow }) === "available") return null;
      const thresholds = getInventoryStockThresholds(item, warehouse);
      const input = getInventoryItemInputUnitConfig(item, unitsById, "purchase");
      const conversionToBase = Math.max(0.000001, toNumber(input.conversionToBase) || 1);
      // A configured zero explicitly requests manual entry, with no fallback.
      const targetBase = Math.max(0, toNumber(thresholds.targetStock ?? item.maximumStock));
      const currentBase = toNumber(stockRow.quantity);
      const pendingBase = toNumber(pendingByItem.get(item.id));
      const requiredBase = Math.max(0, targetBase - currentBase - pendingBase);
      if (targetBase > 0 && requiredBase <= 0) return null;
      return {
        itemId: item.id,
        unitId: input.unitId,
        conversionToBase,
        quantity: targetBase > 0 ? roundSuggestedQuantity(requiredBase / conversionToBase, input.unit) : "",
        needsManualQuantity: targetBase === 0,
        currentBase,
        pendingBase,
        targetBase
      };
    })
    .filter(Boolean);
}

export default { buildInventoryRequisitionSuggestions };
