import { useEffect, useState } from "react";
import {
  buildCustomersFromCrmAnalyticsAsync,
  buildCustomersFromOrderListAsync
} from "../../../services/crmService.js";
import { getAdminDashboardSummaryRpc } from "../../../services/adminDashboardService.js";
import { getAdminDashboardRevenueSeriesRpc } from "../../../services/adminDashboardRevenueService.js";
import { getAdminBusinessAnalyticsRpc } from "../../../services/adminBusinessAnalyticsService.js";
import { getSiteVisitDailyStats } from "../../../services/siteVisitTrackingService.js";
import {
  branchOptionMatchesOrder,
  buildBranchFilterOptions
} from "../../../services/branchIdentityService.js";
import {
  buildAdminOrderFeed,
  readPartnerOrdersForAdmin
} from "../../../services/adminOrderFeedService.js";
import {
  getAdminRequestAuditSnapshot,
  recordAdminRequest,
  resetAdminRequestAudit
} from "../../../services/adminRequestAuditService.js";
import {
  addDaysToVietnamDateInput,
  buildVietnamDateRange,
  hasDateRange,
  toVietnamDateInputValue
} from "../../../utils/adminDateRange.js";

const SNAPSHOT_CACHE_TTL_MS = 60000;
const ordersSnapshotCache = new Map();
const ordersSnapshotInFlight = new Map();
const DASHBOARD_DATA_KEYS = ["summary", "analytics", "revenue", "orders", "traffic"];

function createDashboardDataStatus() {
  return DASHBOARD_DATA_KEYS.reduce((status, key) => ({
    ...status,
    [key]: {
      status: "idle",
      updatedAt: "",
      error: ""
    }
  }), {});
}

function updateDashboardDataStatus(setStatus, key, status, error = "") {
  setStatus((current) => ({
    ...current,
    [key]: {
      status,
      updatedAt: status === "ready" ? new Date().toISOString() : "",
      error
    }
  }));
}

function buildChartRangeFromPreset(preset = "7d") {
  const end = toVietnamDateInputValue();
  if (preset === "month") {
    return buildVietnamDateRange(`${end.slice(0, 7)}-01`, end);
  }
  const days = preset === "30d" ? 30 : 7;
  return buildVietnamDateRange(addDaysToVietnamDateInput(end, -(days - 1)), end);
}

async function loadOrdersSnapshot(orderStorage, dateRange = {}, { includePartnerOrders = false, requireRemote = false, includeOrderItems = true } = {}) {
  const cacheKey = buildOrdersSnapshotCacheKey(dateRange, includePartnerOrders, requireRemote, includeOrderItems);
  const cached = ordersSnapshotCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < SNAPSHOT_CACHE_TTL_MS) {
    return cached.value;
  }
  if (ordersSnapshotInFlight.has(cacheKey)) {
    return ordersSnapshotInFlight.get(cacheKey);
  }

  const request = loadOrdersSnapshotUncached(orderStorage, dateRange, { includePartnerOrders, requireRemote, includeOrderItems })
    .then((value) => {
      ordersSnapshotCache.set(cacheKey, {
        cachedAt: Date.now(),
        value
      });
      if (includePartnerOrders) {
        ordersSnapshotCache.set(buildOrdersSnapshotCacheKey(dateRange, false, requireRemote, includeOrderItems), {
          cachedAt: Date.now(),
          value: getWebOrdersOnly(value)
        });
      }
      return value;
    })
    .finally(() => {
      ordersSnapshotInFlight.delete(cacheKey);
    });

  ordersSnapshotInFlight.set(cacheKey, request);
  return request;
}

