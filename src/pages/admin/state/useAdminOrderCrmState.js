import { useEffect, useState } from "react";
import { buildCustomersFromOrderListAsync } from "../../../services/crmService.js";
import { getAdminDashboardSummaryRpc } from "../../../services/adminDashboardService.js";
import { getAdminBusinessAnalyticsRpc } from "../../../services/adminBusinessAnalyticsService.js";
import {
  branchOptionMatchesOrder,
  buildBranchFilterOptions
} from "../../../services/branchIdentityService.js";
import {
  buildAdminOrderFeed,
  readPartnerOrdersForAdmin,
  subscribeAdminOrderChanges
} from "../../../services/adminOrderFeedService.js";
import {
  getAdminRequestAuditSnapshot,
  recordAdminRequest,
  resetAdminRequestAudit
} from "../../../services/adminRequestAuditService.js";
import { STORAGE_KEYS } from "../../../services/repositories/storageKeys.js";
import {
  addDaysToVietnamDateInput,
  buildVietnamDateRange,
  toVietnamDateInputValue
} from "../../../utils/adminDateRange.js";

const SNAPSHOT_CACHE_TTL_MS = 60000;
const ADMIN_REALTIME_NOTICE_DELAY_MS = 2000;
const ADMIN_ORDER_REFRESH_DEBOUNCE_MS = 250;
const ordersSnapshotCache = new Map();
const ordersSnapshotInFlight = new Map();

function buildChartRangeFromPreset(preset = "7d") {
  const end = toVietnamDateInputValue();
  if (preset === "month") {
    return buildVietnamDateRange(`${end.slice(0, 7)}-01`, end);
  }
  const days = preset === "30d" ? 30 : 7;
  return buildVietnamDateRange(addDaysToVietnamDateInput(end, -(days - 1)), end);
}

