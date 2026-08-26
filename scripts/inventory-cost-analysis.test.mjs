import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInventoryProductionVarianceRows,
  buildInventorySalesCostRows,
  calculateInventoryCostAnalysisSummary
} from "../src/services/inventoryCostAnalysisCalculations.js";
import { canViewInventoryCostAnalysis } from "../src/services/inventoryCostAnalysisService.js";
import { adminPathToState } from "../src/app/routeState.js";
import { getInventoryRoute } from "../src/pages/admin/inventory/inventoryNavigation.js";

test("giá vốn đơn bán lấy đúng đơn giá movement tại lúc trừ kho", () => {
  const rows = buildInventorySalesCostRows({
    events: [{
      id: "event-1",
      sourceOrderKey: "ORDER-1",
      documentId: "document-1",
      occurredAt: "2026-08-26T10:00:00Z",
      lines: [
        { id: "line-1", sourceLineKey: "dish-1", sourceLineName: "Bánh tráng trộn", recipeId: "recipe-1", itemId: "item-1", requiredQuantity: 2, lineStatus: "ready" },
        { id: "line-2", sourceLineKey: "dish-1", sourceLineName: "Bánh tráng trộn", recipeId: "recipe-1", itemId: "item-2", requiredQuantity: 50, lineStatus: "ready" }
      ]
    }],
    movements: [
      { id: "move-1", documentId: "document-1", itemId: "item-1", direction: "out", quantity: 2, unitCost: 500 },
      { id: "move-2", documentId: "document-1", itemId: "item-2", direction: "out", quantity: 50, unitCost: 40 }
    ],
    recipes: [{ id: "recipe-1", code: "DLM-000001", version: 2 }]
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].actualCost, 3000);
  assert.equal(rows[0].traceComplete, true);
  assert.deepEqual(rows[0].recipeVersions, ["DLM-000001 · v2"]);
});

test("không nhận nhầm movement nhập kho vào giá vốn bán", () => {
  const [row] = buildInventorySalesCostRows({
    events: [{ id: "event-1", documentId: "document-1", lines: [{ id: "line-1", recipeId: "recipe-1", itemId: "item-1", requiredQuantity: 1 }] }],
    movements: [{ id: "move-1", documentId: "document-1", itemId: "item-1", direction: "in", quantity: 1, unitCost: 999 }],
    recipes: [{ id: "recipe-1", code: "DLM-1", version: 1 }]
  });
  assert.equal(row.actualCost, 0);
  assert.equal(row.traceComplete, false);
});

test("sai lệch sản xuất bằng cost thực tế trừ cost định mức", () => {
  const [row] = buildInventoryProductionVarianceRows([{
    id: "production-1",
    status: "completed",
    estimatedTotalCost: 10000,
    actualTotalCost: 11250,
    lines: [{ plannedBaseQuantity: 10, actualBaseQuantity: 11 }]
  }]);
  assert.equal(row.variance, 1250);
  assert.equal(row.varianceRate, 12.5);
  assert.equal(row.inputVariance, 1);
});

test("tổng hợp giá vốn không trộn với giá trị tồn hiện tại", () => {
  const summary = calculateInventoryCostAnalysisSummary({
    salesRows: [{ actualCost: 3000, traceComplete: true }, { actualCost: 2000, traceComplete: false }],
    productionRows: [{ variance: 500 }, { variance: -100 }]
  });
  assert.deepEqual(summary, {
    salesOrderCount: 2,
    salesCost: 5000,
    traceCompleteCount: 1,
    productionOrderCount: 2,
    productionVariance: 400
  });
});

test("route Giá vốn và đối chiếu mở đúng trong Admin", () => {
  assert.equal(adminPathToState("/admin/inventory/cost-analysis").inventoryPage, "cost-analysis");
  assert.equal(getInventoryRoute("cost-analysis").path, "/admin/inventory/cost-analysis");
});

test("chỉ Admin toàn hệ thống và Quản lý Kho Tổng được xem giá vốn", () => {
  assert.equal(canViewInventoryCostAnalysis({
    profile: { role: "admin", status: "active", branchUuid: "" }
  }), true);
  assert.equal(canViewInventoryCostAnalysis({
    profile: { role: "admin", status: "active", branchUuid: "branch-30-4" }
  }), false);
  assert.equal(canViewInventoryCostAnalysis({
    profile: { role: "staff", status: "active", branchUuid: "" },
    inventoryRoles: ["central_manager"]
  }), true);
  assert.equal(canViewInventoryCostAnalysis({
    profile: { role: "staff", status: "active", branchUuid: "branch-30-4" },
    inventoryRoles: ["branch_manager"]
  }), false);
});
