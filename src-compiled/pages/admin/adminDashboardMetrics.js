export function computeAdminDashboardMetrics({ products, ordersSnapshot, crmSnapshot, branches, toppings }) {
  const activeProducts = products.filter((item) => item.visible !== false).length;
  const ordersTotal = ordersSnapshot.length;
  const ordersNew = ordersSnapshot.filter((order) => String(order.status || "").toLowerCase() === "pending_zalo").length;
  const ordersDoing = ordersSnapshot.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    return status === "confirmed" || status === "delivering";
  }).length;
  const todayRevenue = ordersSnapshot.reduce((sum, order) => {
    const totalAmount = Number(order.totalAmount || order.total || 0);
    const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0);
    return sum + Math.max(totalAmount - shippingFee, 0);
  }, 0);
  const totalCustomers = crmSnapshot?.customers?.length || 0;
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
      const haystack = `${order?.orderCode || ""} ${order?.customerName || ""} ${order?.phone || ""}`.toLowerCase();
      return haystack.includes(keyword);
    })
    .slice(0, 8);
}
