import assert from "node:assert/strict";
import test from "node:test";
import { adminPathToState } from "../src/app/routeState.js";
import {
  calculateInventoryLotSummary,
  countInventoryLotAttention,
  getInventoryLotDaysRemaining,
  getInventoryLotDisplayValues,
  getInventoryLotExpiryState,
  matchesInventoryLotExpiryFilter
} from "../src/services/inventoryLotReportCalculations.js";
import { getInventoryRoute } from "../src/pages/admin/inventory/inventoryNavigation.js";

const item = {
  id: "item-1",
  baseUnitId: "gram",
  displayUnitId: "kg",
  purchaseUnitId: "kg",
  purchaseToBaseRatio: 1000,
  expiryWarningDays: 3,
  baseUnit: { id: "gram", name: "Gram", symbol: "g" }
};
const units = new Map([
  ["gram", { id: "gram", name: "Gram", symbol: "g" }],
  ["kg", { id: "kg", name: "Kilôgam", symbol: "kg", baseUnitId: "gram", conversionFactor: 1000 }]
]);

test("lọc nhanh có hạn mặc định và vẫn xem được toàn bộ lô không có hạn", () => {
  const states = ["expired", "expiring", "valid", "untracked"];
  assert.deepEqual(states.filter((state) => matchesInventoryLotExpiryFilter(state)), ["expired", "expiring", "valid"]);
  assert.deepEqual(states.filter((state) => matchesInventoryLotExpiryFilter(state, "all")), states);
  assert.deepEqual(states.filter((state) => matchesInventoryLotExpiryFilter(state, "untracked")), ["untracked"]);
});

test("lọc nhanh cảnh báo không thay đổi các bộ lọc trạng thái chi tiết", () => {
  const states = ["expired", "expiring", "valid", "untracked"];
  assert.deepEqual(states.filter((state) => matchesInventoryLotExpiryFilter(state, "alert")), ["expired", "expiring"]);
  for (const filter of states) {
    assert.deepEqual(states.filter((state) => matchesInventoryLotExpiryFilter(state, filter)), [filter]);
  }
});

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

test("tồn lô dùng đơn vị gốc không bị chia thêm lần nữa", () => {
  const display = getInventoryLotDisplayValues(
    { remainingQuantity: 2369, receivedQuantity: 7000 },
    { ...item, displayUnitId: "gram" }, units
  );
  assert.equal(display.remainingQuantity, 2369);
  assert.equal(display.receivedQuantity, 7000);
});

test("tổng hợp trạng thái lô và route Lô hạn sử dụng", () => {
  const rows = [
    { itemId: "item-1", expiresOn: "2026-08-25" },
    { itemId: "item-1", expiresOn: "2026-08-28" },
    { itemId: "item-1", expiresOn: "" }
  ];
  const summary = calculateInventoryLotSummary(rows, new Map([["item-1", item]]), "2026-08-26");
  assert.deepEqual(summary, { total: 3, expired: 1, expiring: 1, valid: 0, untracked: 1 });
  assert.equal(countInventoryLotAttention(rows, new Map([["item-1", item]]), "2026-08-26"), 2);
  assert.equal(adminPathToState("/admin/inventory/lots").inventoryPage, "lots");
  assert.equal(getInventoryRoute("lots").label, "Lô & hạn sử dụng");
  assert.equal(getInventoryRoute("reports").label, "Tồn kho");
});
