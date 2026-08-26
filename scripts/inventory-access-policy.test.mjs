import assert from "node:assert/strict";
import test from "node:test";

import { adminPathToState } from "../src/app/routeState.js";
import {
  getInventoryAccessPolicy,
  getInventoryScopedWarehouses
} from "../src/pages/admin/inventory/inventoryAccessPolicy.js";
import { getAdminModuleAccessPolicy } from "../src/pages/admin/adminModuleAccessPolicy.js";
import { canApproveInventoryDisposals } from "../src/services/inventoryDocumentService.js";

const branches = [
  { branch_uuid: "11111111-1111-4111-8111-111111111111", name: "Gánh Hàng Rong - Phú Hòa" },
  { branch_uuid: "22222222-2222-4222-8222-222222222222", name: "Gánh Hàng Rong - Hiệp Thành" }
];

test("local inventory mode remains available without production credentials", () => {
  const policy = getInventoryAccessPolicy({ branches });
  assert.equal(policy.allowed, true);
  assert.equal(policy.scope, "global");
  assert.equal(policy.branchSelectorLocked, false);
  assert.equal(policy.branchOptions.length, 2);
});

test("global admin can select every configured branch", () => {
  const policy = getInventoryAccessPolicy({
    adminProfile: { role: "admin", status: "active" },
    isSupabaseAdminMode: true,
    branches
  });
  assert.equal(policy.allowed, true);
  assert.equal(policy.scope, "global");
  assert.equal(policy.selectedBranchFilter, "all");
  assert.equal(policy.branchSelectorLocked, false);
  assert.equal(policy.canManageInventory, true);
});

test("branch-scoped staff only receives the assigned branch option", () => {
  const policy = getInventoryAccessPolicy({
    adminProfile: { role: "staff", branchUuid: branches[1].branch_uuid },
    isSupabaseAdminMode: true,
    branches
  });
  assert.equal(policy.allowed, true);
  assert.equal(policy.scope, "branch");
  assert.equal(policy.branchSelectorLocked, true);
  assert.equal(policy.branchOptions.length, 1);
  assert.equal(policy.branchOptions[0].value, branches[1].branch_uuid);
  assert.equal(policy.scopeLabel, branches[1].name);
  assert.equal(policy.canManageInventory, false);
});

test("branch-scoped inventory only exposes warehouses from the assigned branch", () => {
  const policy = getInventoryAccessPolicy({
    adminProfile: { role: "staff", branchUuid: branches[1].branch_uuid },
    isSupabaseAdminMode: true,
    branches
  });
  const warehouses = [
    { id: "warehouse-a", branchUuid: branches[0].branch_uuid, name: "Kho Phú Hòa" },
    { id: "warehouse-b", branchUuid: branches[1].branch_uuid, name: "Kho Hiệp Thành" },
    { id: "warehouse-central", branchUuid: "", name: "Kho Tổng" }
  ];

  assert.deepEqual(
    getInventoryScopedWarehouses(warehouses, policy).map((warehouse) => warehouse.id),
    ["warehouse-b"]
  );
});

test("global inventory keeps every warehouse option", () => {
  const policy = getInventoryAccessPolicy({
    adminProfile: { role: "admin" },
    isSupabaseAdminMode: true,
    branches
  });
  const warehouses = [
    { id: "warehouse-a", branchUuid: branches[0].branch_uuid },
    { id: "warehouse-b", branchUuid: branches[1].branch_uuid }
  ];

  assert.equal(getInventoryScopedWarehouses(warehouses, policy).length, 2);
});

test("branch-scoped admin is also locked to the assigned branch", () => {
  const policy = getInventoryAccessPolicy({
    adminProfile: { role: "admin", branch_uuid: branches[0].branch_uuid },
    isSupabaseAdminMode: true,
    branches
  });
  assert.equal(policy.allowed, true);
  assert.equal(policy.scope, "branch");
  assert.equal(policy.branchOptions.length, 1);
  assert.equal(policy.branchSelectorLocked, true);
});

