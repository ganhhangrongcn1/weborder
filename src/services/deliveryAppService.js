const DEFAULT_DELIVERY_APPS = [
  { id: "grab", name: "GrabFood", active: true, url: "" },
  { id: "shopee", name: "ShopeeFood", active: true, url: "" },
  { id: "xanh-ngon", name: "Xanh Ngon", active: true, url: "" }
];

function getBranchRawKey(branch, index) {
  return String(branch?.id || branch?.name || `branch-${index}`);
}
export function normalizeDeliveryAppUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getDeliveryAppBrand(app) {
  const value = `${app?.id || ""} ${app?.name || ""}`.toLowerCase();
  if (value.includes("grab")) return { className: "grab", label: "GrabFood" };
  if (value.includes("shopee")) return { className: "shopee", label: "ShopeeFood" };
  if (value.includes("xanh")) return { className: "xanh", label: "Xanh Ngon" };
  return { className: "default", label: app?.name || "Ứng dụng" };
}

export function buildDeliveryAppBranches(deliveryAppsBlock, branches = []) {
  const sourceBranches = Array.isArray(branches) ? branches : [];
  const savedBranchApps = Array.isArray(deliveryAppsBlock?.branchApps) ? deliveryAppsBlock.branchApps : [];
  const rawKeyCounts = sourceBranches.reduce((counts, branch, index) => {
    const rawKey = getBranchRawKey(branch, index);
    counts[rawKey] = (counts[rawKey] || 0) + 1;
    return counts;
  }, {});

  return sourceBranches.map((branch, index) => {
    const rawKey = getBranchRawKey(branch, index);
    const branchId = `${rawKey}::${index}`;
    const savedBranch =
      savedBranchApps.find((item) => String(item?.branchId || "") === branchId) ||
      (rawKeyCounts[rawKey] === 1 || index === 0
        ? savedBranchApps.find((item) => String(item?.branchId || "") === rawKey)
        : null) ||
      {};
    const savedApps = Array.isArray(savedBranch.apps) ? savedBranch.apps : [];

    return {
      branchId,
      branchSourceId: rawKey,
      branchName: branch?.name || savedBranch.branchName || "Chi nhánh",
      branchAddress: branch?.address || "",
      apps: DEFAULT_DELIVERY_APPS.map((app) => {
        const savedApp = savedApps.find((item) => String(item?.id || "") === app.id || String(item?.name || "") === app.name);
        return {
          ...app,
          ...savedApp,
          id: app.id,
          name: savedApp?.name || app.name,
          active: savedApp?.active !== false,
          url: normalizeDeliveryAppUrl(savedApp?.url || "")
        };
      }).filter((app) => app.active !== false)
    };
  });
}
