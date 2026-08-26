import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBomComponentRequirement,
  hasInventoryBomCycle,
  normalizeInventoryBomDraft
} from "../src/services/inventoryBomCalculations.js";
import { getInventoryCompatibleUnits } from "../src/services/inventoryUnitConversion.js";
import {
  getInventoryProductionExpiryConfig,
  getInventoryProductionScopeMeta,
  normalizeInventoryProductionOrder
} from "../src/services/inventoryProductionService.js";
import { adminPathToState } from "../src/app/routeState.js";
import { INVENTORY_NAV_SECTIONS, getInventoryRoute } from "../src/pages/admin/inventory/inventoryNavigation.js";

const units = [
  { id: "gram", name: "Gram", isActive: true },
  { id: "kg", name: "Kilôgam", baseUnitId: "gram", conversionFactor: 1000, isActive: true },
  { id: "ml", name: "Mililít", isActive: true }
];

const items = [
  { id: "raw-spice", code: "NVL_1", name: "Gia vị", itemType: "raw_material", baseUnitId: "gram", purchaseUnitId: "kg", purchaseToBaseRatio: 1000, isActive: true },
  { id: "pack", code: "BTP_1", name: "Gói bánh tráng gia vị", itemType: "semi_finished", baseUnitId: "gram", purchaseUnitId: "kg", purchaseToBaseRatio: 1000, isActive: true },
  { id: "dish-kit", code: "BTP_2", name: "Bộ bánh tráng trộn", itemType: "semi_finished", baseUnitId: "gram", purchaseUnitId: "kg", purchaseToBaseRatio: 1000, isActive: true }
];

const warehouses = [
  { id: "central", name: "Kho Tổng", warehouseType: "central", isActive: true },
  { id: "branch", name: "Kho CN 30/4", warehouseType: "branch", isActive: true },
  { id: "branch-2", name: "Kho CN LHP", warehouseType: "branch", isActive: true },
  { id: "branch-off", name: "Kho CN cũ", warehouseType: "branch", isActive: false }
];

test("gợi ý HSD đầu ra theo thiết lập bán thành phẩm", () => {
  const config = getInventoryProductionExpiryConfig({
    metadata: { track_expiry: true, shelf_life_days: 7 }
  }, new Date("2026-08-25T12:00:00+07:00"));

  assert.equal(config.trackExpiry, true);
  assert.equal(config.manufacturedOn, "2026-08-25");
  assert.equal(config.suggestedExpiresOn, "2026-09-01");
});

test("không yêu cầu HSD khi bán thành phẩm không theo dõi hạn", () => {
  const config = getInventoryProductionExpiryConfig({ metadata: {} }, new Date("2026-08-25T12:00:00+07:00"));
  assert.equal(config.trackExpiry, false);
  assert.equal(config.suggestedExpiresOn, "");
});

test("chỉ trả về đơn vị cùng hệ quy đổi", () => {
  assert.deepEqual(
    getInventoryCompatibleUnits(items[0], units).map((unit) => unit.id),
    ["gram", "kg"]
  );
});

test("tính lượng cần chuẩn bị gồm hao hụt", () => {
  assert.deepEqual(
    calculateBomComponentRequirement({ quantity: 2, wastePercent: 5, conversionToBase: 1000 }),
    { netBaseQuantity: 2000, grossBaseQuantity: 2100, wasteBaseQuantity: 100 }
  );
});

test("chuẩn hóa BOM nhiều cấp hợp lệ và giữ hệ số quy đổi", () => {
  const draft = normalizeInventoryBomDraft({
    outputItemId: "dish-kit",
    yieldQuantity: 1,
    yieldUnitId: "kg",
    productionScope: "branch",
    defaultWarehouseId: "branch",
    components: [
      { componentItemId: "pack", quantity: 0.5, unitId: "kg", wastePercent: 2 }
    ]
  }, { items, units, warehouses, boms: [] });

  assert.equal(draft.components[0].conversionToBase, 1000);
  assert.equal(draft.components[0].wastePercent, 2);
  assert.equal(draft.productionScope, "branch");
});

test("chặn BOM dùng chính đầu ra làm thành phần", () => {
  assert.throws(() => normalizeInventoryBomDraft({
    outputItemId: "pack",
    yieldQuantity: 1,
    yieldUnitId: "kg",
    defaultWarehouseId: "central",
    components: [{ componentItemId: "pack", quantity: 1, unitId: "kg" }]
  }, { items, units, warehouses }), /không thể dùng chính nó/i);
});

