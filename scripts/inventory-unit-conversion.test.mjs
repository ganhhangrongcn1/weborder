import test from "node:test";
import assert from "node:assert/strict";
import {
  convertInventoryQuantityFromBase,
  convertInventoryQuantityToBase
} from "../src/services/inventoryUnitConversion.js";
import { normalizeInventoryMasterDataInput } from "../src/services/inventoryMasterDataService.js";
import {
  buildInventoryStockReportRows,
  calculateInventoryStockReportSummary,
  countInventoryStockAttention,
  getInventoryStockPurchaseValues
} from "../src/services/inventoryStockReportCalculations.js";

test("quy đổi cấu hình tồn từ Bịch sang Cái", () => {
  assert.equal(convertInventoryQuantityToBase(6, 200), 1200);
});

test("mở sửa hiển thị lại đúng đơn vị mua nhập", () => {
  assert.equal(convertInventoryQuantityFromBase(1200, 200), 6);
});

test("quy đổi hai chiều không làm sai số lượng", () => {
  const baseQuantity = convertInventoryQuantityToBase(2.5, 200);
  assert.equal(convertInventoryQuantityFromBase(baseQuantity, 200), 2.5);
});

test("service luôn lưu đơn vị tính dưới dạng đơn vị gốc", () => {
  const payload = normalizeInventoryMasterDataInput("units", {
    name: "Kilogram",
    symbol: "Kg",
    baseUnitId: "unit-gram",
    conversionFactor: 1000
  });

  assert.equal(payload.base_unit_id, null);
  assert.equal(payload.conversion_factor, 1);
});

test("service lưu bốn mức tồn theo đơn vị gốc", () => {
  const payload = normalizeInventoryMasterDataInput("items", {
    name: "Bánh Tráng Đỏ",
    baseUnitId: "unit-cai",
    purchaseUnitId: "unit-bich",
    purchaseToBaseRatio: 200,
    stockSettingsUnit: "purchase",
    reorderPoint: 6,
    orderQuantity: 24,
    minimumStock: 8,
    maximumStock: 32
  });

  assert.equal(payload.reorder_point, 1200);
  assert.equal(payload.metadata.order_quantity, 4800);
  assert.equal(payload.minimum_stock, 1600);
  assert.equal(payload.metadata.maximum_stock, 6400);
});

test("báo cáo ưu tiên số lượng và giá vốn theo đơn vị mua nhập", () => {
  const unitsById = new Map([
    ["unit-cai", { id: "unit-cai", name: "Cái", symbol: "Cái" }],
    ["unit-bich", { id: "unit-bich", name: "Bịch", symbol: "Bịch" }]
  ]);
  const values = getInventoryStockPurchaseValues(
    { quantity: 1800, averageCost: 10 },
    {
      baseUnitId: "unit-cai",
      purchaseUnitId: "unit-bich",
      purchaseToBaseRatio: 200
    },
    unitsById
  );

  assert.equal(values.quantity, 9);
  assert.equal(values.averageCost, 2000);
  assert.equal(values.totalValue, 18000);
  assert.equal(values.unitName, "Bịch");
});

test("badge tồn kho chỉ đếm sắp hết và hết hàng", () => {
  const itemsById = new Map([
    ["available", { reorderPoint: 5 }],
    ["low", { reorderPoint: 5 }],
    ["out", { reorderPoint: 5 }]
  ]);
  assert.equal(countInventoryStockAttention([
    { itemId: "available", quantity: 8 },
    { itemId: "low", quantity: 5 },
    { itemId: "out", quantity: 0 }
  ], itemsById), 2);
});

test("báo cáo dựng đủ mã chưa có số dư cho từng kho được áp dụng", () => {
  const rows = buildInventoryStockReportRows(
    [{ warehouseId: "central", itemId: "shared", quantity: 12, averageCost: 5 }],
    [{ id: "central", isActive: true }, { id: "branch", isActive: true }],
    [
      { id: "shared", isActive: true, warehouseIds: [] },
      { id: "central-only", isActive: true, warehouseIds: ["central"] }
    ]
  );

  assert.equal(rows.length, 3);
  assert.equal(rows.find((row) => row.warehouseId === "central" && row.itemId === "shared").quantity, 12);
  assert.equal(rows.find((row) => row.warehouseId === "central" && row.itemId === "central-only").quantity, 0);
  assert.equal(rows.find((row) => row.warehouseId === "branch" && row.itemId === "shared").quantity, 0);
  assert.equal(rows.some((row) => row.warehouseId === "branch" && row.itemId === "central-only"), false);
});

test("mặt hàng sắp hết nhưng còn số lượng vẫn được tính là có tồn", () => {
  const itemsById = new Map([["low", { reorderPoint: 10 }]]);
  const summary = calculateInventoryStockReportSummary([
    { itemId: "low", quantity: 5, averageCost: 2 }
  ], itemsById);

  assert.equal(summary.availableCount, 1);
  assert.equal(summary.lowCount, 1);
  assert.equal(summary.outCount, 0);
});

test("badge tồn kho thay đổi theo kho đang lọc", () => {
  const warehouses = [{ id: "central" }, { id: "branch" }];
  const items = [
    { id: "shared", reorderPoint: 5, warehouseIds: [] },
    { id: "central-only", reorderPoint: 5, warehouseIds: ["central"] },
    { id: "branch-only", reorderPoint: 5, warehouseIds: ["branch"] }
  ];
  const persistedRows = [
    { warehouseId: "central", itemId: "shared", quantity: 10 },
    { warehouseId: "branch", itemId: "shared", quantity: 0 }
  ];
  const itemById = new Map(items.map((item) => [item.id, item]));
  const centralRows = buildInventoryStockReportRows(persistedRows, [warehouses[0]], items);
  const branchRows = buildInventoryStockReportRows(persistedRows, [warehouses[1]], items);

  assert.equal(countInventoryStockAttention(centralRows, itemById), 1);
  assert.equal(countInventoryStockAttention(branchRows, itemById), 2);
  assert.equal(countInventoryStockAttention([...centralRows, ...branchRows], itemById), 3);
});
