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
import { AdminButton, AdminCard, AdminInput, AdminPageHeader } from "./ui/AdminCommon.jsx";
import { getAdminSession, loginAdminWithPassword, logoutAdmin, subscribeAdminAuth } from "../../services/adminAuthService.js";

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
  routeState
}) {
  const navigate = useNavigate();
  const [adminSession, setAdminSession] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [blockedAdminSession, setBlockedAdminSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
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
    dashboardDataStatus,
    setOrdersSnapshot,
    zaloConfig,
    setZaloConfig,
    shippingConfig,
    setShippingConfig,
    crmSnapshot,
    setCrmSnapshot,
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
  const isSupabaseAdminMode = runtimeInfo.source === "supabase";
  const syncStatusLabel = !supabaseConfigSyncEnabled
    ? "Sync: Local"
    : runtimeInfo.effectiveSource === "supabase"
      ? "Sync: Supabase"
      : "Sync: Local (fallback)";

  const applyAdminAccessState = (access = {}) => {
    if (access?.transientAuthError && access?.session) {
      setAdminSession((current) => current || access.session);
      setAdminProfile((current) => current || access?.profile || null);
      setBlockedAdminSession(null);
      setLoginMessage(access?.message || "");
      return;
    }
    setAdminSession(access?.session || null);
    setAdminProfile(access?.profile || null);
    setBlockedAdminSession(access?.unauthorized ? access?.rawSession || null : null);
    setLoginMessage(access?.message || "");
  };

  useEffect(() => {
    let disposed = false;
    const authLoadingGuard = setTimeout(() => {
      if (disposed) return;
      setAuthLoading(false);
    }, 7000);

    getAdminSession()
      .then((access) => {
        if (disposed) return;
        applyAdminAccessState(access);
        setAuthLoading(false);
      })
      .catch(() => {
        if (disposed) return;
        applyAdminAccessState();
        setAuthLoading(false);
      });

    let unsub = () => {};
    subscribeAdminAuth((access) => {
      if (disposed) return;
      applyAdminAccessState(access);
      setAuthLoading(false);
    }).then((fn) => {
      unsub = typeof fn === "function" ? fn : () => {};
    });

    return () => {
      disposed = true;
      clearTimeout(authLoadingGuard);
      unsub();
    };
  }, []);

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setLoginMessage("");
    setLoginSubmitting(true);
    const result = await loginAdminWithPassword({
      email: loginEmail,
      password: loginPassword
    });
    setLoginSubmitting(false);
    if (!result.ok) {
      setBlockedAdminSession(null);
      setAdminSession(null);
      setAdminProfile(null);
      setLoginMessage(result.message || "Đăng nhập thất bại.");
      return;
    }
    setAdminSession(result.session || null);
    setAdminProfile(result.profile || null);
    setBlockedAdminSession(null);
    setLoginPassword("");
    setLoginMessage("");
  };

  const handleAdminLogout = async () => {
    await logoutAdmin();
    setAdminSession(null);
    setAdminProfile(null);
    setBlockedAdminSession(null);
    setLoginPassword("");
    setLoginMessage("");
  };

  const activateNav = (item) => {
    const nextPath = adminNavToPath(item);
    setActiveAdminNav(item.id);
    setSection(item.section);
    if (item.section === "promo" || item.section === "store") {
      setActiveSubSection(item.sub || (item.section === "promo" ? "ui" : "branches"));
    }
    navigate(nextPath);
  };

  useAdminConfigSyncEffect({
    supabaseConfigSyncEnabled,
    zaloConfig,
    setShippingConfig,
    setZaloConfig,
    setOptionGroupPresetsState
  });

  if (isSupabaseAdminMode && authLoading) {
    return (
      <div className="admin-app admin-shell admin-layout">
        <main className="admin-main admin-content">
          <AdminPageHeader title="Đang kiểm tra phiên đăng nhập" description="Vui lòng chờ..." />
          <AdminCard variant="elevated" className="admin-auth-card admin-auth-card--status">
            <div className="admin-auth-card-body">
              <p className="admin-auth-note">Hệ thống đang xác thực quyền truy cập admin trên Supabase.</p>
            </div>
          </AdminCard>
        </main>
      </div>
    );
  }

  if (isSupabaseAdminMode && blockedAdminSession && !adminSession) {
    return (
      <div className="admin-app admin-shell admin-layout">
        <main className="admin-main admin-content">
          <AdminPageHeader
            title="Không có quyền truy cập admin"
            description="Tài khoản hiện tại đã đăng nhập nhưng chưa có role phù hợp trong bảng profiles."
          />
          <AdminCard variant="elevated" className="admin-auth-card admin-auth-card--blocked">
            <div className="admin-auth-card-body">
              <p className="admin-auth-note">
                Đang dùng tài khoản:
                {" "}
                <strong className="admin-auth-account">
                  {blockedAdminSession?.user?.email || "Không xác định"}
                </strong>
              </p>
              {loginMessage ? <p className="admin-auth-message">{loginMessage}</p> : null}
              <div className="admin-auth-actions">
                <AdminButton variant="secondary" onClick={handleAdminLogout}>
                  Đăng xuất tài khoản hiện tại
                </AdminButton>
              </div>
            </div>
          </AdminCard>
        </main>
      </div>
    );
  }

  if (isSupabaseAdminMode && !adminSession) {
    return (
      <div className="admin-app admin-shell admin-layout">
        <main className="admin-main admin-content">
          <AdminPageHeader
            title="Đăng nhập Admin"
            description="Bạn cần đăng nhập Supabase Auth bằng tài khoản đã được gán role admin hoặc staff."
          />
          <AdminCard variant="elevated" className="admin-auth-card">
            <form onSubmit={handleAdminLogin} className="admin-auth-form">
              <label className="admin-auth-field">
                <span>Email</span>
                <AdminInput
                  type="email"
                  value={loginEmail}
                  onValueChange={setLoginEmail}
                  placeholder="admin@yourdomain.com"
                  required
                />
              </label>
              <label className="admin-auth-field">
                <span>Mật khẩu</span>
                <AdminInput
                  type="password"
                  value={loginPassword}
                  onValueChange={setLoginPassword}
                  placeholder="Nhập mật khẩu"
                  required
                />
              </label>
              {loginMessage ? <p className="admin-auth-message">{loginMessage}</p> : null}
              <AdminButton type="submit" disabled={loginSubmitting}>
                {loginSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
              </AdminButton>
            </form>
          </AdminCard>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-app admin-shell admin-layout">
      <AdminSidebar
        navGroups={navGroups}
        navIconMap={navIconMap}
        activeAdminNav={activeAdminNav}
        onActivateNav={activateNav}
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
          onLogout={isSupabaseAdminMode ? handleAdminLogout : null}
          compact={section === "dashboard" || section === "orders"}
        />

        {section !== "dashboard" && section !== "orders" && section !== "customers" ? (
          <AdminPageHeader
            title={getAdminPageTitle(section)}
            description="Quản trị vận hành cửa hàng, dữ liệu vận hành lưu trên Supabase."
            action={isAppearancePage ? <AdminButton onClick={() => setUiDirty(false)}>Lưu thay đổi</AdminButton> : null}
          />
        ) : null}

        <AdminPageContent
          section={section}
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
          dashboardDataStatus={dashboardDataStatus}
          selectedBranchFilter={selectedBranchFilter}
          setSelectedBranchFilter={setSelectedBranchFilter}
          setOrdersSnapshot={setOrdersSnapshot}
          onOrderUpdated={handleOrderUpdated}
          crmSnapshot={crmSnapshot}
          setCrmSnapshot={setCrmSnapshot}
          adminRequestAudit={adminRequestAudit}
          resetAdminRequestAudit={resetAdminRequestAudit}
          adminOrdersRealtimePending={adminOrdersRealtimePending}
          adminOrdersRealtimeCount={adminOrdersRealtimeCount}
          adminOrdersLoadError={adminOrdersLoadError}
          refreshAdminOrdersFromRealtime={refreshAdminOrdersFromRealtime}
          selectedCustomerPhone={selectedCustomerPhone}
          setSelectedCustomerPhone={setSelectedCustomerPhone}
          onGiftVoucher={handleGiftVoucher}
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
