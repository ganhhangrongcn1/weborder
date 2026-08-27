import { useCallback, useEffect, useState } from "react";
import {
  canWriteInventoryOpeningBalances,
  createInventoryOpeningBalance,
  readInventoryOpeningBalances
} from "../services/inventoryOpeningBalanceService.js";

const INITIAL_STATE = { status: "idle", code: "", message: "", rows: [], loadedAt: "" };

export default function useInventoryOpeningBalances({ enabled = false } = {}) {
  const [state, setState] = useState(INITIAL_STATE);
  const [mutation, setMutation] = useState({ status: "idle", message: "" });

  const applyResult = useCallback((result) => {
    setState({
      status: result.status || (result.ok ? "ready" : "error"),
      code: result.code || "",
      message: result.message || "",
      rows: result.rows || [],
      loadedAt: result.ok ? new Date().toISOString() : ""
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    applyResult(await readInventoryOpeningBalances());
  }, [applyResult, enabled]);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState(INITIAL_STATE);
      return () => { active = false; };
    }
    setState((current) => ({ ...current, status: "loading", message: "" }));
    readInventoryOpeningBalances().then((result) => {
      if (active) applyResult(result);
    });
    return () => { active = false; };
  }, [applyResult, enabled]);

  const create = useCallback(async (input) => {
    setMutation({ status: "saving", message: "" });
    try {
      const result = await createInventoryOpeningBalance(input);
      setMutation({ status: "success", message: "Đã ghi nhận tồn đầu kỳ và giá vốn cho kho." });
      await refresh();
      return result;
    } catch (error) {
      setMutation({ status: "error", message: error.message || "Không thể ghi nhận tồn đầu kỳ." });
      throw error;
    }
  }, [refresh]);

  return {
    ...state,
    refresh,
    create,
    writeEnabled: canWriteInventoryOpeningBalances(),
    mutationStatus: mutation.status,
    mutationMessage: mutation.message
  };
}
