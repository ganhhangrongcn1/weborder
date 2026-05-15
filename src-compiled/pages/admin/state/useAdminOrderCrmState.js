import { useEffect, useState } from "react";
import { buildCustomersFromOrdersAsync } from "../../../services/crmService.js";
import { STORAGE_KEYS } from "../../../services/repositories/storageKeys.js";

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
  const [customerAdminTab, setCustomerAdminTab] = useState("crm");
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState("");

  useEffect(() => {
    let disposed = false;
    const activeDateFrom = section === "orders" ? ordersDateFrom : section === "customers" ? customersDateFrom : dashboardDateFrom;
    const activeDateTo = section === "orders" ? ordersDateTo : section === "customers" ? customersDateTo : dashboardDateTo;

    const refreshOrdersOnly = async () => {
      const dateRange = buildDateRangeFromInputs(activeDateFrom, activeDateTo);
      try {
        const nextOrders = await orderStorage?.getAllAsync?.(dateRange);
        if (disposed) return;
        setOrdersSnapshot(Array.isArray(nextOrders) ? nextOrders : []);
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
        const nextOrders = await orderStorage?.getAllAsync?.(dateRange);
        if (disposed) return;
        setChartOrdersSnapshot(Array.isArray(nextOrders) ? nextOrders : []);
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
        const nextCrm = await buildCustomersFromOrdersAsync(orderStorage, { dateRange });
        if (disposed) return;
        setCrmSnapshot(nextCrm);
      } catch (error) {
        if (disposed) return;
        console.error("[admin][crm] failed to load snapshot", error);
      }
    };

    const refreshAll = async () => {
      const activeDateFrom = section === "orders" ? ordersDateFrom : section === "customers" ? customersDateFrom : dashboardDateFrom;
      const activeDateTo = section === "orders" ? ordersDateTo : section === "customers" ? customersDateTo : dashboardDateTo;
      const dateRange = buildDateRangeFromInputs(activeDateFrom, activeDateTo);
      const [ordersResult, crmResult] = await Promise.allSettled([
        orderStorage?.getAllAsync?.(dateRange),
        buildCustomersFromOrdersAsync(orderStorage, { dateRange })
      ]);
      if (disposed) return;
      const nextOrders = ordersResult.status === "fulfilled" ? ordersResult.value : [];
      const nextCrm = crmResult.status === "fulfilled" ? crmResult.value : { customers: [], loyaltyConfig: {} };
      if (ordersResult.status === "rejected") {
        console.error("[admin][orders] failed to load snapshot", ordersResult.reason);
      }
      if (crmResult.status === "rejected") {
        console.error("[admin][crm] failed to load snapshot", crmResult.reason);
      }
      setCrmSnapshot(nextCrm);
      setOrdersSnapshot(Array.isArray(nextOrders) ? nextOrders : []);
    };

    const handleStorageChange = (event) => {
      if (event.key === STORAGE_KEYS.ordersByPhone) refreshAll();
    };

    window.addEventListener("ghr:orders-changed", refreshAll);
    window.addEventListener("storage", handleStorageChange);
    refreshCrmOnly();

    return () => {
      disposed = true;
      window.removeEventListener("ghr:orders-changed", refreshAll);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [orderStorage, section, dashboardDateFrom, dashboardDateTo, ordersDateFrom, ordersDateTo, customersDateFrom, customersDateTo]);

  return {
    ordersSnapshot,
    setOrdersSnapshot,
    chartOrdersSnapshot,
    setChartOrdersSnapshot,
    crmSnapshot,
    setCrmSnapshot,
    customerAdminTab,
    setCustomerAdminTab,
    selectedCustomerPhone,
    setSelectedCustomerPhone
  };
}
