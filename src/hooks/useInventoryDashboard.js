import { useCallback, useEffect, useState } from "react";
import { EMPTY_DASHBOARD, readInventoryDashboard } from "../services/inventoryDashboardService.js";

const INITIAL_STATE = {
  status: "idle",
  code: "",
  message: "",
  data: EMPTY_DASHBOARD,
  loadedAt: ""
};

export default function useInventoryDashboard({ enabled = false } = {}) {
  const [state, setState] = useState(INITIAL_STATE);

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventoryDashboard();
    setState({
      status: result.status || (result.ok ? "ready" : "error"),
      code: result.code || "",
      message: result.message || "",
      data: result.data || EMPTY_DASHBOARD,
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
    readInventoryDashboard().then((result) => {
      if (!active) return;
      setState({
        status: result.status || (result.ok ? "ready" : "error"),
        code: result.code || "",
        message: result.message || "",
        data: result.data || EMPTY_DASHBOARD,
        loadedAt: result.ok ? new Date().toISOString() : ""
      });
    });
    return () => { active = false; };
  }, [enabled]);

  return { ...state, refresh: load };
}
