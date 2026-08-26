import assert from "node:assert/strict";
import test from "node:test";
import { adminPathToState } from "../src/app/routeState.js";
import { buildInventoryAlerts, countInventoryAlerts } from "../src/services/inventoryAlertCalculations.js";
import { getInventoryRoute } from "../src/pages/admin/inventory/inventoryNavigation.js";

const itemById = new Map([
  ["item-1", { id: "item-1", name: "Xoài sơ chế", isActive: true, reorderPoint: 5, minimumStock: 2, trackExpiry: true, expiryWarningDays: 3 }],
  ["item-2", { id: "item-2", name: "Muối", isActive: true, reorderPoint: 10, minimumStock: 3, trackExpiry: false, expiryWarningDays: 0 }]
]);
const warehouseById = new Map([
  ["warehouse-1", { id: "warehouse-1", name: "Kho CN 30/4" }]
]);

test("tách tồn âm khỏi tồn thấp và ưu tiên cảnh báo khẩn cấp", () => {
  const alerts = buildInventoryAlerts({
    sources: {
      balances: [
        { warehouseId: "warehouse-1", itemId: "item-1", quantity: -1, updatedAt: "2026-08-26T08:00:00Z" },
        { warehouseId: "warehouse-1", itemId: "item-2", quantity: 2, updatedAt: "2026-08-26T09:00:00Z" }
      ],
      lots: [],
      documents: []
    },
    itemById,
    warehouseById,
    todayKey: "2026-08-26"
  });

  assert.equal(alerts[0].kind, "negative_stock");
  assert.equal(alerts[0].category, "negative");
  assert.equal(alerts[1].kind, "reorder");
  assert.deepEqual(countInventoryAlerts(alerts), { all: 2, expiry: 0, stock: 1, negative: 1, documents: 0 });
});

test("chỉ cảnh báo hạn dùng cho NVL đã bật theo dõi HSD", () => {
  const alerts = buildInventoryAlerts({
    sources: {
      balances: [],
      lots: [
        { id: "lot-1", warehouseId: "warehouse-1", itemId: "item-1", lotNumber: "LO-1", expiresOn: "2026-08-28", remainingQuantity: 1000 },
        { id: "lot-2", warehouseId: "warehouse-1", itemId: "item-2", lotNumber: "LO-2", expiresOn: "2026-08-25", remainingQuantity: 1000 }
      ],
      documents: []
    },
    itemById,
    warehouseById,
    todayKey: "2026-08-26"
  });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].kind, "expiring");
  assert.equal(alerts[0].lotNumber, "LO-1");
});

test("chứng từ chờ giữ đúng kho nguồn và kho nhận", () => {
  const alerts = buildInventoryAlerts({
    sources: {
      balances: [],
      lots: [],
      documents: [{
        id: "document-1",
        documentNo: "CK-0001",
        documentType: "transfer",
        status: "in_transit",
        sourceWarehouseId: "warehouse-1",
        destinationWarehouseId: "warehouse-2",
        occurredAt: "2026-08-26T09:00:00Z"
      }]
    },
    itemById,
    warehouseById,
    todayKey: "2026-08-26"
  });

  assert.equal(alerts[0].category, "documents");
  assert.equal(alerts[0].routePage, "transfers");
  assert.deepEqual(alerts[0].warehouseIds, ["warehouse-1", "warehouse-2"]);
});

test("route Cảnh báo kho nằm trong phân hệ kho", () => {
  assert.equal(adminPathToState("/admin/inventory/alerts").inventoryPage, "alerts");
  assert.equal(getInventoryRoute("alerts").label, "Cảnh báo kho");
});
