import { useCallback, useEffect, useMemo, useState } from "react";
import { readInventoryLotReport } from "../services/inventoryLotReportService.js";

const INITIAL_STATE = {
  status: "idle",
  code: "",
  message: "",
  rows: [],
  totalCount: 0,
  limited: false,
  loadedAt: ""
};

export default function useInventoryLotReport({ enabled = false, warehouseIds = [] } = {}) {
  const warehouseKey = useMemo(
    () => [...new Set(warehouseIds.map((value) => String(value || "").trim()).filter(Boolean))].sort().join(","),
    [warehouseIds]
  );
  const [state, setState] = useState(INITIAL_STATE);

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventoryLotReport({ warehouseIds: warehouseKey ? warehouseKey.split(",") : [] });
    setState({
      status: result.status || (result.ok ? "ready" : "error"),
      code: result.code || "",
      message: result.message || "",
      rows: result.rows || [],
      totalCount: result.totalCount || 0,
      limited: Boolean(result.limited),
      loadedAt: result.ok ? new Date().toISOString() : ""
    });
  }, [enabled, warehouseKey]);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState(INITIAL_STATE);
      return () => { active = false; };
    }
    setState((current) => ({ ...current, status: "loading", message: "" }));
    readInventoryLotReport({ warehouseIds: warehouseKey ? warehouseKey.split(",") : [] }).then((result) => {
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
  }, [enabled, warehouseKey]);

  return { ...state, refresh: load };
}
