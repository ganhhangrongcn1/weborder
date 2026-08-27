import { useCallback, useEffect, useState } from "react";
import { createDefaultInventoryDocumentFilters } from "../services/inventoryDocumentFilters.js";
import { readInventoryLedger } from "../services/inventoryLedgerService.js";

const INITIAL_STATE = {
  status: "idle",
  code: "",
  message: "",
  rows: [],
  totalCount: 0,
  page: 1,
  pageSize: 50,
  pageCount: 1,
  summary: null,
  summaryLimited: false,
  loadedAt: ""
};

export default function useInventoryLedger({ enabled = false, warehouseId = "" } = {}) {
  const [state, setState] = useState(INITIAL_STATE);
  const [filters, setFilters] = useState(() => ({
    ...createDefaultInventoryDocumentFilters(),
    warehouseId,
    itemId: ""
  }));

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
    const result = await readInventoryLedger(filters);
    setState({
      status: result.status || (result.ok ? "ready" : "error"),
      code: result.code || "",
      message: result.message || "",
      rows: result.rows || [],
      totalCount: result.totalCount || 0,
      page: result.page || filters.page,
      pageSize: result.pageSize || filters.pageSize,
      pageCount: result.pageCount || 1,
      summary: result.summary || null,
      summaryLimited: Boolean(result.summaryLimited),
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
    readInventoryLedger(filters).then((result) => {
      if (!active) return;
      setState({
        status: result.status || (result.ok ? "ready" : "error"),
        code: result.code || "",
        message: result.message || "",
        rows: result.rows || [],
        totalCount: result.totalCount || 0,
        page: result.page || filters.page,
        pageSize: result.pageSize || filters.pageSize,
        pageCount: result.pageCount || 1,
        summary: result.summary || null,
        summaryLimited: Boolean(result.summaryLimited),
        loadedAt: result.ok ? new Date().toISOString() : ""
      });
    });
    return () => { active = false; };
  }, [enabled, filters]);

  return { ...state, filters, updateFilters, refresh: load };
}
