import { useEffect, useState } from "react";
import { buildCustomersFromOrderListAsync } from "../../../services/crmService.js";
import { buildAdminOrderFeed, readPartnerOrdersForAdmin } from "../../../services/adminOrderFeedService.js";
import {
  getAdminRequestAuditSnapshot,
  recordAdminRequest,
  resetAdminRequestAudit
} from "../../../services/adminRequestAuditService.js";
import { STORAGE_KEYS } from "../../../services/repositories/storageKeys.js";

const SNAPSHOT_CACHE_TTL_MS = 8000;
const ordersSnapshotCache = new Map();
const ordersSnapshotInFlight = new Map();

function buildDateRangeFromInputs(dateFromValue = "", dateToValue = "") {
  const fromText = String(dateFromValue || "").trim();
  const toText = String(dateToValue || "").trim();
  if (!fromText && !toText) return {};

  const fromDate = fromText ? new Date(`${fromText}T00:00:00`) : null;
  const toDate = toText ? new Date(`${toText}T00:00:00`) : null;

  if (fromDate && Number.isNaN(fromDate.getTime())) return {};
  if (toDate && Number.isNaN(toDate.getTime())) return {};

  let start = fromDate;
  let end = toDate;
  if (start && end && start.getTime() > end.getTime()) {
    const temp = start;
    start = end;
    end = temp;
  }

  const range = {};
  if (start) {
    range.dateFrom = start.toISOString();
  }
  if (end) {
    const nextEnd = new Date(end);
    nextEnd.setDate(nextEnd.getDate() + 1);
    range.dateTo = nextEnd.toISOString();
  }
  return range;
}

function toDateInputText(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildChartRangeFromPreset(preset = "7d") {
  const now = new Date();
  const end = toDateInputText(now);
  if (preset === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return buildDateRangeFromInputs(toDateInputText(first), end);
  }
  const days = preset === "30d" ? 30 : 7;
  const start = new Date(now);
  start.setDate(now.getDate() - (days - 1));
  return buildDateRangeFromInputs(toDateInputText(start), end);
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

function getWebOrdersOnly(orders = []) {
  return (Array.isArray(orders) ? orders : []).filter((order) => order?.sourceType !== "partner");
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
    dashboardChartPreset = "7d"
  } = options || {};
  const [ordersSnapshot, setOrdersSnapshot] = useState([]);
  const [chartOrdersSnapshot, setChartOrdersSnapshot] = useState([]);
  const [crmSnapshot, setCrmSnapshot] = useState({ customers: [], loyaltyConfig: {} });
  const [adminRequestAudit, setAdminRequestAudit] = useState(() => getAdminRequestAuditSnapshot());
  const [customerAdminTab, setCustomerAdminTab] = useState("crm");
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState("");

  useEffect(() => {
    let disposed = false;
    const activeDateFrom = section === "orders" ? ordersDateFrom : section === "customers" ? customersDateFrom : dashboardDateFrom;
    const activeDateTo = section === "orders" ? ordersDateTo : section === "customers" ? customersDateTo : dashboardDateTo;

    const refreshOrdersOnly = async () => {
      const dateRange = buildDateRangeFromInputs(activeDateFrom, activeDateTo);
      try {
        const nextOrders = await loadOrdersSnapshot(orderStorage, dateRange, {
          includePartnerOrders: section === "dashboard" || section === "orders"
        });
        if (disposed) return;
        setOrdersSnapshot(Array.isArray(nextOrders) ? nextOrders : []);
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
  }, [orderStorage, section, dashboardDateFrom, dashboardDateTo, ordersDateFrom, ordersDateTo, customersDateFrom, customersDateTo]);

  useEffect(() => {
    let disposed = false;
    const refreshChartOrders = async () => {
      const dateRange = buildChartRangeFromPreset(dashboardChartPreset);
      try {
        const nextOrders = await loadOrdersSnapshot(orderStorage, dateRange, {
          includePartnerOrders: true
        });
        if (disposed) return;
        setChartOrdersSnapshot(Array.isArray(nextOrders) ? nextOrders : []);
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
  }, [orderStorage, dashboardChartPreset]);

  useEffect(() => {
    let disposed = false;

    const refreshCrmOnly = async () => {
      try {
        const activeDateFrom = section === "customers" ? customersDateFrom : dashboardDateFrom;
        const activeDateTo = section === "customers" ? customersDateTo : dashboardDateTo;
        const dateRange = buildDateRangeFromInputs(activeDateFrom, activeDateTo);
        const crmOrders = await loadOrdersSnapshot(orderStorage, dateRange, {
          includePartnerOrders: true
        });
        const nextCrm = await buildCustomersFromOrderListAsync(crmOrders, orderStorage, { dateRange });
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
      const dateRange = buildDateRangeFromInputs(activeDateFrom, activeDateTo);
      clearOrdersSnapshotCache();
      const ordersResult = await loadOrdersSnapshot(orderStorage, dateRange, {
        includePartnerOrders: true
      })
        .then((value) => ({ status: "fulfilled", value }))
        .catch((reason) => ({ status: "rejected", reason }));
      if (disposed) return;
      const combinedOrders = ordersResult.status === "fulfilled" ? ordersResult.value : [];
      const shouldRefreshCrm = section !== "orders";
      const crmResult = shouldRefreshCrm && ordersResult.status === "fulfilled"
        ? await buildCustomersFromOrderListAsync(combinedOrders, orderStorage, { dateRange })
            .then((value) => ({ status: "fulfilled", value }))
            .catch((reason) => ({ status: "rejected", reason }))
        : { status: "skipped", value: null };
      if (disposed) return;
      const nextOrders = section === "dashboard" || section === "orders" ? combinedOrders : getWebOrdersOnly(combinedOrders);
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

    const handleStorageChange = (event) => {
      if (event.key === STORAGE_KEYS.ordersByPhone) refreshAll();
    };

    window.addEventListener("ghr:orders-changed", refreshAll);
    window.addEventListener("storage", handleStorageChange);
    if (section !== "orders") {
      refreshCrmOnly();
    }

    return () => {
      disposed = true;
      window.removeEventListener("ghr:orders-changed", refreshAll);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [orderStorage, section, dashboardDateFrom, dashboardDateTo, ordersDateFrom, ordersDateTo, customersDateFrom, customersDateTo]);

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
    crmSnapshot,
    setCrmSnapshot,
    adminRequestAudit,
    resetAdminRequestAudit: resetAdminAudit,
    customerAdminTab,
    setCustomerAdminTab,
    selectedCustomerPhone,
    setSelectedCustomerPhone
  };
}
