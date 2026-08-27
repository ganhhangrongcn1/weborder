import { getInventoryItemDisplayUnitConfig } from "./inventoryUnitConversion.js";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getInventoryCountDisplayUnit(item = {}, unitsById = new Map()) {
  const { unit, conversionToBase } = getInventoryItemDisplayUnitConfig(item, unitsById);
  return {
    id: unit.id || item.baseUnitId || "",
    name: unit.name || unit.symbol || item.baseUnit?.name || "Đơn vị gốc",
    symbol: unit.symbol || unit.name || item.baseUnit?.symbol || "ĐVT",
    conversionToBase: conversionToBase > 0 ? conversionToBase : 1
  };
}

export function buildInventoryCountCreationLines(items = [], units = []) {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  return items
    .filter((item) => item.isActive !== false && item.id)
    .map((item) => {
      const unit = getInventoryCountDisplayUnit(item, unitsById);
      return { itemId: item.id, unitId: unit.id, conversionToBase: unit.conversionToBase };
    })
    .filter((line) => line.unitId);
}

export function getInventoryCountExpectedBase(line = {}) {
  if (line.expectedQuantityAtCount != null) return toNumber(line.expectedQuantityAtCount);
  return toNumber(line.systemQuantity);
}

export function getInventoryCountExpectedDisplay(line = {}) {
  return getInventoryCountExpectedBase(line) / Math.max(toNumber(line.conversionToBase, 1), 0.000001);
}

export function getInventoryCountVariance(line = {}) {
  if (line.countedQuantity == null || line.countedQuantity === "") return null;
  return toNumber(line.countedQuantity) - getInventoryCountExpectedDisplay(line);
}

export function getInventoryCountRecordedQuantity(line = {}) {
  const displayFactor = Math.max(toNumber(line.conversionToBase, 1), 0.000001);
  const recordedFactor = Math.max(toNumber(line.recordedConversionToBase, displayFactor), 0.000001);
  return toNumber(line.countedQuantity) * displayFactor / recordedFactor;
}

export default {
  buildInventoryCountCreationLines,
  getInventoryCountDisplayUnit,
  getInventoryCountExpectedBase,
  getInventoryCountExpectedDisplay,
  getInventoryCountRecordedQuantity,
  getInventoryCountVariance
};
