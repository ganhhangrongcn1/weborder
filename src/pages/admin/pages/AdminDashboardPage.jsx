import AdminDashboardSection from "../dashboard/AdminDashboardSection.jsx";

export default function AdminDashboardPage({
  dashboardSearch,
  setDashboardSearch,
  openBranches,
  totalBranches,
  ordersTotal,
  ordersNew,
  ordersDoing,
  todayRevenue,
  totalCustomers,
  activeProducts,
  toppingsCount,
  dashboardQuickActions,
  openAdminNav,
  flatAdminNav,
  filteredRecentOrders,
  ordersSnapshot
}) {
  return (
    <AdminDashboardSection
      dashboardSearch={dashboardSearch}
      setDashboardSearch={setDashboardSearch}
      openBranches={openBranches}
      totalBranches={totalBranches}
      ordersTotal={ordersTotal}
      ordersNew={ordersNew}
      ordersDoing={ordersDoing}
      todayRevenue={todayRevenue}
      totalCustomers={totalCustomers}
      activeProducts={activeProducts}
      toppingsCount={toppingsCount}
      dashboardQuickActions={dashboardQuickActions}
      openAdminNav={openAdminNav}
      flatAdminNav={flatAdminNav}
      filteredRecentOrders={filteredRecentOrders}
      ordersSnapshot={ordersSnapshot}
    />
  );
}
