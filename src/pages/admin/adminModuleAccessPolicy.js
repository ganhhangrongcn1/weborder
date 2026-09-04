function toText(value = "") {
  return String(value || "").trim();
}

function keepOnlyNavigation(groups = [], allowedItemIds = new Set()) {
  return groups
    .map((group) => {
      const standaloneItems = (group.standaloneItems || []).filter((item) => allowedItemIds.has(item.id));
      const subgroups = (group.subgroups || [])
        .map((subgroup) => ({
          ...subgroup,
          items: (subgroup.items || []).filter((item) => allowedItemIds.has(item.id))
        }))
        .filter((subgroup) => subgroup.items.length > 0);
      const items = (group.items || []).filter((item) => allowedItemIds.has(item.id));

      return {
        ...group,
        standaloneItems,
        subgroups,
        items
      };
    })
    .filter((group) => group.items.length > 0 || group.standaloneItems.length > 0 || group.subgroups.length > 0);
}

export function getAdminModuleAccessPolicy({
  adminProfile = null,
  isSupabaseAdminMode = false
} = {}) {
  if (!isSupabaseAdminMode) {
    return { mode: "full", allowedItemIds: null };
  }

  const role = toText(adminProfile?.role).toLowerCase();
  const branchUuid = toText(adminProfile?.branchUuid || adminProfile?.branch_uuid);
  const accountScope = toText(adminProfile?.metadata?.account_scope || adminProfile?.accountScope).toLowerCase();

  if (role === "admin" && !branchUuid) {
    return { mode: "full", allowedItemIds: null };
  }

  if (branchUuid && ["admin", "staff", "kitchen"].includes(role)) {
    return {
      mode: "branch-operations",
      allowedItemIds: new Set(["shifts-main", "inventory-dashboard", ...BRANCH_INVENTORY_ITEM_IDS])
    };
  }

  if (role === "staff" && !branchUuid && accountScope === "central_inventory") {
    return {
      mode: "central-inventory",
      allowedItemIds: new Set(["inventory-dashboard", ...INVENTORY_ITEM_IDS])
    };
  }

  return { mode: "blocked", allowedItemIds: new Set() };
}

const INVENTORY_ITEM_IDS = [
  "inventory-warehouses",
  "inventory-items",
  "inventory-item-categories",
  "inventory-units",
  "inventory-suppliers",
  "inventory-purchase-prices",
  "inventory-opening-balances",
  "inventory-receipts",
  "inventory-issues",
  "inventory-transfers",
  "inventory-requisitions",
  "inventory-disposals",
  "inventory-counts",
  "inventory-adjustments",
  "inventory-reconciliation",
  "inventory-reports",
  "inventory-lots",
  "inventory-alerts",
  "inventory-cost-analysis",
  "inventory-ledger",
  "inventory-stock-flow",
  "inventory-boms",
  "inventory-production-orders",
  "inventory-sales-recipes"
];

const BRANCH_INVENTORY_ITEM_IDS = [
  "inventory-transfers",
  "inventory-requisitions",
  "inventory-disposals",
  "inventory-counts",
  "inventory-reports",
  "inventory-lots",
  "inventory-alerts",
  "inventory-production-orders"
];

export function filterAdminNavigationByAccess(groups = [], accessPolicy = {}) {
  if (accessPolicy.mode === "full") return groups;
  return keepOnlyNavigation(groups, accessPolicy.allowedItemIds || new Set());
}

export function getFirstAdminNavigationItem(groups = []) {
  for (const group of groups) {
    if (group.standaloneItems?.length) return group.standaloneItems[0];
    for (const subgroup of group.subgroups || []) {
      if (subgroup.items?.length) return subgroup.items[0];
    }
    if (group.items?.length) return group.items[0];
  }
  return null;
}