test("central staff can manage all warehouses while branch kitchen stays in its branch", () => {
  const staffPolicy = getInventoryAccessPolicy({
    adminProfile: { role: "staff", metadata: { account_scope: "central_inventory" } },
    isSupabaseAdminMode: true,
    branches
  });
  const kitchenPolicy = getInventoryAccessPolicy({
    adminProfile: { role: "kitchen", branchUuid: branches[0].branch_uuid },
    isSupabaseAdminMode: true,
    branches
  });
  assert.equal(staffPolicy.allowed, true);
  assert.equal(staffPolicy.scope, "warehouse");
  assert.equal(staffPolicy.branchSelectorLocked, true);
  assert.equal(staffPolicy.canManageInventory, true);
  assert.equal(kitchenPolicy.allowed, true);
  assert.equal(kitchenPolicy.scope, "branch");
  assert.equal(kitchenPolicy.branchOptions.length, 1);
  assert.equal(kitchenPolicy.canManageInventory, false);
});

test("kitchen without an assigned branch remains blocked", () => {
  const policy = getInventoryAccessPolicy({
    adminProfile: { role: "kitchen" },
    isSupabaseAdminMode: true,
    branches
  });
  assert.equal(policy.allowed, false);
});

test("module menu separates branch operations from central inventory", () => {
  const branchPolicy = getAdminModuleAccessPolicy({
    adminProfile: { role: "kitchen", branch_uuid: branches[0].branch_uuid },
    isSupabaseAdminMode: true
  });
  const centralPolicy = getAdminModuleAccessPolicy({
    adminProfile: { role: "staff", metadata: { account_scope: "central_inventory" } },
    isSupabaseAdminMode: true
  });

  assert.equal(branchPolicy.mode, "branch-operations");
  assert.equal(branchPolicy.allowedItemIds.has("inventory-requisitions"), true);
  assert.equal(branchPolicy.allowedItemIds.has("inventory-items"), false);
  assert.equal(centralPolicy.mode, "central-inventory");
  assert.equal(centralPolicy.allowedItemIds.has("inventory-warehouses"), true);
  assert.equal(centralPolicy.allowedItemIds.has("shifts-main"), false);
});

test("unassigned staff without central inventory scope stays blocked", () => {
  const inventoryPolicy = getInventoryAccessPolicy({
    adminProfile: { role: "staff" },
    isSupabaseAdminMode: true,
    branches
  });
  const modulePolicy = getAdminModuleAccessPolicy({
    adminProfile: { role: "staff" },
    isSupabaseAdminMode: true
  });

  assert.equal(inventoryPolicy.allowed, false);
  assert.equal(inventoryPolicy.canManageInventory, false);
  assert.equal(modulePolicy.mode, "blocked");
});

test("unknown inventory child paths are marked for safe redirect", () => {
  const state = adminPathToState("/admin/inventory/khong-ton-tai");
  assert.equal(state.section, "inventory");
  assert.equal(state.inventoryPage, "dashboard");
  assert.equal(state.inventoryRouteInvalid, true);
});

test("disposals route opens the inventory disposal workspace", () => {
  const state = adminPathToState("/admin/inventory/disposals");
  assert.equal(state.section, "inventory");
  assert.equal(state.inventoryPage, "disposals");
  assert.equal(state.activeAdminNav, "inventory-disposals");
  assert.equal(state.inventoryRouteInvalid, false);
});

test("only central inventory roles can approve disposal documents", () => {
  assert.equal(canApproveInventoryDisposals(["admin"]), true);
  assert.equal(canApproveInventoryDisposals(["central_manager"]), true);
  assert.equal(canApproveInventoryDisposals(["owner"]), true);
  assert.equal(canApproveInventoryDisposals(["branch_manager"]), false);
  assert.equal(canApproveInventoryDisposals(["staff"]), false);
});
