import { useState } from "react";

function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayDateInputValue() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function useAdminUiState() {
  const [editingProduct, setEditingProduct] = useState(null);
  const [uiDirty, setUiDirty] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [dashboardDateFrom, setDashboardDateFrom] = useState(getTodayDateInputValue);
  const [dashboardDateTo, setDashboardDateTo] = useState(getTodayDateInputValue);
  const [dashboardDatePreset, setDashboardDatePreset] = useState("today");
  const [dashboardChartPreset, setDashboardChartPreset] = useState("7d");
  const [ordersDateFrom, setOrdersDateFrom] = useState(getTodayDateInputValue);
  const [ordersDateTo, setOrdersDateTo] = useState(getTodayDateInputValue);
  const [ordersDatePreset, setOrdersDatePreset] = useState("today");
  const [customersDateFrom, setCustomersDateFrom] = useState("");
  const [customersDateTo, setCustomersDateTo] = useState("");
  const [customersDatePreset, setCustomersDatePreset] = useState("all");
  const [adminGlobalSearch, setAdminGlobalSearch] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("all");

  return {
    editingProduct,
    setEditingProduct,
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
    getTodayDateInputValue,
    getYesterdayDateInputValue,
    adminGlobalSearch,
    setAdminGlobalSearch,
    selectedBranchFilter,
    setSelectedBranchFilter
  };
}
