import assert from "node:assert/strict";
import test from "node:test";
import { adminPathToState, adminNavToPath } from "../src/app/routeState.js";
import { navGroups, getAdminPageTitle } from "../src/pages/admin/adminNavigation.js";
import { getAdminModuleAccessPolicy, filterAdminNavigationByAccess } from "../src/pages/admin/adminModuleAccessPolicy.js";

test("every settings entry opens its own page with the same title", () => {
  for (const item of navGroups.flatMap((group) => group.items || []).filter((entry) => entry.section === "store")) {
    const state = adminPathToState(adminNavToPath(item));
    assert.equal(state.activeAdminNav, item.id);
    assert.equal(state.activeSubSection, item.sub);
    assert.equal(getAdminPageTitle(state.section, item.id), item.label);
  }
  assert.equal(adminPathToState("/admin/settings/shipping").activeSubSection, "shipping");
  assert.equal(adminPathToState("/admin/settings/kitchen").activeSubSection, "kitchen");
  assert.equal(adminPathToState("/admin/settings/grab").activeSubSection, "grab");
});

test("new global settings do not become available to branch or warehouse accounts", () => {
  for (const adminProfile of [
    { role: "admin", branch_uuid: "branch-fixture" },
    { role: "staff", branch_uuid: "branch-fixture" },
    { role: "kitchen", branch_uuid: "branch-fixture" },
    { role: "staff", metadata: { account_scope: "central_inventory" } }
  ]) {
    const policy = getAdminModuleAccessPolicy({ adminProfile, isSupabaseAdminMode: true });
    const entries = filterAdminNavigationByAccess(navGroups, policy).flatMap((group) => group.items || []);
    assert.equal(entries.some((item) => item.section === "store"), false);
  }
});
