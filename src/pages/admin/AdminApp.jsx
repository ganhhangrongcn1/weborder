import "../../styles/admin/admin.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar.jsx";
import AdminTopHeader from "./AdminTopHeader.jsx";
import { dashboardQuickActions, getAdminPageTitle, navGroups, navIconMap } from "./adminNavigation.js";
import { computeAdminDashboardMetrics, filterRecentOrders } from "./adminDashboardMetrics.js";
import useAdminAppState from "./useAdminAppState.js";
import useAdminAppActions from "./useAdminAppActions.js";
import useAdminConfigSyncEffect from "./useAdminConfigSyncEffect.js";
import { getRepositoryRuntimeInfo } from "../../services/repositories/repositoryRuntime.js";
import { adminNavToPath } from "../../app/routeState.js";
import AdminPageContent from "./pages/AdminPageContent.jsx";
import { AdminButton, AdminPageHeader } from "./ui/AdminCommon.jsx";
import { getAdminReviewRewards } from "../../services/reviewRewardService.js";

export default function AdminApp({
  products,
  setProducts,
  toppings,
  setToppings,
  promos,
  setPromos,
  banners,
  setBanners,
  homeContent,
  setHomeContent,
  coupons,
  setCoupons,
  smartPromotions,
  setSmartPromotions,
  campaigns,
  setCampaigns,
  branches,
  setBranches,
  hours,
  setHours,
  deliveryZones,
  setDeliveryZones,
  adminCategories,
  setAdminCategories,
  normalizeSmartPromotion,
  orderStorage,
  routeState,
  adminAuth
}) {
  const navigate = useNavigate();
  const [reviewRewardPendingCount, setReviewRewardPendingCount] = useState(0);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const {
    adminSession = null,
    adminProfile = null,
    isSupabaseAdminMode = false,
    onAdminLogout = null
  } = adminAuth || {};
  const {
    section,
    setSection,
    activeAdminNav,
    setActiveAdminNav,
    editingProduct,
    setEditingProduct,
    ordersSnapshot,
    dashboardSummary,
    dashboardRevenueSeries,
    businessAnalytics,
    siteTrafficSummary,
    siteTrafficPreset,
    setSiteTrafficPreset,
    dashboardDataStatus,
    setOrdersSnapshot,
    zaloConfig,
    setZaloConfig,
    shippingConfig,
    setShippingConfig,
    crmSnapshot,
    setCrmSnapshot,
    crmLoadState,
    adminRequestAudit,
    resetAdminRequestAudit,
    adminOrdersRealtimePending,
    adminOrdersRealtimeCount,
    adminOrdersLoadError,
    refreshAdminOrdersFromRealtime,
    customerAdminTab,
    setCustomerAdminTab,
    optionGroupPresets,
    setOptionGroupPresetsState,
    selectedCustomerPhone,
    setSelectedCustomerPhone,
    uiDirty,
    setUiDirty,
    dashboardSearch,
    setDashboardSearch,
    dashboardDateFrom,
    setDashboardDateFrom,
    dashboardDateTo,
    setDashboardDateTo,
    dashboardDatePreset,
    setDashboardDatePreset,
    dashboardChartPreset,
    setDashboardChartPreset,
    ordersDateFrom,
    setOrdersDateFrom,
    ordersDateTo,
    setOrdersDateTo,
    ordersDatePreset,
    setOrdersDatePreset,
    customersDateFrom,
    setCustomersDateFrom,
    customersDateTo,
    setCustomersDateTo,
    customersDatePreset,
    setCustomersDatePreset,
    adminGlobalSearch,
    setAdminGlobalSearch,
    selectedBranchFilter,
    setSelectedBranchFilter,
    dashboardBranchFilters,
    setDashboardBranchFilters,
    activeSubSection,
    setActiveSubSection,
    activeCampaignTab,
    setActiveCampaignTab,
    supabaseConfigSyncEnabled
  } = useAdminAppState(orderStorage, routeState, { branches });

  const {
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
  } = computeAdminDashboardMetrics({ products, dashboardSummary, branches, toppings });

  const {
    saveOptionGroupPresetsState,
    handleGiftVoucher,
    handleBulkGiftVoucher,
    handleCancelVoucher,
    handleSaveZalo,
    handleSaveShipping,
    handleSaveLoyaltyRule,
    handleSaveLoyaltyRulesRows,
    handleSaveLoyaltyBonusDisplay,
    handleSaveLoyaltyConfig,
    handleOrderUpdated
  } = useAdminAppActions({
    orderStorage,
    setOrdersSnapshot,
    setCrmSnapshot,
    supabaseConfigSyncEnabled,
    zaloConfig,
    setZaloConfig,
    shippingConfig,
    setShippingConfig,
    setOptionGroupPresetsState
  });

  const isAppearancePage = section === "promo" && activeSubSection === "ui";
  const flatAdminNav = navGroups.flatMap((group) => group.items);
  const filteredRecentOrders = filterRecentOrders(ordersSnapshot, dashboardSearch);
  const runtimeInfo = getRepositoryRuntimeInfo();
  const syncStatusLabel = !supabaseConfigSyncEnabled
    ? "Sync: Local"
    : runtimeInfo.effectiveSource === "supabase"
      ? "Sync: Supabase"
      : "Sync: Local (fallback)";

  const activateNav = (item) => {
    const nextPath = adminNavToPath(item);
    setActiveAdminNav(item.id);
    setSection(item.section);
    if (item.section === "promo" || item.section === "store") {
      setActiveSubSection(item.sub || (item.section === "promo" ? "ui" : "branches"));
    }
    navigate(nextPath);
    setIsMobileNavOpen(false);
  };

  useAdminConfigSyncEffect({
    supabaseConfigSyncEnabled,
    zaloConfig,
    setShippingConfig,
    setZaloConfig,
    setOptionGroupPresetsState
  });

  useEffect(() => {
    let cancelled = false;

    const refreshPendingCount = async () => {
      try {
        const result = await getAdminReviewRewards();
        if (cancelled) return;
        const pendingCount = (result?.claims || []).filter((claim) => claim.status === "pending").length;
        setReviewRewardPendingCount(pendingCount);
      } catch {
        // Keep the last known count when the admin session or network is temporarily unavailable.
      }
    };

    refreshPendingCount();
    const intervalId = window.setInterval(refreshPendingCount, 60000);
    window.addEventListener("focus", refreshPendingCount);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshPendingCount);
    };
  }, []);

  return (
    <div className="admin-app admin-shell admin-layout">
      <AdminSidebar
        navGroups={navGroups}
        navIconMap={navIconMap}
        activeAdminNav={activeAdminNav}
        onActivateNav={activateNav}
        notificationCounts={{ "review-rewards-main": reviewRewardPendingCount }}
        isMobileOpen={isMobileNavOpen}
        onMobileClose={() => setIsMobileNavOpen(false)}
      />

      <main className="admin-main admin-content">
        <AdminTopHeader
          adminGlobalSearch={adminGlobalSearch}
          setAdminGlobalSearch={setAdminGlobalSearch}
          selectedBranchFilter={selectedBranchFilter}
          setSelectedBranchFilter={setSelectedBranchFilter}
          branches={branches}
          syncStatusLabel={syncStatusLabel}
          adminEmail={adminProfile?.email || adminSession?.user?.email || ""}
          onLogout={isSupabaseAdminMode ? onAdminLogout : null}
          compact={section === "dashboard" || section === "orders"}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />

        {section !== "dashboard" && section !== "grab-finance" && section !== "grab-marketing" && section !== "orders" && section !== "customers" ? (
          <AdminPageHeader
            title={getAdminPageTitle(section)}
            description="Quản trị vận hành cửa hàng, dữ liệu vận hành lưu trên Supabase."
            action={isAppearancePage ? <AdminButton onClick={() => setUiDirty(false)}>Lưu thay đổi</AdminButton> : null}
          />
        ) : null}

        <AdminPageContent
          section={section}
          onReviewRewardPendingCountChange={setReviewRewardPendingCount}
          uiDirty={uiDirty}
          dashboardSearch={dashboardSearch}
          setDashboardSearch={setDashboardSearch}
          dashboardDateFrom={dashboardDateFrom}
          setDashboardDateFrom={setDashboardDateFrom}
          dashboardDateTo={dashboardDateTo}
          setDashboardDateTo={setDashboardDateTo}
          dashboardDatePreset={dashboardDatePreset}
          setDashboardDatePreset={setDashboardDatePreset}
          dashboardChartPreset={dashboardChartPreset}
          setDashboardChartPreset={setDashboardChartPreset}
          ordersDateFrom={ordersDateFrom}
          setOrdersDateFrom={setOrdersDateFrom}
          ordersDateTo={ordersDateTo}
          setOrdersDateTo={setOrdersDateTo}
          ordersDatePreset={ordersDatePreset}
          setOrdersDatePreset={setOrdersDatePreset}
          customersDateFrom={customersDateFrom}
          setCustomersDateFrom={setCustomersDateFrom}
          customersDateTo={customersDateTo}
          setCustomersDateTo={setCustomersDateTo}
          customersDatePreset={customersDatePreset}
          setCustomersDatePreset={setCustomersDatePreset}
          openBranches={openBranches}
          totalBranches={totalBranches}
          ordersTotal={ordersTotal}
          ordersNew={ordersNew}
          ordersDoing={ordersDoing}
          todayRevenue={todayRevenue}
          totalCustomers={totalCustomers}
          periodCustomers={periodCustomers}
          activeProducts={activeProducts}
          toppingsCount={toppingsCount}
          dashboardQuickActions={dashboardQuickActions}
          openAdminNav={activateNav}
          flatAdminNav={flatAdminNav}
          filteredRecentOrders={filteredRecentOrders}
          customerAdminTab={customerAdminTab}
          setCustomerAdminTab={setCustomerAdminTab}
          ordersSnapshot={ordersSnapshot}
          dashboardSummary={dashboardSummary}
          dashboardRevenueSeries={dashboardRevenueSeries}
          businessAnalytics={businessAnalytics}
          siteTrafficSummary={siteTrafficSummary}
          siteTrafficPreset={siteTrafficPreset}
          setSiteTrafficPreset={setSiteTrafficPreset}
          dashboardDataStatus={dashboardDataStatus}
          selectedBranchFilter={selectedBranchFilter}
          setSelectedBranchFilter={setSelectedBranchFilter}
          dashboardBranchFilters={dashboardBranchFilters}
          setDashboardBranchFilters={setDashboardBranchFilters}
          setOrdersSnapshot={setOrdersSnapshot}
          onOrderUpdated={handleOrderUpdated}
          crmSnapshot={crmSnapshot}
          setCrmSnapshot={setCrmSnapshot}
          crmLoadState={crmLoadState}
          adminRequestAudit={adminRequestAudit}
          resetAdminRequestAudit={resetAdminRequestAudit}
          adminOrdersRealtimePending={adminOrdersRealtimePending}
          adminOrdersRealtimeCount={adminOrdersRealtimeCount}
          adminOrdersLoadError={adminOrdersLoadError}
          refreshAdminOrdersFromRealtime={refreshAdminOrdersFromRealtime}
          selectedCustomerPhone={selectedCustomerPhone}
          setSelectedCustomerPhone={setSelectedCustomerPhone}
          onGiftVoucher={handleGiftVoucher}
          onBulkGiftVoucher={handleBulkGiftVoucher}
          onCancelVoucher={handleCancelVoucher}
          orderStorage={orderStorage}
          products={products}
          setProducts={setProducts}
          adminCategories={adminCategories}
          setAdminCategories={setAdminCategories}
          toppings={toppings}
          setToppings={setToppings}
          editingProduct={editingProduct}
          setEditingProduct={setEditingProduct}
          optionGroupPresets={optionGroupPresets}
          setOptionGroupPresets={saveOptionGroupPresetsState}
          activeSubSection={activeSubSection}
          activeCampaignTab={activeCampaignTab}
          setActiveCampaignTab={setActiveCampaignTab}
          branches={branches}
          setBranches={setBranches}
          hours={hours}
          setHours={setHours}
          deliveryZones={deliveryZones}
          setDeliveryZones={setDeliveryZones}
          shippingConfig={shippingConfig}
          setShippingConfig={setShippingConfig}
          onSaveShipping={handleSaveShipping}
          zaloConfig={zaloConfig}
          setZaloConfig={setZaloConfig}
          onSaveZalo={handleSaveZalo}
          promos={promos}
          setPromos={setPromos}
          smartPromotions={smartPromotions}
          setSmartPromotions={setSmartPromotions}
          campaigns={campaigns}
          setCampaigns={setCampaigns}
          coupons={coupons}
          setCoupons={setCoupons}
          banners={banners}
          setBanners={setBanners}
          homeContent={homeContent}
          setHomeContent={setHomeContent}
          normalizeSmartPromotion={normalizeSmartPromotion}
          onDirtyChange={setUiDirty}
          onSaveLoyaltyRule={handleSaveLoyaltyRule}
          onSaveLoyaltyRulesRows={handleSaveLoyaltyRulesRows}
          onSaveLoyaltyBonusDisplay={handleSaveLoyaltyBonusDisplay}
          onSaveLoyaltyConfig={handleSaveLoyaltyConfig}
        />
      </main>
    </div>
  );
}
