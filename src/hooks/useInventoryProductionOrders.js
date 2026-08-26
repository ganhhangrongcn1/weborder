import { useCallback, useEffect, useState } from "react";
import {
  cancelInventoryProductionOrder,
  canWriteInventoryProduction,
  completeInventoryProductionOrder,
  deleteInventoryProductionDraft,
  readInventoryProductionOrders,
  saveInventoryProductionDraft,
  startInventoryProductionOrder
} from "../services/inventoryProductionService.js";

export default function useInventoryProductionOrders({ enabled = false } = {}) {
  const [state, setState] = useState({
    status: enabled ? "loading" : "idle",
    rows: [],
    permissions: { canManage: false },
    message: "",
    loadedAt: ""
  });
  const [mutationStatus, setMutationStatus] = useState("idle");
  const [mutationMessage, setMutationMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventoryProductionOrders();
    setState({
      status: result.status,
      rows: result.rows || [],
      permissions: result.permissions || { canManage: false },
      message: result.message || "",
      loadedAt: new Date().toISOString()
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
      setMutationMessage(error?.message || "Không thể cập nhật lệnh sản xuất/sơ chế.");
      throw error;
    }
  }, [refresh]);

  return {
    ...state,
    writeEnabled: canWriteInventoryProduction(),
    mutationStatus,
    mutationMessage,
    refresh,
    saveDraft: (input) => runMutation(() => saveInventoryProductionDraft(input), "Đã lưu bản nháp."),
    start: (orderId) => runMutation(() => startInventoryProductionOrder(orderId), "Đã bắt đầu thực hiện."),
    complete: (order, input) => runMutation(() => completeInventoryProductionOrder(order, input), "Đã hoàn thành lệnh và cập nhật tồn kho."),
    cancel: (orderId, reason) => runMutation(() => cancelInventoryProductionOrder(orderId, reason), "Đã hủy lệnh."),
    deleteDraft: (orderId) => runMutation(() => deleteInventoryProductionDraft(orderId), "Đã xóa bản nháp.")
  };
}
