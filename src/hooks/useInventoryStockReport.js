import { useCallback, useEffect, useState } from "react";
import { readInventoryStockReport } from "../services/inventoryStockReportService.js";

const INITIAL_STATE = {
  status: "idle",
  code: "",
  message: "",
  rows: [],
  totalCount: 0,
  limited: false,
  loadedAt: ""
};

export default function useInventoryStockReport({ enabled = false } = {}) {
  const [state, setState] = useState(INITIAL_STATE);

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventoryStockReport();
    setState({
      status: result.status || (result.ok ? "ready" : "error"),
      code: result.code || "",
      message: result.message || "",
      rows: result.rows || [],
      totalCount: result.totalCount || 0,
      limited: Boolean(result.limited),
      loadedAt: result.ok ? new Date().toISOString() : ""
    });
  }, [enabled]);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState(INITIAL_STATE);
      return () => { active = false; };
    }
    setState((current) => ({ ...current, status: "loading", message: "" }));
    readInventoryStockReport().then((result) => {
      if (!active) return;
      setState({
        status: result.status || (result.ok ? "ready" : "error"),
        code: result.code || "",
        message: result.message || "",
        rows: result.rows || [],
        totalCount: result.totalCount || 0,
        limited: Boolean(result.limited),
        loadedAt: result.ok ? new Date().toISOString() : ""
      });
    });
    return () => { active = false; };
  }, [enabled]);

  return { ...state, refresh: load };
}
