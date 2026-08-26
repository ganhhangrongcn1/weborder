import { useCallback, useEffect, useState } from "react";
import {
  activateInventoryBom,
  archiveInventoryBom,
  canWriteInventoryBoms,
  deleteInventoryBomDraft,
  readInventoryBoms,
  saveInventoryBomDraft
} from "../services/inventoryBomService.js";

export default function useInventoryBoms({ enabled = false, items = [], units = [], warehouses = [] } = {}) {
  const [state, setState] = useState({
    status: enabled ? "loading" : "idle",
    rows: [],
    permissions: { canManage: false, canManageProduction: false },
    message: "",
    loadedAt: ""
  });
  const [mutationStatus, setMutationStatus] = useState("idle");
  const [mutationMessage, setMutationMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventoryBoms();
    setState({
      status: result.status,
      rows: result.rows || [],
      permissions: result.permissions || { canManage: false, canManageProduction: false },
      message: result.message || "",
      loadedAt: new Date().toISOString()
    });
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      setMutationMessage(error?.message || "Không thể cập nhật công thức chế biến.");
      throw error;
    }
  }, [refresh]);

  const saveDraft = useCallback((input) => runMutation(
    () => saveInventoryBomDraft({ input, items, units, warehouses, boms: state.rows }),
    "Đã lưu bản nháp công thức chế biến."
  ), [items, runMutation, state.rows, units, warehouses]);

  const activate = useCallback((id) => runMutation(
    () => activateInventoryBom(id),
    "Đã kích hoạt công thức chế biến."
  ), [runMutation]);

  const archive = useCallback((bom) => runMutation(
    () => archiveInventoryBom(bom),
    "Đã lưu trữ công thức chế biến."
  ), [runMutation]);

  const deleteDraft = useCallback((bom) => runMutation(
    () => deleteInventoryBomDraft(bom),
    "Đã xóa bản nháp công thức chế biến."
  ), [runMutation]);

  return {
    ...state,
    writeEnabled: canWriteInventoryBoms(),
    mutationStatus,
    mutationMessage,
    refresh,
    saveDraft,
    activate,
    deleteDraft,
    archive
  };
}