async function loadOrdersSnapshotUncached(orderStorage, dateRange = {}, { includePartnerOrders = false, requireRemote = false, includeOrderItems = true } = {}) {
  const webOrdersPromise = orderStorage?.getAllAsync?.({
    ...dateRange,
    requireRemote,
    includeItems: includeOrderItems
  });
  const partnerOrdersPromise = includePartnerOrders
    ? readPartnerOrdersForAdmin({ ...dateRange, includeItems: includeOrderItems })
    : Promise.resolve([]);
  const [webOrders, partnerOrders] = await Promise.all([webOrdersPromise, partnerOrdersPromise]);
  recordAdminRequest("read web orders snapshot", "orders");
  const safeWebOrders = Array.isArray(webOrders) ? webOrders : [];
  if (!includePartnerOrders) return safeWebOrders;
  return buildAdminOrderFeed(safeWebOrders, partnerOrders);
}

function buildOrdersSnapshotCacheKey(dateRange = {}, includePartnerOrders = false, requireRemote = false, includeOrderItems = true) {
  return [
    includePartnerOrders ? "with-partner" : "web-only",
    requireRemote ? "remote-only" : "fallback-allowed",
    includeOrderItems ? "with-items" : "summary-only",
    String(dateRange?.dateFrom || ""),
    String(dateRange?.dateTo || "")
  ].join("|");
}

function clearOrdersSnapshotCache() {
  ordersSnapshotCache.clear();
  ordersSnapshotInFlight.clear();
}

function getSelectedBranchOption(branches = [], selectedBranchFilter = "all") {
  if (!selectedBranchFilter || selectedBranchFilter === "all") return null;
  return buildBranchFilterOptions(branches).find((branch) => branch.value === selectedBranchFilter) || null;
}

function filterOrdersByBranch(orders = [], branchOption = null) {
  if (!branchOption) return Array.isArray(orders) ? orders : [];
  return (Array.isArray(orders) ? orders : []).filter((order) => branchOptionMatchesOrder(order, branchOption));
}

function getWebOrdersOnly(orders = []) {
  return (Array.isArray(orders) ? orders : []).filter((order) => order?.sourceType !== "partner");
}

async function loadCrmSnapshotFastFirst(orderStorage, dateRange = {}, selectedBranchOption = null, options = {}) {
  const canUseFastCrmSnapshot = !hasDateRange(dateRange) && !selectedBranchOption;
  if (canUseFastCrmSnapshot) {
    try {
      const fastSnapshot = await buildCustomersFromCrmAnalyticsAsync({
        forceSupportRefresh: options?.forceSupportRefresh === true
      });
      if (fastSnapshot?.crmAnalytics?.source === "rpc") {
        return fastSnapshot;
      }
    } catch (error) {
      console.warn("[admin][crm] fast rpc snapshot failed, falling back to order snapshot", error);
    }
  }

  const crmOrders = await loadOrdersSnapshot(orderStorage, dateRange, {
    includePartnerOrders: true,
    includeOrderItems: false
  });
  const scopedOrders = selectedBranchOption ? filterOrdersByBranch(crmOrders, selectedBranchOption) : crmOrders;
  return buildCustomersFromOrderListAsync(scopedOrders, orderStorage, {
    dateRange,
    forceSupportRefresh: options?.forceSupportRefresh === true
  });
}

