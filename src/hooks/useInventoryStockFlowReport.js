import { useCallback, useEffect, useState } from "react";
import { createDefaultInventoryDocumentFilters } from "../services/inventoryDocumentFilters.js";
import { readInventoryStockFlowReport } from "../services/inventoryStockFlowReportService.js";

const INITIAL_STATE = {
  status: "idle",
  code: "",
  message: "",
  rows: [],
  summary: null,
  totalCount: 0,
  pageCount: 1,
  loadedAt: ""
};

export default function useInventoryStockFlowReport({ enabled = false, warehouseId = "" } = {}) {
  const [filters, setFilters] = useState(() => ({
    ...createDefaultInventoryDocumentFilters(),
    warehouseId,
    itemId: "",
    groupId: "",
    search: "",
    pageSize: 100
  }));
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    setFilters((current) => current.warehouseId === warehouseId ? current : { ...current, warehouseId, page: 1 });
  }, [warehouseId]);

  const updateFilters = useCallback((patch = {}) => {
    setFilters((current) => ({
      ...current,
      ...patch,
      page: Object.prototype.hasOwnProperty.call(patch, "page") ? patch.page : 1
    }));
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventoryStockFlowReport(filters);
    setState({
      status: result.status || (result.ok ? "ready" : "error"),
      code: result.code || "",
      message: result.message || "",
      rows: result.rows || [],
      summary: result.summary || null,
      totalCount: result.totalCount || 0,
      pageCount: result.pageCount || 1,
      loadedAt: result.ok ? new Date().toISOString() : ""
    });
  }, [enabled, filters]);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState(INITIAL_STATE);
      return () => { active = false; };
    }
    setState((current) => ({ ...current, status: "loading", message: "" }));
    readInventoryStockFlowReport(filters).then((result) => {
      if (!active) return;
      setState({
        status: result.status || (result.ok ? "ready" : "error"),
        code: result.code || "",
        message: result.message || "",
        rows: result.rows || [],
        summary: result.summary || null,
        totalCount: result.totalCount || 0,
        pageCount: result.pageCount || 1,
        loadedAt: result.ok ? new Date().toISOString() : ""
      });
    });
    return () => { active = false; };
  }, [enabled, filters]);

  return { ...state, filters, updateFilters, refresh: load };
}
