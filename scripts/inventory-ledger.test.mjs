import assert from "node:assert/strict";
import {
  calculateInventoryLedgerSummary,
  getInventoryDocumentPath,
  getInventoryLedgerDocumentNo,
  getInventoryMovementLabel,
  isInventoryProductionDocument,
  sumInventoryMovementQuantities
} from "../src/services/inventoryLedgerCalculations.js";

const movements = [
  { direction: "in", quantity: 10 },
  { direction: "out", quantity: 3.5 },
  { direction: "in", quantity: 2 }
];

assert.equal(sumInventoryMovementQuantities(movements, "in"), 12);
assert.equal(sumInventoryMovementQuantities(movements, "out"), 3.5);

assert.deepEqual(calculateInventoryLedgerSummary({
  currentBalance: 20,
  periodMovements: movements,
  futureMovements: [
    { direction: "in", quantity: 5 },
    { direction: "out", quantity: 1 }
  ]
}), {
  opening: 7.5,
  inbound: 12,
  outbound: 3.5,
  closing: 16,
  currentBalance: 20
});

assert.equal(getInventoryDocumentPath("transfer"), "/admin/inventory/transfers");
assert.equal(isInventoryProductionDocument("production_consumption"), true);
assert.equal(getInventoryLedgerDocumentNo({
  documentNo: "SX-OUT-LSX-000015",
  documentType: "production_consumption",
  productionOrderNo: "LSX-000015"
}), "LSX-000015");
assert.equal(getInventoryLedgerDocumentNo({
  documentNo: "SX-IN-LSX-000015",
  documentType: "production_output"
}), "LSX-000015");
assert.equal(getInventoryMovementLabel({ stage: "order_consumption", documentType: "production_consumption" }), "Sản xuất");
assert.equal(getInventoryMovementLabel({ stage: "order_consumption", documentType: "sales_order" }), "Bán hàng");
assert.equal(
  getInventoryDocumentPath("production_output", { productionOrderId: "order id/15" }),
  "/admin/inventory/production-orders?order=order%20id%2F15"
);
assert.equal(getInventoryDocumentPath("unknown"), "/admin/inventory/ledger");

console.log("inventory-ledger.test.mjs: passed");
