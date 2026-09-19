import assert from "node:assert/strict";
import { buildInventoryRequisitionSuggestions } from "../src/services/inventoryRequisitionSuggestionService.js";

const warehouse = { id: "branch-1", warehouseType: "branch" };
const units = [
  { id: "gram", name: "Gram", symbol: "Gr", isActive: true },
  { id: "kg", name: "Kilogram", symbol: "Kg", isActive: true },
  { id: "bag", name: "Bịch", symbol: "Bịch", isActive: true }
];
const items = [
  {
    id: "mango", name: "Xoài", isActive: true, baseUnitId: "gram", purchaseUnitId: "kg",
    purchaseToBaseRatio: 1000, minimumStock: 1000, reorderPoint: 2000, maximumStock: 5000,
    stockThresholds: { branch: { minimumStock: 500, reorderPoint: 1000, targetStock: 3000 }, warehouses: {} }
  },
  {
    id: "bagged", name: "Bánh tráng", isActive: true, baseUnitId: "bag", purchaseUnitId: "bag",
    purchaseToBaseRatio: 1, minimumStock: 2, reorderPoint: 3, maximumStock: 10
  }
];

const suggestions = buildInventoryRequisitionSuggestions({
  warehouse,
  items,
  units,
  stockRows: [
    { warehouseId: "branch-1", itemId: "mango", quantity: 800 },
    { warehouseId: "branch-1", itemId: "bagged", quantity: 2 }
  ],
  pendingRows: [
    { itemId: "mango", quantity: 500 },
    { itemId: "bagged", quantity: 1.2 }
  ]
});

assert.deepEqual(suggestions.map(({ itemId, unitId, quantity }) => ({ itemId, unitId, quantity })), [
  { itemId: "mango", unitId: "kg", quantity: 1.7 },
  { itemId: "bagged", unitId: "bag", quantity: 7 }
]);

assert.equal(buildInventoryRequisitionSuggestions({
  warehouse,
  items,
  units,
  stockRows: items.map((item) => ({ warehouseId: "branch-1", itemId: item.id, quantity: 10000 }))
}).length, 0);

const manualItem = { ...items[0], orderQuantity: 9999,
  stockThresholds: { branch: { minimumStock: 500, reorderPoint: 1000, targetStock: 0 }, warehouses: {} } };
const manual = buildInventoryRequisitionSuggestions({ warehouse, items: [manualItem], units });
assert.equal(manual.length, 1);
assert.equal(manual[0].quantity, "", "explicit zero must not inherit central target or order quantity");
assert.equal(manual[0].needsManualQuantity, true);
const unset = buildInventoryRequisitionSuggestions({ warehouse, items: [{ ...items[1], maximumStock: 0, orderQuantity: 100 }], units });
assert.equal(unset[0].quantity, "", "no target must not invent one purchase unit or use old order quantity");
const covered = buildInventoryRequisitionSuggestions({ warehouse, items: [items[1]], units, pendingRows: [{ itemId: "bagged", quantity: 10 }] });
assert.equal(covered.length, 0, "incoming goods cover the target");
console.log("inventory requisition suggestions: ok");
