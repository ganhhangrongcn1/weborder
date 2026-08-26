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
  if (unit.baseUnitId === item.baseUnitId && toNumber(unit.conversionFactor) > 0) {
    return toNumber(unit.conversionFactor);
  }
  if (unit.id === item.purchaseUnitId && toNumber(item.purchaseToBaseRatio) > 0) {
    return toNumber(item.purchaseToBaseRatio);
  }
  return 1;
}

export function getInventoryCompatibleUnits(item = {}, units = []) {
  const baseUnitId = String(item.baseUnitId || "").trim();
  const purchaseUnitId = String(item.purchaseUnitId || "").trim();
  if (!baseUnitId) return [];

  return units.filter((unit) => {
    if (!unit?.id || unit.isActive === false) return false;
    return unit.id === baseUnitId
      || unit.baseUnitId === baseUnitId
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

export default {
  getInventoryItemDisplayUnit,
  getInventoryItemDisplayUnitConfig,
  getInventoryCompatibleUnits,
  getInventoryUnitToBaseFactor
};
