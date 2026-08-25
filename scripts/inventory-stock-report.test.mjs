import assert from "node:assert/strict";
import {
  calculateInventoryStockReportSummary,
  getInventoryStockDisplayValues,
  getInventoryStockState
} from "../src/services/inventoryStockReportCalculations.js";

const items = new Map([
  ["a", { minimumStock: 5, reorderPoint: 8 }],
  ["b", { minimumStock: 0, reorderPoint: 0 }]
]);
const rows = [
  { itemId: "a", quantity: 10, averageCost: 100 },
  { itemId: "a", quantity: 6, averageCost: 200 },
  { itemId: "b", quantity: 0, averageCost: 500 }
];

assert.equal(getInventoryStockState(10, items.get("a")), "available");
assert.equal(getInventoryStockState(6, items.get("a")), "low");
assert.equal(getInventoryStockState(0, items.get("b")), "out");
assert.deepEqual(getInventoryStockDisplayValues(
  { quantity: 1000, averageCost: 30 },
  { baseUnitId: "gram", displayUnitId: "kg", purchaseUnitId: "kg", purchaseToBaseRatio: 1000 },
  new Map([
    ["gram", { id: "gram", name: "Gram", symbol: "g", baseUnitId: "", conversionFactor: 1 }],
    ["kg", { id: "kg", name: "Kilôgam", symbol: "Kg", baseUnitId: "gram", conversionFactor: 1000 }]
  ])
), {
  quantity: 1,
  averageCost: 30000,
  totalValue: 30000,
  conversionToBase: 1000,
  unitName: "Kilôgam",
  unitSymbol: "Kg"
});
assert.deepEqual(calculateInventoryStockReportSummary(rows, items), {
  totalValue: 2200,
  rowCount: 3,
  availableCount: 1,
  lowCount: 1,
  outCount: 1
});

console.log("inventory-stock-report.test.mjs: passed");
