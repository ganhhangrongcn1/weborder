import { useCallback, useEffect, useState } from "react";
import {
  approveAndCompleteInventoryCount,
  completeApprovedInventoryCount,
  createAndStartInventoryCount,
  readInventoryCounts,
  recordAndSubmitInventoryCount
} from "../services/inventoryCountService.js";
import { isInventoryRuntimeWriteEnabled } from "../services/supabase/runtimeFlags.js";
import { INVENTORY_NAVIGATION_COUNTS_CHANGED_EVENT } from "../services/inventoryDocumentService.js";

const INITIAL_STATE = { status: "idle", message: "", rows: [], permissions: {}, loadedAt: "" };

export default function useInventoryCounts({ enabled = false } = {}) {
  const [state, setState] = useState(INITIAL_STATE);
  const [mutation, setMutation] = useState({ status: "idle", message: "" });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventoryCounts();
    setState({ status: result.status || (result.ok ? "ready" : "error"), message: result.message || "", rows: result.rows || [], permissions: result.permissions || {}, loadedAt: result.ok ? new Date().toISOString() : "" });
  }, [enabled]);

  useEffect(() => {
    let active = true;
    if (!enabled) { setState(INITIAL_STATE); return () => { active = false; }; }
    readInventoryCounts().then((result) => {
      if (!active) return;
      setState({ status: result.status || (result.ok ? "ready" : "error"), message: result.message || "", rows: result.rows || [], permissions: result.permissions || {}, loadedAt: result.ok ? new Date().toISOString() : "" });
    });
    return () => { active = false; };
  }, [enabled]);

  const run = useCallback(async (action, successMessage) => {
    setMutation({ status: "saving", message: "" });
    try {
      const result = await action();
      setMutation({ status: "success", message: successMessage });
      await refresh();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new window.Event(INVENTORY_NAVIGATION_COUNTS_CHANGED_EVENT));
      }
      return result;
    } catch (error) {
      setMutation({ status: "error", message: error.message || "Không thể cập nhật kiểm kê." });
      throw error;
    }
  }, [refresh]);

  return {
    ...state,
    refresh,
    writeEnabled: isInventoryRuntimeWriteEnabled(),
    mutationStatus: mutation.status,
    mutationMessage: mutation.message,
    createAndStart: (input) => run(() => createAndStartInventoryCount(input), "Đã bắt đầu đợt kiểm kê."),
    recordAndSubmit: (id, lines) => run(() => recordAndSubmitInventoryCount(id, lines), "Đã lưu số đếm và gửi duyệt."),
    approveAndComplete: (id, lines) => run(() => approveAndCompleteInventoryCount(id, lines), "Đã duyệt chênh lệch và điều chỉnh tồn."),
    completeApproved: (id) => run(() => completeApprovedInventoryCount(id), "Đã hoàn tất kiểm kê và điều chỉnh tồn.")
  };
}
