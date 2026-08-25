import assert from "node:assert/strict";
import test from "node:test";

import { adminPathToState } from "../src/app/routeState.js";
import { getInventoryAccessPolicy } from "../src/pages/admin/inventory/inventoryAccessPolicy.js";
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

test("staff without a branch and kitchen accounts are blocked", () => {
  const staffPolicy = getInventoryAccessPolicy({
    adminProfile: { role: "staff" },
    isSupabaseAdminMode: true,
    branches
  });
  const kitchenPolicy = getInventoryAccessPolicy({
    adminProfile: { role: "kitchen", branchUuid: branches[0].branch_uuid },
    isSupabaseAdminMode: true,
    branches
  });
  assert.equal(staffPolicy.allowed, false);
  assert.equal(kitchenPolicy.allowed, false);
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
