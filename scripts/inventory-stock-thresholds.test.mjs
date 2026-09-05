import test from "node:test";
import assert from "node:assert/strict";
import { getInventoryStockThresholds, normalizeInventoryStockThresholds } from "../src/services/inventoryStockThresholds.js";
import { normalizeInventoryItem, normalizeInventoryMasterDataInput } from "../src/services/inventoryMasterDataService.js";
import { buildInventoryStockReportRows, calculateInventoryStockReportSummary, countInventoryStockAttention, getInventoryStockState } from "../src/services/inventoryStockReportCalculations.js";
import { buildInventoryAlerts } from "../src/services/inventoryAlertCalculations.js";

const central = { id: "central", warehouseType: "central", name: "Kho Tổng" };
const branch = { id: "branch", warehouseType: "branch", name: "CN 30/4" };
const other = { id: "other", warehouseType: "branch", name: "CN khác" };
const item = { id: "mango", name: "Xoài", minimumStock: 10000, reorderPoint: 20000 };
const config = { branch: { minimumStock: 2000, reorderPoint: 3000 }, warehouses: { branch: { minimumStock: 4000, reorderPoint: 5000 } } };

test("nguyên liệu cũ giữ nguyên ngưỡng ở cả Kho Tổng và chi nhánh", () => {
  const legacy = normalizeInventoryItem({ id: item.id, minimum_stock: 10000, reorder_point: 20000 });
  for (const warehouse of [central, branch, other]) {
    assert.deepEqual(getInventoryStockThresholds(legacy, warehouse), { minimumStock: 10000, reorderPoint: 20000 });
    assert.equal(getInventoryStockState(15000, legacy, warehouse), "low");
  }
});

test("ưu tiên kho riêng, mặc định chi nhánh rồi Kho Tổng", () => {
  const configured = { ...item, stockThresholds: config };
  assert.equal(getInventoryStockThresholds(configured, central).reorderPoint, 20000);
  assert.equal(getInventoryStockThresholds(configured, branch).reorderPoint, 5000);
  assert.equal(getInventoryStockThresholds(configured, other).reorderPoint, 3000);
  assert.equal(getInventoryStockThresholds(configured, { ...branch, warehouseType: "department" }).reorderPoint, 20000);
  const inherited = { ...item, stockThresholds: { branch: null, warehouses: {} } };
  assert.equal(getInventoryStockThresholds(inherited, branch).reorderPoint, 20000);
});

test("ngưỡng 0 tắt cảnh báo thấp nhưng không tắt hết hàng hoặc tồn âm", () => {
  const configured = { ...item, stockThresholds: { ...config, warehouses: { branch: { minimumStock: 0, reorderPoint: 0 } } } };
  assert.equal(getInventoryStockState(1, configured, branch), "available");
  assert.equal(getInventoryStockState(0, configured, branch), "out");
  assert.equal(getInventoryStockState(-1, configured, branch), "out");
  assert.equal(getInventoryStockState(1, configured, central), "low");
});

test("điểm nhắc nhập bao gồm bằng ngưỡng, tồn tối thiểu dùng nhỏ hơn", () => {
  assert.equal(getInventoryStockState(3000, { ...item, stockThresholds: config }, other), "low");
  assert.equal(getInventoryStockState(3001, { ...item, stockThresholds: config }, other), "available");
  const minimumOnly = { ...item, stockThresholds: { branch: { minimumStock: 2000, reorderPoint: 0 } } };
  assert.equal(getInventoryStockState(2000, minimumOnly, branch), "available");
  assert.equal(getInventoryStockState(1999, minimumOnly, branch), "low");
});

test("lưu và mở lại ngưỡng theo kg với tồn theo gram, giữ metadata khác", () => {
  const input = { name: "Xoài", displayUnitId: "gram", purchaseUnitId: "kg", purchaseToBaseRatio: 1000,
    stockSettingsUnit: "purchase", minimumStock: 10, reorderPoint: 20,
    metadata: { existing_setting: "keep" },
    stockThresholds: { branch: { minimumStock: 2, reorderPoint: 3 }, warehouses: { branch: { minimumStock: 4, reorderPoint: 5 } } } };
  const payload = normalizeInventoryMasterDataInput("items", input);
  assert.equal(payload.metadata.existing_setting, "keep");
  assert.deepEqual(payload.metadata.stock_thresholds, config);
  const saved = normalizeInventoryItem(payload);
  assert.deepEqual(normalizeInventoryStockThresholds(saved.stockThresholds, 1 / saved.purchaseToBaseRatio), input.stockThresholds);
  const changedUnit = normalizeInventoryMasterDataInput("items", { ...input, displayUnitId: "kg", purchaseUnitId: "kg", purchaseToBaseRatio: 1 });
  assert.deepEqual(changedUnit.metadata.stock_thresholds, input.stockThresholds);
  assert.equal(getInventoryStockState(3, normalizeInventoryItem(changedUnit), other), "low");
});

test("chặn ngưỡng âm/không hợp lệ và giữ cấu hình khi bên gọi không gửi field mới", () => {
  assert.throws(() => normalizeInventoryStockThresholds({ branch: { minimumStock: -1, reorderPoint: 1 } }, 1, true), /Ngưỡng tồn/);
  assert.throws(() => normalizeInventoryStockThresholds({ branch: { minimumStock: "bad", reorderPoint: 1 } }, 1, true), /Ngưỡng tồn/);
  const payload = normalizeInventoryMasterDataInput("items", { name: "Xoài", displayUnitId: "gram", metadata: { stock_thresholds: config } });
  assert.deepEqual(payload.metadata.stock_thresholds, config);
});

test("báo cáo, bộ lọc cảnh báo và số đếm dùng ngưỡng từng kho", () => {
  const configured = { ...item, stockThresholds: config };
  const warehouses = [central, branch, other];
  const items = new Map([[item.id, configured]]);
  const rows = buildInventoryStockReportRows(warehouses.map((warehouse) => ({ warehouseId: warehouse.id, itemId: item.id, quantity: 4000, averageCost: 1 })), warehouses, [configured]);
  assert.deepEqual(rows.map((row) => getInventoryStockState(row.quantity, configured, row)), ["low", "low", "available"]);
  assert.equal(calculateInventoryStockReportSummary(rows, items).lowCount, 2);
  assert.equal(countInventoryStockAttention(rows, items), 2);
  const alerts = buildInventoryAlerts({ sources: { balances: rows }, itemById: items, warehouseById: new Map(warehouses.map((w) => [w.id, w])) });
  assert.deepEqual(alerts.map((a) => a.warehouseId).sort(), ["branch", "central"]);
});
