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

function run() {
  runCustomerFlowSmoke();
  runAdminFlowSmoke();
  console.log("Main flow smoke test passed (customer + admin).");
}

try {
  run();
} catch (error) {
  console.error("Main flow smoke test failed:", error.message);
  process.exit(1);
}
