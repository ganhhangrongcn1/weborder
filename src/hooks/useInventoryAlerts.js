import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMPTY_INVENTORY_ALERT_SOURCES,
  readInventoryAlertSources
} from "../services/inventoryAlertService.js";

const INITIAL_STATE = {
  status: "idle",
  code: "",
  message: "",
  sources: EMPTY_INVENTORY_ALERT_SOURCES,
  limited: false,
  loadedAt: ""
};

function createAlertState(result = {}) {
  return {
    status: result.status || (result.ok ? "ready" : "error"),
    code: result.code || "",
    message: result.message || "",
    sources: result.sources || EMPTY_INVENTORY_ALERT_SOURCES,
    limited: Boolean(result.limited),
    loadedAt: result.ok ? new Date().toISOString() : ""
  };
}

export default function useInventoryAlerts({ enabled = false, warehouseIds = [] } = {}) {
  const warehouseKey = useMemo(
    () => [...new Set(warehouseIds.map((value) => String(value || "").trim()).filter(Boolean))].sort().join(","),
    [warehouseIds]
  );
  const [state, setState] = useState(INITIAL_STATE);

  const load = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    setState(createAlertState(await readInventoryAlertSources({ warehouseIds: warehouseKey ? warehouseKey.split(",") : [] })));
  }, [enabled, warehouseKey]);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState(INITIAL_STATE);
      return () => { active = false; };
    }
    setState((current) => ({ ...current, status: "loading", message: "" }));
    readInventoryAlertSources({ warehouseIds: warehouseKey ? warehouseKey.split(",") : [] }).then((result) => {
      if (active) setState(createAlertState(result));
    });
    return () => { active = false; };
  }, [enabled, warehouseKey]);

  return { ...state, refresh: load };
}
