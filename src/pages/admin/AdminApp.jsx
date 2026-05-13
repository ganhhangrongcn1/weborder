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
import {
  AdminButton,
  AdminPageHeader,
} from "./ui/AdminCommon.jsx";
import { getAdminSession, loginAdminWithPassword, logoutAdmin, subscribeAdminAuth } from "../../services/adminAuthService.js";

export default function AdminApp({ products, setProducts, toppings, setToppings, promos, setPromos, banners, setBanners, homeContent, setHomeContent, coupons, setCoupons, smartPromotions, setSmartPromotions, campaigns, setCampaigns, branches, setBranches, hours, setHours, deliveryZones, setDeliveryZones, adminCategories, setAdminCategories, normalizeSmartPromotion, orderStorage, routeState }) {
  const navigate = useNavigate();
  const [adminSession, setAdminSession] = useState(null);
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
    setOrdersSnapshot,
    zaloConfig,
    setZaloConfig,
    shippingConfig,
    setShippingConfig,
    crmSnapshot,
    setCrmSnapshot,
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
    adminGlobalSearch,
    setAdminGlobalSearch,
    selectedBranchFilter,
    setSelectedBranchFilter,
    activeSubSection,
    setActiveSubSection,
    activeCampaignTab,
    setActiveCampaignTab,
    supabaseConfigSyncEnabled
  } = useAdminAppState(orderStorage, routeState);

  const {
    activeProducts,
    ordersTotal,
    ordersNew,
    ordersDoing,
    todayRevenue,
    totalCustomers,
    openBranches,
    totalBranches,
    toppingsCount
  } = computeAdminDashboardMetrics({ products, ordersSnapshot, crmSnapshot, branches, toppings });

  const vouchersCount = coupons.length;

  const {
    saveOptionGroupPresetsState,
    handleAdjustPoints,
    handleResetPoints,
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

  useEffect(() => {
    let disposed = false;
    const authLoadingGuard = setTimeout(() => {
      if (disposed) return;
      setAuthLoading(false);
    }, 7000);

    getAdminSession()
      .then(({ session }) => {
        if (disposed) return;
        setAdminSession(session || null);
        setAuthLoading(false);
      })
      .catch(() => {
        if (disposed) return;
        setAdminSession(null);
        setAuthLoading(false);
      });

    let unsub = () => {};
    subscribeAdminAuth((session) => {
      if (disposed) return;
      setAdminSession(session || null);
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
      setLoginMessage(result.message || "Đăng nhập thất bại.");
      return;
    }
    setAdminSession(result.session || null);
    setLoginPassword("");
  };

  const handleAdminLogout = async () => {
    await logoutAdmin();
    setAdminSession(null);
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
          <AdminPageHeader title={"Đang kiểm tra phiên đăng nhập"} description={"Vui lòng chờ..."} />
        </main>
      </div>
    );
  }

  if (isSupabaseAdminMode && !adminSession) {
    return (
      <div className="admin-app admin-shell admin-layout">
        <main className="admin-main admin-content">
          <AdminPageHeader
            title={"Đăng nhập Admin"}
            description={"Bạn cần đăng nhập Supabase Auth để chỉnh dữ liệu quản trị."}
          />
          <section className="admin-card" style={{ maxWidth: 420, padding: 16 }}>
            <form onSubmit={handleAdminLogin} style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Email</span>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="admin@yourdomain.com"
                  required
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Mật khẩu</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>
              {loginMessage ? <p style={{ color: "#b42318", margin: 0 }}>{loginMessage}</p> : null}
              <AdminButton type="submit" disabled={loginSubmitting}>
                {loginSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
              </AdminButton>
            </form>
          </section>
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
          adminEmail={adminSession?.user?.email || ""}
          onLogout={isSupabaseAdminMode ? handleAdminLogout : null}
        />

        <AdminPageHeader
          title={getAdminPageTitle(section)}
          description={"Qu\u1ea3n tr\u1ecb v\u1eadn h\u00e0nh c\u1eeda h\u00e0ng, d\u1eef li\u1ec7u demo l\u01b0u localStorage."}
          action={isAppearancePage ? <AdminButton onClick={() => setUiDirty(false)}>Lưu thay đổi</AdminButton> : null}
        />

        <AdminPageContent
          section={section}
          uiDirty={uiDirty}
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
          openAdminNav={activateNav}
          flatAdminNav={flatAdminNav}
          filteredRecentOrders={filteredRecentOrders}
          customerAdminTab={customerAdminTab}
          setCustomerAdminTab={setCustomerAdminTab}
          ordersSnapshot={ordersSnapshot}
          setOrdersSnapshot={setOrdersSnapshot}
          onOrderUpdated={handleOrderUpdated}
          crmSnapshot={crmSnapshot}
          setCrmSnapshot={setCrmSnapshot}
          selectedCustomerPhone={selectedCustomerPhone}
          setSelectedCustomerPhone={setSelectedCustomerPhone}
          onAdjustPoints={handleAdjustPoints}
          onResetPoints={handleResetPoints}
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
