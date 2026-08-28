import assert from "node:assert/strict";
import {
  buildInventoryCountCreationLines,
  getInventoryCountExpectedDisplay,
  getInventoryCountRecordedQuantity,
  getInventoryCountVariance
} from "../src/services/inventoryCountCalculations.js";
import { filterInventoryItemsByWarehouse } from "../src/services/inventoryMasterDataService.js";

const units = [
  { id: "gram", name: "Gram", symbol: "g", baseUnitId: "", conversionFactor: 1 },
  { id: "kg", name: "Kilôgam", symbol: "kg", baseUnitId: "gram", conversionFactor: 1000 }
];
const items = [{ id: "bot-ot", name: "Bột ớt", baseUnitId: "gram", displayUnitId: "kg", isActive: true }];
const creationLines = buildInventoryCountCreationLines(items, units);
assert.deepEqual(creationLines, [{ itemId: "bot-ot", unitId: "kg", conversionToBase: 1 }]);

const scopedItems = [
  ...items,
  { id: "central-only", name: "Mã Kho Tổng", baseUnitId: "gram", isActive: true, warehouseIds: ["central"] },
  { id: "branch-only", name: "Mã chi nhánh", baseUnitId: "gram", isActive: true, warehouseIds: ["branch"] }
];
assert.deepEqual(
  filterInventoryItemsByWarehouse(scopedItems, "branch").map((item) => item.id),
  ["bot-ot", "branch-only"]
);

const countLine = { conversionToBase: 1000, systemQuantity: 1000, expectedQuantityAtCount: 1000, countedQuantity: 0.9 };
assert.equal(getInventoryCountExpectedDisplay(countLine), 1);
assert.ok(Math.abs(getInventoryCountVariance(countLine) + 0.1) < 0.000001);
assert.equal(getInventoryCountVariance({ ...countLine, countedQuantity: 1 }), 0);
assert.equal(getInventoryCountRecordedQuantity({
  countedQuantity: 2,
  conversionToBase: 40,
  recordedConversionToBase: 1
}), 80);

console.log("inventory-count calculations: ok");
