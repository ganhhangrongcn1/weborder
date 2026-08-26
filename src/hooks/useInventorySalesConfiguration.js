import { useCallback, useEffect, useState } from "react";
import {
  activateInventorySalesRecipe,
  canWriteInventorySalesConfiguration,
  deactivateInventorySalesRecipe,
  deleteInventoryChannelMapping,
  deleteInventorySalesRecipe,
  readInventorySalesConfiguration,
  readInventorySalesOrderEvents,
  retryInventorySalesOrderEvent,
  saveInventoryChannelMapping,
  saveInventorySalesRecipe
} from "../services/inventorySalesConfigurationService.js";

export default function useInventorySalesConfiguration({
  enabled = false,
  loadConfiguration = true,
  loadSalesEvents = false,
  menuEntities = [],
  items = [],
  units = []
} = {}) {
  const [state, setState] = useState({
    status: enabled && loadConfiguration ? "loading" : (enabled ? "ready" : "idle"),
    recipes: [],
    mappings: [],
    candidates: [],
    candidateMessage: "",
    averageCosts: {},
    salesEvents: [],
    salesEventMessage: "",
    permissions: { canManage: false },
    message: ""
  });
  const [mutationStatus, setMutationStatus] = useState("idle");
  const [mutationMessage, setMutationMessage] = useState("");
  const [salesEventStatus, setSalesEventStatus] = useState(loadSalesEvents ? "loading" : "idle");
  const [salesEventHasMore, setSalesEventHasMore] = useState(false);
  const [salesEventFilters, setSalesEventFilters] = useState(() => {
    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    return { dateFrom: localToday, dateTo: localToday, limit: 200 };
  });

  const refreshConfiguration = useCallback(async () => {
    if (!enabled || !loadConfiguration) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventorySalesConfiguration();
    setState((current) => ({
      ...current,
      status: result.status,
      recipes: result.recipes || [],
      mappings: result.mappings || [],
      candidates: result.candidates || [],
      candidateMessage: result.candidateMessage || "",
      averageCosts: result.averageCosts || {},
      permissions: result.permissions || { canManage: false },
      message: result.message || ""
    }));
  }, [enabled, loadConfiguration]);

  const refreshSalesEvents = useCallback(async () => {
    if (!enabled || !loadSalesEvents) return;
    setSalesEventStatus("loading");
    setState((current) => ({ ...current, salesEventMessage: "" }));
    const result = await readInventorySalesOrderEvents(salesEventFilters);
    setState((current) => ({
      ...current,
      salesEvents: result.rows || [],
      salesEventMessage: result.message || ""
    }));
    setSalesEventHasMore(result.hasMore === true);
    setSalesEventStatus(result.status || (result.ok ? "ready" : "error"));
  }, [enabled, loadSalesEvents, salesEventFilters]);

  const refresh = useCallback(async () => {
    await Promise.all([
      loadConfiguration ? refreshConfiguration() : Promise.resolve(),
      loadSalesEvents ? refreshSalesEvents() : Promise.resolve()
    ]);
  }, [loadConfiguration, loadSalesEvents, refreshConfiguration, refreshSalesEvents]);

  useEffect(() => { refreshConfiguration(); }, [refreshConfiguration]);
  useEffect(() => { refreshSalesEvents(); }, [refreshSalesEvents]);

  const runMutation = useCallback(async (action, successMessage) => {
    setMutationStatus("saving");
    setMutationMessage("");
    try {
      const result = await action();
      setMutationStatus("success");
      setMutationMessage(successMessage);
      await refresh();
      return result;
    } catch (error) {
      setMutationStatus("error");
      setMutationMessage(error?.message || "Không thể cập nhật cấu hình món bán.");
      throw error;
    }
  }, [refresh]);

  return {
    ...state,
    writeEnabled: canWriteInventorySalesConfiguration(),
    mutationStatus,
    mutationMessage,
    salesEventStatus,
    salesEventHasMore,
    salesEventFilters,
    updateSalesEventFilters: (nextFilters) => setSalesEventFilters((current) => ({ ...current, ...nextFilters })),
    refresh,
    saveRecipe: (input) => runMutation(
      () => saveInventorySalesRecipe({ input, menuEntities, items, units }),
      "Đã lưu bản nháp định lượng món bán."
    ),
    activateRecipe: (id) => runMutation(
      () => activateInventorySalesRecipe(id),
      "Đã áp dụng định lượng món bán."
    ),
    deactivateRecipe: (id) => runMutation(
      () => deactivateInventorySalesRecipe(id),
      "Đã ngừng áp dụng định lượng món bán."
    ),
    deleteRecipe: (id) => runMutation(
      () => deleteInventorySalesRecipe(id),
      "Đã xóa bản nháp định lượng."
    ),
    saveMapping: (input) => runMutation(
      () => saveInventoryChannelMapping({ input, menuEntities }),
      "Đã lưu ánh xạ kênh bán."
    ),
    deleteMapping: (id) => runMutation(
      () => deleteInventoryChannelMapping(id),
      "Đã xóa ánh xạ kênh bán."
    ),
    retrySalesEvent: (id) => runMutation(
      () => retryInventorySalesOrderEvent(id),
      "Đã đưa đơn vào hàng chờ xử lý lại."
    )
  };
}
