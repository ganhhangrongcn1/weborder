import { useCallback, useEffect, useState } from "react";
import {
  activateInventorySalesRecipe,
  canWriteInventorySalesConfiguration,
  deleteInventoryChannelMapping,
  deleteInventorySalesRecipe,
  readInventorySalesConfiguration,
  saveInventoryChannelMapping,
  saveInventorySalesRecipe
} from "../services/inventorySalesConfigurationService.js";

export default function useInventorySalesConfiguration({
  enabled = false,
  menuEntities = [],
  items = [],
  units = []
} = {}) {
  const [state, setState] = useState({
    status: enabled ? "loading" : "idle",
    recipes: [],
    mappings: [],
    candidates: [],
    candidateMessage: "",
    averageCosts: {},
    permissions: { canManage: false },
    message: ""
  });
  const [mutationStatus, setMutationStatus] = useState("idle");
  const [mutationMessage, setMutationMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventorySalesConfiguration();
    setState({
      status: result.status,
      recipes: result.recipes || [],
      mappings: result.mappings || [],
      candidates: result.candidates || [],
      candidateMessage: result.candidateMessage || "",
      averageCosts: result.averageCosts || {},
      permissions: result.permissions || { canManage: false },
      message: result.message || ""
    });
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh]);

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
    refresh,
    saveRecipe: (input) => runMutation(
      () => saveInventorySalesRecipe({ input, menuEntities, items, units }),
      "Đã lưu bản nháp định lượng món bán."
    ),
    activateRecipe: (id) => runMutation(
      () => activateInventorySalesRecipe(id),
      "Đã áp dụng định lượng món bán."
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
    )
  };
}
