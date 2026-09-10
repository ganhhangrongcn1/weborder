import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { normalizeSalesDeductionSetting, canRetrySalesDeduction } from "../src/services/inventorySalesDeductionService.js";
import { adminPathToState } from "../src/app/routeState.js";
import { getAdminModuleAccessPolicy } from "../src/pages/admin/adminModuleAccessPolicy.js";
import { INVENTORY_ROUTE_ITEMS, INVENTORY_NAV_SECTIONS } from "../src/pages/admin/inventory/inventoryNavigation.js";

const sql = readFileSync(new URL("../supabase/migrations/20260910001326_inventory_sales_deduction_switch.sql", import.meta.url), "utf8");
test("chưa có cấu hình không được coi là đang bật", () => {
  assert.equal(normalizeSalesDeductionSetting().enabled, false);
  assert.equal(normalizeSalesDeductionSetting({ enabled: "false" }).enabled, false);
  assert.equal(normalizeSalesDeductionSetting({ enabled: true, enabled_from: "2026-09-10T01:00:00Z" }).enabled, true);
});
test("đơn bỏ qua do công tắc không có thao tác thử trừ lại", () => {
  for (const processingStatus of ["blocked", "ignored", "completed", "pending"]) {
    assert.equal(canRetrySalesDeduction({ processingStatus, deductionExcluded: true }), false);
  }
  assert.equal(canRetrySalesDeduction({ processingStatus: "blocked" }), true);
  assert.equal(canRetrySalesDeduction({ processingStatus: "ignored" }), true);
  assert.equal(canRetrySalesDeduction({ processingStatus: "completed" }), false);
});
test("route và menu cài đặt chỉ bổ sung vào quản lý toàn hệ thống/Kho Tổng", () => {
  assert.equal(adminPathToState("/admin/inventory/settings").inventoryPage, "settings");
  assert.ok(INVENTORY_ROUTE_ITEMS.some((row) => row.page === "settings"));
  assert.ok(INVENTORY_NAV_SECTIONS.some((row) => row.items.some((item) => item.page === "settings")));
  const central = getAdminModuleAccessPolicy({ isSupabaseAdminMode: true, adminProfile: { role: "staff", metadata: { account_scope: "central_inventory" } } });
  const branch = getAdminModuleAccessPolicy({ isSupabaseAdminMode: true, adminProfile: { role: "admin", branch_uuid: "branch" } });
  assert.ok(central.allowedItemIds.has("inventory-settings"));
  assert.ok(!branch.allowedItemIds.has("inventory-settings"));
  for (const id of ["inventory-transfers", "inventory-counts", "inventory-disposals", "inventory-production-orders"]) assert.ok(branch.allowedItemIds.has(id));
});
test("migration giữ chốt ở queue, worker, retry và không thay hàm phiếu kho", () => {
  assert.match(sql, /default false/);
  assert.equal((sql.match(/perform private.inventory_exclude_disabled_sale\(v_event_id\)/g) || []).length, 1);
  assert.equal((sql.match(/if private.inventory_exclude_disabled_sale\(p_event_id\)/g) || []).length, 2);
  assert.match(sql, /v_started_at < v_setting.enabled_from/);
  assert.match(sql, /v_event.created_at < v_setting.enabled_from/);
  assert.match(sql, /v_event.event_type <> 'sale' or v_event.processing_status = 'completed'/);
  assert.match(sql, /sales_deduction_excluded/);
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION (public|private)\.inventory_(complete_document|complete_count|complete_production|approve_transfer)/i);
  assert.match(sql, /security invoker set search_path = ''/);
  assert.match(sql, /Cài đặt đã thay đổi/);
});
