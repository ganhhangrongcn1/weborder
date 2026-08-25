import { getInventoryItemDisplayUnitConfig } from "./inventoryUnitConversion.js";

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function getInventoryStockState(quantity, item = {}) {
  const current = toNumber(quantity);
  const reorderPoint = toNumber(item.reorderPoint);
  const minimumStock = toNumber(item.minimumStock);
  if (current <= 0) return "out";
  if ((reorderPoint > 0 && current <= reorderPoint) || (minimumStock > 0 && current < minimumStock)) return "low";
  return "available";
}

export function getInventoryStockDisplayValues(row = {}, item = {}, unitsById = new Map()) {
  const baseUnit = unitsById.get(item.baseUnitId) || item.baseUnit || {};
  const { unit: displayUnit, conversionToBase } = getInventoryItemDisplayUnitConfig(item, unitsById);
  const baseQuantity = toNumber(row.quantity);
  const baseAverageCost = toNumber(row.averageCost);
  return {
    quantity: baseQuantity / conversionToBase,
    averageCost: baseAverageCost * conversionToBase,
    totalValue: baseQuantity * baseAverageCost,
    conversionToBase,
    unitName: displayUnit?.name || displayUnit?.code || baseUnit?.name || "Đơn vị tồn",
    unitSymbol: displayUnit?.symbol || displayUnit?.name || displayUnit?.code || baseUnit?.name || "đơn vị"
  };
}

export function calculateInventoryStockReportSummary(rows = [], itemsById = new Map()) {
  return rows.reduce((summary, row) => {
    const quantity = toNumber(row.quantity);
    const averageCost = toNumber(row.averageCost);
    const state = getInventoryStockState(quantity, itemsById.get(row.itemId));
    summary.totalValue += quantity * averageCost;
    summary.rowCount += 1;
    if (state === "available") summary.availableCount += 1;
    if (state === "low") summary.lowCount += 1;
    if (state === "out") summary.outCount += 1;
    return summary;
  }, { totalValue: 0, rowCount: 0, availableCount: 0, lowCount: 0, outCount: 0 });
}

export default { calculateInventoryStockReportSummary, getInventoryStockDisplayValues, getInventoryStockState };