async function loadOrdersSnapshot(orderStorage, dateRange = {}, { includePartnerOrders = false } = {}) {
  const cacheKey = buildOrdersSnapshotCacheKey(dateRange, includePartnerOrders);
  const cached = ordersSnapshotCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < SNAPSHOT_CACHE_TTL_MS) {
    return cached.value;
  }
  if (ordersSnapshotInFlight.has(cacheKey)) {
    return ordersSnapshotInFlight.get(cacheKey);
  }

  const request = loadOrdersSnapshotUncached(orderStorage, dateRange, { includePartnerOrders })
    .then((value) => {
      ordersSnapshotCache.set(cacheKey, {
        cachedAt: Date.now(),
        value
      });
      if (includePartnerOrders) {
        ordersSnapshotCache.set(buildOrdersSnapshotCacheKey(dateRange, false), {
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

async function loadOrdersSnapshotUncached(orderStorage, dateRange = {}, { includePartnerOrders = false } = {}) {
  const webOrders = await orderStorage?.getAllAsync?.(dateRange);
  recordAdminRequest("read web orders snapshot", "orders");
  const safeWebOrders = Array.isArray(webOrders) ? webOrders : [];
  if (!includePartnerOrders) return safeWebOrders;
  const partnerOrders = await readPartnerOrdersForAdmin(dateRange);
  return buildAdminOrderFeed(safeWebOrders, partnerOrders);
}

function buildOrdersSnapshotCacheKey(dateRange = {}, includePartnerOrders = false) {
  return [
    includePartnerOrders ? "with-partner" : "web-only",
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

function getTimeValue(value = "") {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function realtimeEventMatchesDateRange(change = {}, dateRange = {}) {
  const table = String(change?.table || "");
  if (table === "order_items" || table === "partner_order_items") return true;

  const row = change?.payload?.new || change?.payload?.old || {};
  const timeValue = getTimeValue(table === "partner_orders" ? row.order_time || row.created_at : row.created_at);
  if (!timeValue) return true;

  const fromValue = getTimeValue(dateRange.dateFrom);
  const toValue = getTimeValue(dateRange.dateTo);
  if (fromValue && timeValue < fromValue) return false;
  if (toValue && timeValue >= toValue) return false;
  return true;
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
  const [chartOrdersSnapshot, setChartOrdersSnapshot] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [businessAnalytics, setBusinessAnalytics] = useState(null);
  const [crmSnapshot, setCrmSnapshot] = useState({ customers: [], loyaltyConfig: {} });
  const [adminRequestAudit, setAdminRequestAudit] = useState(() => getAdminRequestAuditSnapshot());
  const [adminOrdersRealtimePending, setAdminOrdersRealtimePending] = useState(false);
  const [adminOrdersRealtimeCount, setAdminOrdersRealtimeCount] = useState(0);
  const [customerAdminTab, setCustomerAdminTab] = useState("crm");
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState("");
  const selectedBranchOption = getSelectedBranchOption(branches, selectedBranchFilter);
  const selectedBranchUuid = selectedBranchOption?.value || "";
  const selectedBranchName = selectedBranchOption?.label || "";

  const loadActiveOrdersSnapshot = async ({ force = false } = {}) => {
    const dateRange = buildVietnamDateRange(ordersDateFrom, ordersDateTo);
    if (force) clearOrdersSnapshotCache();
    const nextOrders = await loadOrdersSnapshot(orderStorage, dateRange, {
      includePartnerOrders: true
    });
    setOrdersSnapshot(Array.isArray(nextOrders) ? nextOrders : []);
    setAdminOrdersRealtimePending(false);
    setAdminOrdersRealtimeCount(0);
    setAdminRequestAudit(getAdminRequestAuditSnapshot());
    return nextOrders;
  };

  useEffect(() => {
    let disposed = false;

    const refreshDashboardSummary = async () => {
      if (section !== "dashboard") return;
      try {
        const dateRange = buildVietnamDateRange(dashboardDateFrom, dashboardDateTo);
        const nextSummary = await getAdminDashboardSummaryRpc({
          ...dateRange,
          branchFilter: selectedBranchName,
          branchUuid: selectedBranchUuid,
          branchName: selectedBranchName
        });
        if (disposed) return;
        setDashboardSummary(nextSummary);
        if (nextSummary) {
          recordAdminRequest("read admin dashboard summary rpc", "rpc:get_admin_dashboard_summary");
          setAdminRequestAudit(getAdminRequestAuditSnapshot());
        }
      } catch (error) {
        if (disposed) return;
        console.error("[admin][dashboard-summary] failed to load rpc", error);
        setDashboardSummary(null);
      }
    };

    refreshDashboardSummary();
    return () => {
      disposed = true;
    };
  }, [section, dashboardDateFrom, dashboardDateTo, ordersSnapshot, selectedBranchName, selectedBranchUuid]);

  useEffect(() => {
    let disposed = false;

    const refreshBusinessAnalytics = async () => {
      if (section !== "dashboard") return;
      try {
        const dateRange = buildVietnamDateRange(dashboardDateFrom, dashboardDateTo);
        const nextAnalytics = await getAdminBusinessAnalyticsRpc({
          ...dateRange,
          branchFilter: selectedBranchName,
          branchUuid: selectedBranchUuid,
          branchName: selectedBranchName
        });
        if (disposed) return;
        setBusinessAnalytics(nextAnalytics);
        if (nextAnalytics) {
          recordAdminRequest("read admin business analytics rpc", "rpc:get_admin_business_analytics");
          setAdminRequestAudit(getAdminRequestAuditSnapshot());
        }
      } catch (error) {
        if (disposed) return;
        console.error("[admin][business-analytics] failed to load rpc", error);
        setBusinessAnalytics(null);
      }
    };

    refreshBusinessAnalytics();
    return () => {
      disposed = true;
    };
  }, [section, dashboardDateFrom, dashboardDateTo, ordersSnapshot, selectedBranchName, selectedBranchUuid]);

  useEffect(() => {
    let disposed = false;
    const activeDateFrom = section === "orders" ? ordersDateFrom : section === "customers" ? customersDateFrom : dashboardDateFrom;
    const activeDateTo = section === "orders" ? ordersDateTo : section === "customers" ? customersDateTo : dashboardDateTo;

    const refreshOrdersOnly = async () => {
      if (section === "customers") return;

      const dateRange = buildVietnamDateRange(activeDateFrom, activeDateTo);
      try {
        const nextOrders = await loadOrdersSnapshot(orderStorage, dateRange, {
          includePartnerOrders: section === "dashboard" || section === "orders"
        });
        if (disposed) return;
        const safeOrders = Array.isArray(nextOrders) ? nextOrders : [];
        setOrdersSnapshot(section === "dashboard" ? filterOrdersByBranch(safeOrders, selectedBranchOption) : safeOrders);
        setAdminRequestAudit(getAdminRequestAuditSnapshot());
      } catch (error) {
        if (disposed) return;
        console.error("[admin][orders] failed to load snapshot", error);
        setOrdersSnapshot([]);
      }
    };

    refreshOrdersOnly();
    return () => {
      disposed = true;
    };
  }, [orderStorage, section, dashboardDateFrom, dashboardDateTo, ordersDateFrom, ordersDateTo, customersDateFrom, customersDateTo, selectedBranchFilter, branches]);

  useEffect(() => {
    if (section !== "orders") {
      setAdminOrdersRealtimePending(false);
      setAdminOrdersRealtimeCount(0);
      return undefined;
    }

    let alive = true;
    let noticeTimer = null;
    let unsubscribe = () => {};

    async function startRealtime() {
      unsubscribe = await subscribeAdminOrderChanges((change) => {
        if (!alive) return;
        const dateRange = buildVietnamDateRange(ordersDateFrom, ordersDateTo);
        if (!realtimeEventMatchesDateRange(change, dateRange)) return;
        if (noticeTimer) window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(() => {
          noticeTimer = null;
          if (!alive) return;
          setAdminOrdersRealtimePending(true);
          setAdminOrdersRealtimeCount((count) => count + 1);
        }, ADMIN_REALTIME_NOTICE_DELAY_MS);
      });
    }

    startRealtime();

    return () => {
      alive = false;
      if (noticeTimer) {
        window.clearTimeout(noticeTimer);
        noticeTimer = null;
      }
      unsubscribe?.();
    };
  }, [ordersDateFrom, ordersDateTo, section]);

  useEffect(() => {
    let disposed = false;
    const refreshChartOrders = async () => {
      const dateRange = buildChartRangeFromPreset(dashboardChartPreset);
      try {
        const nextOrders = await loadOrdersSnapshot(orderStorage, dateRange, {
          includePartnerOrders: true
        });
        if (disposed) return;
        setChartOrdersSnapshot(filterOrdersByBranch(nextOrders, selectedBranchOption));
        setAdminRequestAudit(getAdminRequestAuditSnapshot());
      } catch (error) {
        if (disposed) return;
        console.error("[admin][chart-orders] failed to load snapshot", error);
        setChartOrdersSnapshot([]);
      }
    };
    refreshChartOrders();
    return () => {
      disposed = true;
    };
  }, [orderStorage, dashboardChartPreset, selectedBranchFilter, branches]);

  useEffect(() => {
    let disposed = false;
    let refreshTimer = null;

    const refreshCrmOnly = async () => {
      try {
        const activeDateFrom = section === "customers" ? customersDateFrom : dashboardDateFrom;
        const activeDateTo = section === "customers" ? customersDateTo : dashboardDateTo;
        const dateRange = buildVietnamDateRange(activeDateFrom, activeDateTo);
        const crmOrders = await loadOrdersSnapshot(orderStorage, dateRange, {
          includePartnerOrders: true
        });
        const scopedOrders = section === "dashboard" ? filterOrdersByBranch(crmOrders, selectedBranchOption) : crmOrders;
        const nextCrm = await buildCustomersFromOrderListAsync(scopedOrders, orderStorage, { dateRange });
        if (disposed) return;
        setCrmSnapshot(nextCrm);
        setAdminRequestAudit(getAdminRequestAuditSnapshot());
      } catch (error) {
        if (disposed) return;
        console.error("[admin][crm] failed to load snapshot", error);
      }
    };

    const refreshAll = async () => {
      const activeDateFrom = section === "orders" ? ordersDateFrom : section === "customers" ? customersDateFrom : dashboardDateFrom;
      const activeDateTo = section === "orders" ? ordersDateTo : section === "customers" ? customersDateTo : dashboardDateTo;
      const dateRange = buildVietnamDateRange(activeDateFrom, activeDateTo);
      clearOrdersSnapshotCache();
      const ordersResult = await loadOrdersSnapshot(orderStorage, dateRange, {
        includePartnerOrders: true
      })
        .then((value) => ({ status: "fulfilled", value }))
        .catch((reason) => ({ status: "rejected", reason }));
      if (disposed) return;
      const combinedOrders = ordersResult.status === "fulfilled" ? ordersResult.value : [];
      const scopedCombinedOrders = section === "dashboard" ? filterOrdersByBranch(combinedOrders, selectedBranchOption) : combinedOrders;
      const shouldRefreshCrm = section !== "orders";
      const crmResult = shouldRefreshCrm && ordersResult.status === "fulfilled"
        ? await buildCustomersFromOrderListAsync(scopedCombinedOrders, orderStorage, { dateRange })
            .then((value) => ({ status: "fulfilled", value }))
            .catch((reason) => ({ status: "rejected", reason }))
        : { status: "skipped", value: null };
      if (disposed) return;
      const nextOrders = section === "dashboard" || section === "orders" ? scopedCombinedOrders : getWebOrdersOnly(combinedOrders);
      if (ordersResult.status === "rejected") {
        console.error("[admin][orders] failed to load snapshot", ordersResult.reason);
      }
      if (crmResult.status === "rejected") {
        console.error("[admin][crm] failed to load snapshot", crmResult.reason);
      }
      if (crmResult.status === "fulfilled") {
        setCrmSnapshot(crmResult.value);
      }
      setOrdersSnapshot(Array.isArray(nextOrders) ? nextOrders : []);
      setAdminRequestAudit(getAdminRequestAuditSnapshot());
    };

    const scheduleRefreshAll = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        refreshAll();
      }, ADMIN_ORDER_REFRESH_DEBOUNCE_MS);
    };

    const handleStorageChange = (event) => {
      if (event.key === STORAGE_KEYS.ordersByPhone) scheduleRefreshAll();
    };

    window.addEventListener("ghr:orders-changed", scheduleRefreshAll);
    window.addEventListener("storage", handleStorageChange);
    if (section !== "orders") {
      refreshCrmOnly();
    }

    return () => {
      disposed = true;
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      window.removeEventListener("ghr:orders-changed", scheduleRefreshAll);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [orderStorage, section, dashboardDateFrom, dashboardDateTo, ordersDateFrom, ordersDateTo, customersDateFrom, customersDateTo, selectedBranchFilter, branches]);

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
    chartOrdersSnapshot,
    setChartOrdersSnapshot,
    dashboardSummary,
    businessAnalytics,
    crmSnapshot,
    setCrmSnapshot,
    adminRequestAudit,
    resetAdminRequestAudit: resetAdminAudit,
    adminOrdersRealtimePending,
    adminOrdersRealtimeCount,
    refreshAdminOrdersFromRealtime: () => loadActiveOrdersSnapshot({ force: true }),
    customerAdminTab,
    setCustomerAdminTab,
    selectedCustomerPhone,
    setSelectedCustomerPhone
  };
}
