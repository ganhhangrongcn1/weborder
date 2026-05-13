export function normalizePath(pathname = "/") {
  if (!pathname) return "/";
  const clean = pathname.replace(/\/+$/, "");
  return clean || "/";
}

export function customerPathToState(pathname = "/") {
  const path = normalizePath(pathname);

  if (path === "/menu") return { page: "menu", activeTab: "menu" };
  if (path === "/cart") return { page: "checkout", activeTab: "orders" };
  if (path === "/checkout") return { page: "checkout", activeTab: "orders" };
  if (path === "/success") return { page: "success", activeTab: "orders" };
  if (path === "/profile") return { page: "account", activeTab: "account" };
  if (path === "/orders") return { page: "tracking", activeTab: "orders" };
  if (path === "/loyalty") return { page: "loyalty", activeTab: "rewards" };
  if (path === "/home" || path === "/") return { page: "home", activeTab: "home" };

  return { page: "home", activeTab: "home" };
}

export function customerPageToPath(nextPage = "home", nextTab = "home") {
  if (nextPage === "home") return "/home";
  if (nextPage === "menu" || nextPage === "detail") return "/menu";
  if (nextPage === "checkout") return "/checkout";
  if (nextPage === "success") return "/success";
  if (nextPage === "tracking") return "/orders";
  if (nextPage === "loyalty") return "/loyalty";
  if (nextPage === "account") return "/profile";

  if (nextTab === "menu") return "/menu";
  if (nextTab === "orders") return "/cart";
  if (nextTab === "account") return "/profile";
  if (nextTab === "rewards") return "/loyalty";

  return "/home";
}

export function bottomTabToPath(tab) {
  if (tab === "home") return "/home";
  if (tab === "menu") return "/menu";
  if (tab === "orders") return "/orders";
  if (tab === "account") return "/profile";
  if (tab === "rewards") return "/loyalty";
  return "/home";
}

export function adminPathToState(pathname = "/admin") {
  const path = normalizePath(pathname);

  if (path === "/admin/menu") {
    return {
      section: "menu",
      activeAdminNav: "menu-main"
    };
  }
  if (path === "/admin/orders") {
    return {
      section: "orders",
      activeAdminNav: "orders-main"
    };
  }
  if (path === "/admin/customers") {
    return {
      section: "customers",
      activeAdminNav: "customer-main",
      customerAdminTab: "crm"
    };
  }
  if (path === "/admin/loyalty") {
    return {
      section: "customers",
      activeAdminNav: "customer-main",
      customerAdminTab: "loyalty"
    };
  }
  if (path === "/admin/settings") {
    return {
      section: "store",
      activeAdminNav: "store-branches",
      activeSubSection: "branches"
    };
  }
  if (path === "/admin/settings/zalo") {
    return {
      section: "store",
      activeAdminNav: "store-zalo",
      activeSubSection: "zalo"
    };
  }
  if (path === "/admin/settings/shipping") {
    return {
      section: "store",
      activeAdminNav: "store-branches",
      activeSubSection: "branches"
    };
  }
  if (path === "/admin/ui") {
    return {
      section: "promo",
      activeAdminNav: "store-ui",
      activeSubSection: "ui"
    };
  }
  if (path === "/admin/promotions") {
    return {
      section: "promo",
      activeAdminNav: "promo-campaign",
      activeSubSection: "campaign"
    };
  }

  return {
    section: "dashboard",
    activeAdminNav: "dashboard-main"
  };
}

export function adminNavToPath(item) {
  if (!item) return "/admin";

  if (item.id === "dashboard-main") return "/admin";
  if (item.id === "orders-main") return "/admin/orders";
  if (item.id === "customer-main") return "/admin/customers";
  if (item.id === "menu-main") return "/admin/menu";
  if (item.id === "store-branches") return "/admin/settings";
  if (item.id === "store-zalo") return "/admin/settings/zalo";
  if (item.id === "store-ui") return "/admin/ui";
  if (item.id === "promo-campaign") return "/admin/promotions";

  return "/admin";
}
