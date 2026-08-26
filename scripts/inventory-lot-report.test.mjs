import assert from "node:assert/strict";
import test from "node:test";
import { adminPathToState } from "../src/app/routeState.js";
import {
  calculateInventoryLotSummary,
  getInventoryLotDaysRemaining,
  getInventoryLotDisplayValues,
  getInventoryLotExpiryState
} from "../src/services/inventoryLotReportCalculations.js";
import { getInventoryRoute } from "../src/pages/admin/inventory/inventoryNavigation.js";

const item = {
  id: "item-1",
  baseUnitId: "gram",
  displayUnitId: "kg",
  expiryWarningDays: 3,
  baseUnit: { id: "gram", name: "Gram", symbol: "g" }
};
const units = new Map([
  ["gram", { id: "gram", name: "Gram", symbol: "g" }],
  ["kg", { id: "kg", name: "Kilôgam", symbol: "kg", baseUnitId: "gram", conversionFactor: 1000 }]
]);

test("phân loại lô theo đúng ngưỡng cảnh báo của nguyên vật liệu", () => {
  assert.equal(getInventoryLotExpiryState({ expiresOn: "2026-08-25" }, item, "2026-08-26"), "expired");
  assert.equal(getInventoryLotExpiryState({ expiresOn: "2026-08-29" }, item, "2026-08-26"), "expiring");
  assert.equal(getInventoryLotExpiryState({ expiresOn: "2026-08-30" }, item, "2026-08-26"), "valid");
  assert.equal(getInventoryLotExpiryState({ expiresOn: "" }, item, "2026-08-26"), "untracked");
});

test("tính số ngày còn lại không lệch múi giờ", () => {
  assert.equal(getInventoryLotDaysRemaining("2026-08-29", "2026-08-26"), 3);
  assert.equal(getInventoryLotDaysRemaining("2026-08-25", "2026-08-26"), -1);
});

test("quy đổi số lượng lô từ đơn vị gốc sang đơn vị hiển thị", () => {
  const display = getInventoryLotDisplayValues({ remainingQuantity: 1500, receivedQuantity: 2000 }, item, units);
  assert.equal(display.remainingQuantity, 1.5);
  assert.equal(display.receivedQuantity, 2);
  assert.equal(display.unitSymbol, "kg");
});

test("tổng hợp trạng thái lô và route Lô hạn sử dụng", () => {
  const rows = [
    { itemId: "item-1", expiresOn: "2026-08-25" },
    { itemId: "item-1", expiresOn: "2026-08-28" },
    { itemId: "item-1", expiresOn: "" }
  ];
  const summary = calculateInventoryLotSummary(rows, new Map([["item-1", item]]), "2026-08-26");
  assert.deepEqual(summary, { total: 3, expired: 1, expiring: 1, valid: 0, untracked: 1 });
  assert.equal(adminPathToState("/admin/inventory/lots").inventoryPage, "lots");
  assert.equal(getInventoryRoute("lots").label, "Lô & hạn sử dụng");
  assert.equal(getInventoryRoute("reports").label, "Tồn kho");
});