export default function useAdminOrderCrmState(orderStorage, options = {}) {
  const {
    section = "dashboard",
    dashboardDateFrom = "",
    dashboardDateTo = "",
    ordersDateFrom = "",
    ordersDateTo = "",
    customersDateFrom = "",
    customersDateTo = "",
    dashboardChartPreset = "7d",
    selectedBranchFilter = "all",
    branches = []
  } = options || {};
  const [ordersSnapshot, setOrdersSnapshot] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [dashboardRevenueSeries, setDashboardRevenueSeries] = useState(null);
  const [businessAnalytics, setBusinessAnalytics] = useState(null);
  const [siteTrafficSummary, setSiteTrafficSummary] = useState(null);
  const [dashboardDataStatus, setDashboardDataStatus] = useState(createDashboardDataStatus);
  const [crmSnapshot, setCrmSnapshot] = useState({ customers: [], loyaltyConfig: {} });
  const [adminRequestAudit, setAdminRequestAudit] = useState(() => getAdminRequestAuditSnapshot());
  const [adminOrdersLoadError, setAdminOrdersLoadError] = useState("");
  const [customerAdminTab, setCustomerAdminTab] = useState("crm");
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState("");
  const selectedBranchOption = getSelectedBranchOption(branches, selectedBranchFilter);
  const selectedBranchUuid = selectedBranchOption?.value || "";
  const selectedBranchName = selectedBranchOption?.label || "";

  const loadActiveOrdersSnapshot = async ({ force = false } = {}) => {
    const dateRange = buildVietnamDateRange(ordersDateFrom, ordersDateTo);
    if (force) clearOrdersSnapshotCache();
    try {
      const nextOrders = await loadOrdersSnapshot(orderStorage, dateRange, {
        includePartnerOrders: true,
        requireRemote: true
      });
      setOrdersSnapshot(Array.isArray(nextOrders) ? nextOrders : []);
      setAdminOrdersLoadError("");
      setAdminRequestAudit(getAdminRequestAuditSnapshot());
      return nextOrders;
    } catch (error) {
      console.error("[admin][orders] failed to refresh active snapshot", error);
      setAdminOrdersLoadError("Không thể tải danh sách đơn hàng từ Supabase.");
      setOrdersSnapshot([]);
      throw error;
    }
  };

  useEffect(() => {
    let disposed = false;

    const refreshDashboardSummary = async () => {
      if (section !== "dashboard") return;
      setDashboardSummary(null);
      updateDashboardDataStatus(setDashboardDataStatus, "summary", "loading");
      try {
        const dateRange = buildVietnamDateRange(dashboardDateFrom, dashboardDateTo);
        const nextSummary = await getAdminDashboardSummaryRpc({
          ...dateRange,
          branchFilter: selectedBranchName,
          branchUuid: selectedBranchUuid,
          branchName: selectedBranchName
        });
        if (disposed) return;
        if (!nextSummary) {
          throw new Error("RPC tổng quan dashboard chưa sẵn sàng.");
        }
        setDashboardSummary(nextSummary);
        updateDashboardDataStatus(setDashboardDataStatus, "summary", "ready");
        recordAdminRequest("read admin dashboard summary rpc", "rpc:get_admin_dashboard_summary");
        setAdminRequestAudit(getAdminRequestAuditSnapshot());
      } catch (error) {
        if (disposed) return;
        console.error("[admin][dashboard-summary] failed to load rpc", error);
        setDashboardSummary(null);
        updateDashboardDataStatus(
          setDashboardDataStatus,
          "summary",
          "error",
          "Không thể tải KPI từ Supabase."
        );
      }
    };

    refreshDashboardSummary();
    return () => {
      disposed = true;
    };
  }, [section, dashboardDateFrom, dashboardDateTo, selectedBranchName, selectedBranchUuid]);

  useEffect(() => {
    let disposed = false;

    const refreshSiteTrafficSummary = async () => {
      if (section !== "dashboard") return;
      setSiteTrafficSummary(null);
      updateDashboardDataStatus(setDashboardDataStatus, "traffic", "loading");
      try {
        const nextTraffic = await getSiteVisitDailyStats({
          dateFrom: dashboardDateFrom,
          dateTo: dashboardDateTo
        });
        if (disposed) return;
        if (!nextTraffic) {
          throw new Error("RPC lượt truy cập chưa sẵn sàng.");
        }
        setSiteTrafficSummary(nextTraffic);
        updateDashboardDataStatus(setDashboardDataStatus, "traffic", "ready");
        recordAdminRequest("read site visit daily stats rpc", "rpc:get_site_visit_daily_stats");
        setAdminRequestAudit(getAdminRequestAuditSnapshot());
      } catch (error) {
        if (disposed) return;
        console.error("[admin][site-traffic] failed to load rpc", error);
        setSiteTrafficSummary(null);
        updateDashboardDataStatus(
          setDashboardDataStatus,
          "traffic",
          "error",
          "Không thể tải lượt truy cập từ Supabase."
        );
      }
    };

    refreshSiteTrafficSummary();
    return () => {
      disposed = true;
    };
  }, [section, dashboardDateFrom, dashboardDateTo]);

  useEffect(() => {
    let disposed = false;

    const refreshBusinessAnalytics = async () => {
      if (section !== "dashboard") return;
      setBusinessAnalytics(null);
      updateDashboardDataStatus(setDashboardDataStatus, "analytics", "loading");
      try {
        const dateRange = buildVietnamDateRange(dashboardDateFrom, dashboardDateTo);
        const nextAnalytics = await getAdminBusinessAnalyticsRpc({
          ...dateRange,
          branchFilter: selectedBranchName,
          branchUuid: selectedBranchUuid,
          branchName: selectedBranchName
        });
        if (disposed) return;
        if (!nextAnalytics) {
          throw new Error("RPC phân tích kinh doanh chưa sẵn sàng.");
        }
        setBusinessAnalytics(nextAnalytics);
        updateDashboardDataStatus(setDashboardDataStatus, "analytics", "ready");
        recordAdminRequest("read admin business analytics rpc", "rpc:get_admin_business_analytics");
        setAdminRequestAudit(getAdminRequestAuditSnapshot());
      } catch (error) {
        if (disposed) return;
        console.error("[admin][business-analytics] failed to load rpc", error);
        setBusinessAnalytics(null);
        updateDashboardDataStatus(
          setDashboardDataStatus,
          "analytics",
          "error",
          "Không thể tải phân tích kinh doanh từ Supabase."
        );
      }
    };

    refreshBusinessAnalytics();
    return () => {
      disposed = true;
    };
  }, [section, dashboardDateFrom, dashboardDateTo, selectedBranchName, selectedBranchUuid]);

  useEffect(() => {
    let disposed = false;
    const activeDateFrom = section === "orders" ? ordersDateFrom : section === "customers" ? customersDateFrom : dashboardDateFrom;
    const activeDateTo = section === "orders" ? ordersDateTo : section === "customers" ? customersDateTo : dashboardDateTo;

    const refreshOrdersOnly = async () => {
      if (section !== "dashboard" && section !== "orders") return;

      const dateRange = buildVietnamDateRange(activeDateFrom, activeDateTo);
      if (section === "dashboard") {
        setOrdersSnapshot([]);
        updateDashboardDataStatus(setDashboardDataStatus, "orders", "loading");
      }
      try {
        if (section === "orders") {
          setAdminOrdersLoadError("");
        }
        const nextOrders = await loadOrdersSnapshot(orderStorage, dateRange, {
          includePartnerOrders: section === "dashboard" || section === "orders",
          requireRemote: section === "dashboard" || section === "orders"
        });
        if (disposed) return;
        const safeOrders = Array.isArray(nextOrders) ? nextOrders : [];
        setOrdersSnapshot(section === "dashboard" ? filterOrdersByBranch(safeOrders, selectedBranchOption) : safeOrders);
        if (section === "dashboard") {
          updateDashboardDataStatus(setDashboardDataStatus, "orders", "ready");
        }
        if (section === "orders") {
          setAdminOrdersLoadError("");
        }
        setAdminRequestAudit(getAdminRequestAuditSnapshot());
      } catch (error) {
        if (disposed) return;
        console.error("[admin][orders] failed to load snapshot", error);
        setOrdersSnapshot([]);
        if (section === "orders") {
          setAdminOrdersLoadError("Không thể tải danh sách đơn hàng từ Supabase.");
        }
        if (section === "dashboard") {
          updateDashboardDataStatus(
            setDashboardDataStatus,
            "orders",
            "error",
            "Không thể tải danh sách đơn trực tiếp từ Supabase."
          );
        }
      }
    };

    refreshOrdersOnly();
    return () => {
      disposed = true;
    };
  }, [orderStorage, section, dashboardDateFrom, dashboardDateTo, ordersDateFrom, ordersDateTo, customersDateFrom, customersDateTo, selectedBranchFilter, branches]);

  useEffect(() => {
    let disposed = false;
    const refreshDashboardRevenue = async () => {
      if (section !== "dashboard") return;
      const dateRange = buildChartRangeFromPreset(dashboardChartPreset);
      setDashboardRevenueSeries(null);
      updateDashboardDataStatus(setDashboardDataStatus, "revenue", "loading");
      try {
        const nextRevenueSeries = await getAdminDashboardRevenueSeriesRpc({
          ...dateRange,
          branchFilter: selectedBranchName,
          branchUuid: selectedBranchUuid,
          branchName: selectedBranchName
        });
        if (disposed) return;
        if (!nextRevenueSeries) {
          throw new Error("RPC biểu đồ doanh thu chưa sẵn sàng.");
        }
        setDashboardRevenueSeries(nextRevenueSeries);
        updateDashboardDataStatus(setDashboardDataStatus, "revenue", "ready");
        recordAdminRequest("read admin dashboard revenue rpc", "rpc:get_admin_dashboard_revenue_series");
        setAdminRequestAudit(getAdminRequestAuditSnapshot());
      } catch (error) {
        if (disposed) return;
        console.error("[admin][dashboard-revenue] failed to load rpc", error);
        setDashboardRevenueSeries(null);
        updateDashboardDataStatus(
          setDashboardDataStatus,
          "revenue",
          "error",
          "Không thể tải biểu đồ doanh thu từ Supabase."
        );
      }
    };
    refreshDashboardRevenue();
    return () => {
      disposed = true;
    };
  }, [section, dashboardChartPreset, selectedBranchName, selectedBranchUuid]);

  useEffect(() => {
    if (section !== "customers") {
      return undefined;
    }

    let disposed = false;

    const refreshCrmSnapshot = async () => {
      try {
        const dateRange = buildVietnamDateRange(customersDateFrom, customersDateTo);
        const nextCrm = await loadCrmSnapshotFastFirst(orderStorage, dateRange, selectedBranchOption);
        if (disposed) return;
        setCrmSnapshot(nextCrm);
        setAdminRequestAudit(getAdminRequestAuditSnapshot());
      } catch (error) {
        if (disposed) return;
        console.error("[admin][crm] failed to load snapshot", error);
      }
    };

    refreshCrmSnapshot();

    return () => {
      disposed = true;
    };
  }, [orderStorage, section, customersDateFrom, customersDateTo, selectedBranchFilter, branches]);

  useEffect(() => {
    const syncAudit = () => {
      setAdminRequestAudit(getAdminRequestAuditSnapshot());
    };
    const timer = window.setInterval(() => {
      syncAudit();
    }, 30000);
    window.addEventListener("ghr:admin-request-audit-changed", syncAudit);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("ghr:admin-request-audit-changed", syncAudit);
    };
  }, []);

  const resetAdminAudit = () => {
    resetAdminRequestAudit();
    setAdminRequestAudit(getAdminRequestAuditSnapshot());
  };

  return {
    ordersSnapshot,
    setOrdersSnapshot,
    dashboardSummary,
    dashboardRevenueSeries,
    businessAnalytics,
    siteTrafficSummary,
    dashboardDataStatus,
    crmSnapshot,
    setCrmSnapshot,
    adminRequestAudit,
    resetAdminRequestAudit: resetAdminAudit,
    adminOrdersRealtimePending: false,
    adminOrdersRealtimeCount: 0,
    adminOrdersLoadError,
    refreshAdminOrdersFromRealtime: () => loadActiveOrdersSnapshot({ force: true }).catch(() => []),
    customerAdminTab,
    setCustomerAdminTab,
    selectedCustomerPhone,
    setSelectedCustomerPhone
  };
}
