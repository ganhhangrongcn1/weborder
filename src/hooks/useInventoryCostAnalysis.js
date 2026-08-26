import { useCallback, useEffect, useState } from "react";
import { readInventoryCostAnalysis } from "../services/inventoryCostAnalysisService.js";
import { formatInventoryDateInput } from "../services/inventoryDocumentFilters.js";

function getInitialFilters() {
  const today = formatInventoryDateInput();
  return { dateFrom: today, dateTo: today };
}

const INITIAL_STATE = {
  status: "idle",
  message: "",
  salesRows: [],
  productionRows: [],
  summary: {},
  hasMore: false,
  permissions: { canView: false, roles: [] },
  loadedAt: ""
};

export default function useInventoryCostAnalysis({ enabled = false, warehouseIds = [], allowLocalAdmin = false } = {}) {
  const [state, setState] = useState(INITIAL_STATE);
  const [filters, setFilters] = useState(getInitialFilters);
  const warehouseKey = warehouseIds.join(",");

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventoryCostAnalysis({ ...filters, warehouseIds, allowLocalAdmin });
    setState({
      status: result.status || (result.ok ? "ready" : "error"),
      message: result.message || "",
      salesRows: result.salesRows || [],
      productionRows: result.productionRows || [],
      summary: result.summary || {},
      hasMore: result.hasMore === true,
      permissions: result.permissions || { canView: false, roles: [] },
      loadedAt: result.ok ? new Date().toISOString() : ""
    });
  }, [allowLocalAdmin, enabled, filters, warehouseKey]);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState(INITIAL_STATE);
      return () => { active = false; };
    }
    setState((current) => ({ ...current, status: "loading", message: "" }));
    readInventoryCostAnalysis({ ...filters, warehouseIds, allowLocalAdmin }).then((result) => {
      if (!active) return;
      setState({
        status: result.status || (result.ok ? "ready" : "error"),
        message: result.message || "",
        salesRows: result.salesRows || [],
        productionRows: result.productionRows || [],
        summary: result.summary || {},
        hasMore: result.hasMore === true,
        permissions: result.permissions || { canView: false, roles: [] },
        loadedAt: result.ok ? new Date().toISOString() : ""
      });
    });
    return () => { active = false; };
  }, [allowLocalAdmin, enabled, filters, warehouseKey]);

  return {
    ...state,
    filters,
    updateFilters: (patch) => setFilters((current) => ({ ...current, ...patch })),
    refresh: load
  };
}
