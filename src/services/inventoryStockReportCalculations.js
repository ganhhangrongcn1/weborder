import {
  getInventoryItemDisplayUnitConfig,
  getInventoryItemInputUnitConfig
} from "./inventoryUnitConversion.js";

import { getInventoryStockThresholds } from "./inventoryStockThresholds.js";

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function toText(value = "") {
  return String(value || "").trim();
}

function isItemAvailableAtWarehouse(item = {}, warehouseId = "") {
  const allowedWarehouseIds = Array.isArray(item.warehouseIds)
    ? item.warehouseIds.map(toText).filter(Boolean)
    : [];
  return !allowedWarehouseIds.length || allowedWarehouseIds.includes(toText(warehouseId));
}

export function getInventoryStockState(quantity, item = {}, warehouse = {}) {
  const current = toNumber(quantity);
  const { reorderPoint, minimumStock } = getInventoryStockThresholds(item, warehouse);
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

export function getInventoryStockPurchaseValues(row = {}, item = {}, unitsById = new Map()) {
  const baseUnit = unitsById.get(item.baseUnitId) || item.baseUnit || {};
  const { unit: purchaseUnit, conversionToBase } = getInventoryItemInputUnitConfig(item, unitsById, "purchase");
  const baseQuantity = toNumber(row.quantity);
  const baseAverageCost = toNumber(row.averageCost);
  return {
    quantity: baseQuantity / conversionToBase,
    averageCost: baseAverageCost * conversionToBase,
    totalValue: baseQuantity * baseAverageCost,
    conversionToBase,
    unitName: purchaseUnit?.name || purchaseUnit?.code || baseUnit?.name || "Đơn vị mua / nhập",
    unitSymbol: purchaseUnit?.symbol || purchaseUnit?.name || purchaseUnit?.code || baseUnit?.name || "đơn vị",
    baseUnitName: baseUnit?.name || baseUnit?.code || "đơn vị kho",
    baseUnitSymbol: baseUnit?.symbol || baseUnit?.name || baseUnit?.code || "đơn vị kho"
  };
}

export function calculateInventoryStockReportSummary(rows = [], itemsById = new Map()) {
  return rows.reduce((summary, row) => {
    const quantity = toNumber(row.quantity);
    const averageCost = toNumber(row.averageCost);
    const state = getInventoryStockState(quantity, itemsById.get(row.itemId), row);
    summary.totalValue += quantity * averageCost;
    summary.rowCount += 1;
    if (quantity > 0) summary.availableCount += 1;
    if (state === "low") summary.lowCount += 1;
    if (state === "out") summary.outCount += 1;
    return summary;
  }, { totalValue: 0, rowCount: 0, availableCount: 0, lowCount: 0, outCount: 0 });
}

export function buildInventoryStockReportRows(rows = [], warehouses = [], items = []) {
  const balanceByWarehouseItem = new Map(rows.map((row) => [
    `${toText(row.warehouseId)}:${toText(row.itemId)}`,
    row
  ]));
  const result = [];

  warehouses
    .filter((warehouse) => warehouse?.id && warehouse.isActive !== false)
    .forEach((warehouse) => {
      items
        .filter((item) => item?.id && item.isActive !== false && isItemAvailableAtWarehouse(item, warehouse.id))
        .forEach((item) => {
          const key = `${toText(warehouse.id)}:${toText(item.id)}`;
          result.push({ ...(balanceByWarehouseItem.get(key) || {
            warehouseId: toText(warehouse.id),
            itemId: toText(item.id),
            quantity: 0,
            averageCost: 0,
            updatedAt: "",
            isVirtualBalance: true
          }), warehouseType: warehouse.warehouseType || warehouse.warehouse_type });
        });
    });

  return result;
}

export function countInventoryStockAttention(rows = [], itemsById = new Map()) {
  return rows.reduce((count, row) => (
    getInventoryStockState(row.quantity, itemsById.get(row.itemId), row) === "available"
      ? count
      : count + 1
  ), 0);
}

export default {
  calculateInventoryStockReportSummary,
  buildInventoryStockReportRows,
  countInventoryStockAttention,
  getInventoryStockDisplayValues,
  getInventoryStockPurchaseValues,
  getInventoryStockState
};