test("chặn một nguyên liệu xuất hiện hai lần", () => {
  assert.throws(() => normalizeInventoryBomDraft({
    outputItemId: "pack",
    yieldQuantity: 1,
    yieldUnitId: "kg",
    defaultWarehouseId: "central",
    components: [
      { componentItemId: "raw-spice", quantity: 1, unitId: "kg" },
      { componentItemId: "raw-spice", quantity: 100, unitId: "gram" }
    ]
  }, { items, units, warehouses }), /chỉ được xuất hiện một lần/i);
});

test("chặn vòng lặp giữa hai bán thành phẩm", () => {
  const boms = [{
    id: "bom-pack",
    outputItemId: "pack",
    components: [{ componentItemId: "dish-kit" }]
  }];
  assert.equal(hasInventoryBomCycle({
    outputItemId: "dish-kit",
    componentItemIds: ["pack"],
    boms
  }), true);
});

test("chặn đơn vị khác hệ tồn kho", () => {
  assert.throws(() => normalizeInventoryBomDraft({
    outputItemId: "pack",
    yieldQuantity: 1,
    yieldUnitId: "kg",
    defaultWarehouseId: "central",
    components: [{ componentItemId: "raw-spice", quantity: 1, unitId: "ml" }]
  }, { items, units, warehouses }), /không cùng hệ quy đổi/i);
});

test("bắt buộc chọn kho thực hiện", () => {
  assert.throws(() => normalizeInventoryBomDraft({
    outputItemId: "pack",
    yieldQuantity: 1,
    yieldUnitId: "kg",
    components: [{ componentItemId: "raw-spice", quantity: 1, unitId: "kg" }]
  }, { items, units, warehouses }), /chọn Kho thực hiện/i);
});

test("chặn loại công thức không khớp loại kho", () => {
  assert.throws(() => normalizeInventoryBomDraft({
    outputItemId: "pack",
    yieldQuantity: 1,
    yieldUnitId: "kg",
    productionScope: "central",
    defaultWarehouseId: "branch",
    components: [{ componentItemId: "raw-spice", quantity: 1, unitId: "kg" }]
  }, { items, units, warehouses }), /không phù hợp/i);
});

test("route BOM và lệnh sản xuất đều mở thật", () => {
  assert.equal(adminPathToState("/admin/inventory/boms").inventoryPage, "boms");
  assert.equal(getInventoryRoute("boms").path, "/admin/inventory/boms");
  assert.equal(adminPathToState("/admin/inventory/production-orders").inventoryPage, "production-orders");
  assert.equal(getInventoryRoute("production-orders").path, "/admin/inventory/production-orders");
  const productionItems = INVENTORY_NAV_SECTIONS.find((section) => section.title === "Sản xuất & chế biến")?.items || [];
  assert.equal(productionItems.some((item) => item.page === "boms" && !item.disabled), true);
  assert.equal(productionItems.some((item) => item.page === "production-orders" && !item.disabled), true);
});

test("phân biệt đúng lệnh sản xuất Kho Tổng và lệnh sơ chế chi nhánh", () => {
  assert.equal(getInventoryProductionScopeMeta("central").title, "Lệnh sản xuất");
  assert.equal(getInventoryProductionScopeMeta("branch").title, "Lệnh sơ chế");
  assert.equal(getInventoryProductionScopeMeta("department").warehouseLabel, "Kho sơ chế");

  const order = normalizeInventoryProductionOrder({
    id: "order-1",
    bom: { production_scope: "branch" }
  });
  assert.equal(order.productionScope, "branch");
});

test("công thức sơ chế chi nhánh dùng chung không cần gắn kho", () => {
  const draft = normalizeInventoryBomDraft({
    outputItemId: "pack",
    yieldQuantity: 1,
    yieldUnitId: "kg",
    productionScope: "branch",
    defaultWarehouseId: "",
    components: [{ componentItemId: "raw-spice", quantity: 1, unitId: "kg" }]
  }, { items, units, warehouses });

  assert.equal(draft.productionScope, "branch");
  assert.equal(draft.defaultWarehouseId, "");
});

test("công thức Kho Tổng vẫn bắt buộc chọn kho", () => {
  assert.throws(() => normalizeInventoryBomDraft({
    outputItemId: "pack",
    yieldQuantity: 1,
    yieldUnitId: "kg",
    productionScope: "central",
    defaultWarehouseId: "",
    components: [{ componentItemId: "raw-spice", quantity: 1, unitId: "kg" }]
  }, { items, units, warehouses }), /chọn Kho thực hiện/i);
});
