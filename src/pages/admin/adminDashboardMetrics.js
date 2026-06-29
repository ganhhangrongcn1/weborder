export function computeAdminDashboardMetrics({ products, dashboardSummary, branches, toppings }) {
  const rpcMetrics = dashboardSummary?.source === "rpc" ? dashboardSummary.current : null;
  const activeProducts = products.filter((item) => item.visible !== false).length;
  const ordersTotal = rpcMetrics?.totalOrders ?? null;
  const ordersNew = rpcMetrics?.pendingOrders ?? null;
  const ordersDoing = rpcMetrics
    ? rpcMetrics.preparingOrders + rpcMetrics.deliveringOrders
    : null;
  const todayRevenue = rpcMetrics?.netRevenue ?? null;
  const totalCustomers = dashboardSummary?.source === "rpc" ? dashboardSummary.totalCustomers : null;
  const periodCustomers = dashboardSummary?.source === "rpc" ? dashboardSummary.periodCustomers : null;
  const openBranches = branches.filter((branch) => branch?.open !== false).length;
  const totalBranches = branches.length;
  const toppingsCount = toppings.length;

  return {
    activeProducts,
    ordersTotal,
    ordersNew,
    ordersDoing,
    todayRevenue,
    totalCustomers,
    periodCustomers,
    openBranches,
    totalBranches,
    toppingsCount
  };
}

export function filterRecentOrders(ordersSnapshot, dashboardSearch) {
  return ordersSnapshot
    .filter((order) => {
      const keyword = dashboardSearch.trim().toLowerCase();
      if (!keyword) return true;
      const haystack = `${order?.displayOrderCode || ""} ${order?.orderCode || ""} ${order?.customerName || ""} ${order?.orderCustomerName || ""} ${order?.phone || ""} ${order?.customerPhone || ""}`.toLowerCase();
      return haystack.includes(keyword);
    })
    .slice(0, 8);
}
