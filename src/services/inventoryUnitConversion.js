function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getInventoryItemDisplayUnit(item = {}, unitsById = new Map()) {
  return unitsById.get(item.displayUnitId)
    || unitsById.get(item.purchaseUnitId)
    || unitsById.get(item.baseUnitId)
    || item.purchaseUnit
    || item.baseUnit
    || {};
}

export function getInventoryUnitToBaseFactor(item = {}, unit = {}) {
  if (!unit?.id || unit.id === item.baseUnitId) return 1;
  if (unit.id === item.purchaseUnitId && toNumber(item.purchaseToBaseRatio) > 0) {
    return toNumber(item.purchaseToBaseRatio);
  }
  return 1;
}

export function convertInventoryQuantityToBase(quantity = 0, conversionToBase = 1) {
  const factor = Math.max(0, toNumber(conversionToBase, 1));
  return toNumber(quantity) * (factor > 0 ? factor : 1);
}

export function convertInventoryQuantityFromBase(quantity = 0, conversionToBase = 1) {
  const factor = Math.max(0, toNumber(conversionToBase, 1));
  return toNumber(quantity) / (factor > 0 ? factor : 1);
}

export function getInventoryCompatibleUnits(item = {}, units = []) {
  const baseUnitId = String(item.baseUnitId || "").trim();
  const purchaseUnitId = String(item.purchaseUnitId || "").trim();
  if (!baseUnitId) return [];

  return units.filter((unit) => {
    if (!unit?.id || unit.isActive === false) return false;
    return unit.id === baseUnitId
      || unit.id === purchaseUnitId;
  });
}

export function getInventoryItemDisplayUnitConfig(item = {}, unitsById = new Map()) {
  const unit = getInventoryItemDisplayUnit(item, unitsById);
  return {
    unit,
    unitId: unit.id || item.baseUnitId || "",
    conversionToBase: getInventoryUnitToBaseFactor(item, unit)
  };
}

export function getInventoryItemInputUnitConfig(item = {}, unitsById = new Map(), preference = "display") {
  const preferredUnitId = preference === "purchase" ? item.purchaseUnitId : item.displayUnitId;
  const unit = unitsById.get(preferredUnitId) || getInventoryItemDisplayUnit(item, unitsById);
  return {
    unit,
    unitId: unit.id || item.baseUnitId || "",
    conversionToBase: getInventoryUnitToBaseFactor(item, unit)
  };
}

export default {
  getInventoryItemDisplayUnit,
  getInventoryItemDisplayUnitConfig,
  getInventoryItemInputUnitConfig,
  getInventoryCompatibleUnits,
  getInventoryUnitToBaseFactor,
  convertInventoryQuantityToBase,
  convertInventoryQuantityFromBase
};
