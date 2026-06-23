import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message);
  }
}

function runCustomerFlowSmoke() {
  const app = read("src/App.jsx");
  const appRoutes = read("src/app/routes.jsx");
  const customerAppShell = read("src/features/app/CustomerAppShell.jsx");
  const shell = read("src/features/customer/product/CustomerShell.jsx");

  assertIncludes(app, "AppProviders", "App is missing provider flow");
  assertIncludes(app, "AppRoutes", "App is missing routes flow");
  assertIncludes(appRoutes, "AppCustomerRoutes", "AppRoutes is missing customer routing flow");
  assertIncludes(appRoutes, "AppAdminRoutes", "AppRoutes is missing admin routing flow");
  assertIncludes(customerAppShell, "createCustomerShellProps", "CustomerAppShell is missing shell flow builder");
  assertIncludes(customerAppShell, "CustomerShell", "CustomerAppShell is missing customer shell flow");
  assertIncludes(shell, 'page === "home"', "CustomerShell is missing Home flow");
  assertIncludes(shell, 'page === "menu"', "CustomerShell is missing Menu flow");
  assertIncludes(shell, 'page === "checkout"', "CustomerShell is missing Checkout flow");
  assertIncludes(shell, 'page === "tracking"', "CustomerShell is missing Tracking flow");
  assertIncludes(shell, 'page === "loyalty"', "CustomerShell is missing Loyalty flow");
  assertIncludes(shell, 'page === "account"', "CustomerShell is missing Account flow");
  assertIncludes(shell, "CustomerShell", "CustomerShell export missing");
}

function runAdminFlowSmoke() {
  const adminApp = read("src/pages/admin/AdminApp.jsx");
  const adminSidebar = read("src/pages/admin/AdminSidebar.jsx");

  assertIncludes(adminApp, "AdminSidebar", "Admin flow missing sidebar component");
  assertIncludes(adminSidebar, 'className="admin-sidebar"', "Admin sidebar layout missing");
  assertIncludes(adminApp, "activeAdminNav", "Admin flow missing active nav state");
  assertIncludes(adminApp, "openAdminNav", "Admin flow missing nav open handler");
  assertIncludes(adminApp, "navGroups", "Admin flow missing nav groups");
}

function runBranchIdentitySmoke() {
  const checkoutDomain = read("src/features/checkout/checkoutDomain.js");
  const branchSettings = read("src/pages/admin/store/BranchSettings.jsx");
  const catalogRepository = read("src/services/repositories/catalogSupabaseRepository.js");
  const kitchenOrderService = read("src/services/kitchenOrderService.js");
  const qrOrderEntryPage = read("src/pages/customer/qr/QrOrderEntryPage.jsx");
  const printJobService = read("src/services/printJobService.js");
  const migration = read("supabase/migrations/20260622235452_branch_identity_contract.sql");

  assertIncludes(checkoutDomain, "branchUuid: branch.branchUuid || branch.branch_uuid || branch.uuid", "Pickup branch flow must preserve branch UUID");
  assertIncludes(checkoutDomain, "branch_uuid: branch.branch_uuid || branch.branchUuid || branch.uuid", "Pickup branch flow must preserve snake_case branch UUID");
  assertIncludes(branchSettings, "branch_uuid: createStableBranchUuid()", "Admin new branch must create a stable branch UUID");
  assertIncludes(catalogRepository, "matched?.branch_uuid || createStableBranchUuid()", "Branch repository must fill UUID for new branches");
  assertIncludes(kitchenOrderService, "options.strictBranchUuidQuery", "Kitchen website order read must keep legacy fallback by default");
  assertIncludes(qrOrderEntryPage, "branch?.branch_uuid || branch?.branchUuid || branch?.uuid || branch?.id", "QR counter flow must prefer branch UUID");
  assertIncludes(printJobService, "branch?.branch_uuid || branch?.branchUuid || branch?.uuid || options.branchUuid || branch?.id", "POS QR print job must prefer branch UUID");
  assertIncludes(migration, "alter column branch_uuid set default gen_random_uuid()", "Branch migration must default branch_uuid");
}

function run() {
  runCustomerFlowSmoke();
  runAdminFlowSmoke();
  runBranchIdentitySmoke();
  console.log("Main flow smoke test passed (customer + admin + branch identity).");
}

try {
  run();
} catch (error) {
  console.error("Main flow smoke test failed:", error.message);
  process.exit(1);
}
