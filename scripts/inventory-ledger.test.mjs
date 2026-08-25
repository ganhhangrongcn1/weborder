import assert from "node:assert/strict";
import {
  calculateInventoryLedgerSummary,
  getInventoryDocumentPath,
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
assert.equal(getInventoryDocumentPath("unknown"), "/admin/inventory/ledger");

console.log("inventory-ledger.test.mjs: passed");
