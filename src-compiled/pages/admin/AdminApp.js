import "../../styles/admin/admin.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar.js";
import AdminTopHeader from "./AdminTopHeader.js";
import { dashboardQuickActions, getAdminPageTitle, navGroups, navIconMap } from "./adminNavigation.js";
import { computeAdminDashboardMetrics, filterRecentOrders } from "./adminDashboardMetrics.js";
import useAdminAppState from "./useAdminAppState.js";
import useAdminAppActions from "./useAdminAppActions.js";
import useAdminConfigSyncEffect from "./useAdminConfigSyncEffect.js";
import { getRepositoryRuntimeInfo } from "../../services/repositories/repositoryRuntime.js";
import { adminNavToPath } from "../../app/routeState.js";
import AdminPageContent from "./pages/AdminPageContent.js";
import { AdminButton, AdminPageHeader } from "./ui/AdminCommon.js";
import { getAdminSession, loginAdminWithPassword, logoutAdmin, subscribeAdminAuth } from "../../services/adminAuthService.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    chartOrdersSnapshot,
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
  } = computeAdminDashboardMetrics({
    products,
    ordersSnapshot,
    crmSnapshot,
    branches,
    toppings
  });
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
  const flatAdminNav = navGroups.flatMap(group => group.items);
  const filteredRecentOrders = filterRecentOrders(ordersSnapshot, dashboardSearch);
  const runtimeInfo = getRepositoryRuntimeInfo();
  const isSupabaseAdminMode = runtimeInfo.source === "supabase";
  const syncStatusLabel = !supabaseConfigSyncEnabled ? "Sync: Local" : runtimeInfo.effectiveSource === "supabase" ? "Sync: Supabase" : "Sync: Local (fallback)";
  useEffect(() => {
    let disposed = false;
    const authLoadingGuard = setTimeout(() => {
      if (disposed) return;
      setAuthLoading(false);
    }, 7000);
    getAdminSession().then(({
      session
    }) => {
      if (disposed) return;
      setAdminSession(session || null);
      setAuthLoading(false);
    }).catch(() => {
      if (disposed) return;
      setAdminSession(null);
      setAuthLoading(false);
    });
    let unsub = () => {};
    subscribeAdminAuth(session => {
      if (disposed) return;
      setAdminSession(session || null);
    }).then(fn => {
      unsub = typeof fn === "function" ? fn : () => {};
    });
    return () => {
      disposed = true;
      clearTimeout(authLoadingGuard);
      unsub();
    };
  }, []);
  const handleAdminLogin = async event => {
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
  const activateNav = item => {
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
    return /*#__PURE__*/_jsx("div", {
      className: "admin-app admin-shell admin-layout",
      children: /*#__PURE__*/_jsx("main", {
        className: "admin-main admin-content",
        children: /*#__PURE__*/_jsx(AdminPageHeader, {
          title: "Đang kiểm tra phiên đăng nhập",
          description: "Vui lòng chờ..."
        })
      })
    });
  }
  if (isSupabaseAdminMode && !adminSession) {
    return /*#__PURE__*/_jsx("div", {
      className: "admin-app admin-shell admin-layout",
      children: /*#__PURE__*/_jsxs("main", {
        className: "admin-main admin-content",
        children: [/*#__PURE__*/_jsx(AdminPageHeader, {
          title: "Đăng nhập Admin",
          description: "Bạn cần đăng nhập Supabase Auth để chỉnh dữ liệu quản trị."
        }), /*#__PURE__*/_jsx("section", {
          className: "admin-card",
          style: {
            maxWidth: 420,
            padding: 16
          },
          children: /*#__PURE__*/_jsxs("form", {
            onSubmit: handleAdminLogin,
            style: {
              display: "grid",
              gap: 12
            },
            children: [/*#__PURE__*/_jsxs("label", {
              style: {
                display: "grid",
                gap: 6
              },
              children: [/*#__PURE__*/_jsx("span", {
                children: "Email"
              }), /*#__PURE__*/_jsx("input", {
                type: "email",
                value: loginEmail,
                onChange: event => setLoginEmail(event.target.value),
                placeholder: "admin@yourdomain.com",
                required: true
              })]
            }), /*#__PURE__*/_jsxs("label", {
              style: {
                display: "grid",
                gap: 6
              },
              children: [/*#__PURE__*/_jsx("span", {
                children: "M\u1EADt kh\u1EA9u"
              }), /*#__PURE__*/_jsx("input", {
                type: "password",
                value: loginPassword,
                onChange: event => setLoginPassword(event.target.value),
                placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
                required: true
              })]
            }), loginMessage ? /*#__PURE__*/_jsx("p", {
              style: {
                color: "#b42318",
                margin: 0
              },
              children: loginMessage
            }) : null, /*#__PURE__*/_jsx(AdminButton, {
              type: "submit",
              disabled: loginSubmitting,
              children: loginSubmitting ? "Đang đăng nhập..." : "Đăng nhập"
            })]
          })
        })]
      })
    });
  }
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-app admin-shell admin-layout",
    children: [/*#__PURE__*/_jsx(AdminSidebar, {
      navGroups: navGroups,
      navIconMap: navIconMap,
      activeAdminNav: activeAdminNav,
      onActivateNav: activateNav
    }), /*#__PURE__*/_jsxs("main", {
      className: "admin-main admin-content",
      children: [/*#__PURE__*/_jsx(AdminTopHeader, {
        adminGlobalSearch: adminGlobalSearch,
        setAdminGlobalSearch: setAdminGlobalSearch,
        selectedBranchFilter: selectedBranchFilter,
        setSelectedBranchFilter: setSelectedBranchFilter,
        branches: branches,
        syncStatusLabel: syncStatusLabel,
        adminEmail: adminSession?.user?.email || "",
        onLogout: isSupabaseAdminMode ? handleAdminLogout : null
      }), /*#__PURE__*/_jsx(AdminPageHeader, {
        title: getAdminPageTitle(section),
        description: "Qu\u1ea3n tr\u1ecb v\u1eadn h\u00e0nh c\u1eeda h\u00e0ng, d\u1eef li\u1ec7u demo l\u01b0u localStorage.",
        action: isAppearancePage ? /*#__PURE__*/_jsx(AdminButton, {
          onClick: () => setUiDirty(false),
          children: "L\u01B0u thay \u0111\u1ED5i"
        }) : null
      }), /*#__PURE__*/_jsx(AdminPageContent, {
        section: section,
        uiDirty: uiDirty,
        dashboardSearch: dashboardSearch,
        setDashboardSearch: setDashboardSearch,
        dashboardDateFrom: dashboardDateFrom,
        setDashboardDateFrom: setDashboardDateFrom,
        dashboardDateTo: dashboardDateTo,
        setDashboardDateTo: setDashboardDateTo,
        dashboardDatePreset: dashboardDatePreset,
        setDashboardDatePreset: setDashboardDatePreset,
        dashboardChartPreset: dashboardChartPreset,
        setDashboardChartPreset: setDashboardChartPreset,
        ordersDateFrom: ordersDateFrom,
        setOrdersDateFrom: setOrdersDateFrom,
        ordersDateTo: ordersDateTo,
        setOrdersDateTo: setOrdersDateTo,
        ordersDatePreset: ordersDatePreset,
        setOrdersDatePreset: setOrdersDatePreset,
        customersDateFrom: customersDateFrom,
        setCustomersDateFrom: setCustomersDateFrom,
        customersDateTo: customersDateTo,
        setCustomersDateTo: setCustomersDateTo,
        customersDatePreset: customersDatePreset,
        setCustomersDatePreset: setCustomersDatePreset,
        openBranches: openBranches,
        totalBranches: totalBranches,
        ordersTotal: ordersTotal,
        ordersNew: ordersNew,
        ordersDoing: ordersDoing,
        todayRevenue: todayRevenue,
        totalCustomers: totalCustomers,
        activeProducts: activeProducts,
        toppingsCount: toppingsCount,
        dashboardQuickActions: dashboardQuickActions,
        openAdminNav: activateNav,
        flatAdminNav: flatAdminNav,
        filteredRecentOrders: filteredRecentOrders,
        customerAdminTab: customerAdminTab,
        setCustomerAdminTab: setCustomerAdminTab,
        ordersSnapshot: ordersSnapshot,
        chartOrdersSnapshot: chartOrdersSnapshot,
        setOrdersSnapshot: setOrdersSnapshot,
        onOrderUpdated: handleOrderUpdated,
        crmSnapshot: crmSnapshot,
        setCrmSnapshot: setCrmSnapshot,
        selectedCustomerPhone: selectedCustomerPhone,
        setSelectedCustomerPhone: setSelectedCustomerPhone,
        onAdjustPoints: handleAdjustPoints,
        onResetPoints: handleResetPoints,
        onGiftVoucher: handleGiftVoucher,
        onCancelVoucher: handleCancelVoucher,
        orderStorage: orderStorage,
        products: products,
        setProducts: setProducts,
        adminCategories: adminCategories,
        setAdminCategories: setAdminCategories,
        toppings: toppings,
        setToppings: setToppings,
        editingProduct: editingProduct,
        setEditingProduct: setEditingProduct,
        optionGroupPresets: optionGroupPresets,
        setOptionGroupPresets: saveOptionGroupPresetsState,
        activeSubSection: activeSubSection,
        activeCampaignTab: activeCampaignTab,
        setActiveCampaignTab: setActiveCampaignTab,
        branches: branches,
        setBranches: setBranches,
        hours: hours,
        setHours: setHours,
        deliveryZones: deliveryZones,
        setDeliveryZones: setDeliveryZones,
        shippingConfig: shippingConfig,
        setShippingConfig: setShippingConfig,
        onSaveShipping: handleSaveShipping,
        zaloConfig: zaloConfig,
        setZaloConfig: setZaloConfig,
        onSaveZalo: handleSaveZalo,
        promos: promos,
        setPromos: setPromos,
        smartPromotions: smartPromotions,
        setSmartPromotions: setSmartPromotions,
        campaigns: campaigns,
        setCampaigns: setCampaigns,
        coupons: coupons,
        setCoupons: setCoupons,
        banners: banners,
        setBanners: setBanners,
        homeContent: homeContent,
        setHomeContent: setHomeContent,
        normalizeSmartPromotion: normalizeSmartPromotion,
        onDirtyChange: setUiDirty,
        onSaveLoyaltyRule: handleSaveLoyaltyRule,
        onSaveLoyaltyRulesRows: handleSaveLoyaltyRulesRows,
        onSaveLoyaltyBonusDisplay: handleSaveLoyaltyBonusDisplay,
        onSaveLoyaltyConfig: handleSaveLoyaltyConfig
      })]
    })]
  });
}