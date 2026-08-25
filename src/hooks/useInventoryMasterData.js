import { useCallback, useEffect, useState } from "react";
import {
  archiveInventoryMasterData,
  canWriteInventoryMasterData,
  readInventoryMasterData,
  saveInventoryMasterData
} from "../services/inventoryMasterDataService.js";

const INITIAL_STATE = {
  status: "idle",
  code: "",
  message: "",
  rows: [],
  loadedAt: ""
};

export default function useInventoryMasterData({ enabled = false, domain = "" } = {}) {
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
    if (!enabled || !domain) return;
    setState((current) => ({ ...current, status: "loading", message: "" }));
    applyResult(await readInventoryMasterData({ domain }));
  }, [applyResult, domain, enabled]);

  useEffect(() => {
    let active = true;
    if (!enabled || !domain) {
      setState(INITIAL_STATE);
      return () => {
        active = false;
      };
    }

    setState((current) => ({ ...current, status: "loading", message: "" }));
    readInventoryMasterData({ domain }).then((result) => {
      if (active) applyResult(result);
    });

    return () => {
      active = false;
    };
  }, [applyResult, domain, enabled]);

  const save = useCallback(async ({ id = "", input = {} } = {}) => {
    setMutation({ status: "saving", message: "" });
    try {
      const saved = await saveInventoryMasterData({ domain, id, input });
      setMutation({ status: "success", message: id ? "Đã cập nhật dữ liệu." : "Đã tạo dữ liệu mới." });
      await refresh();
      return saved;
    } catch (error) {
      setMutation({ status: "error", message: error.message || "Không thể lưu dữ liệu." });
      throw error;
    }
  }, [domain, refresh]);

  const archive = useCallback(async (id) => {
    setMutation({ status: "saving", message: "" });
    try {
      await archiveInventoryMasterData({ domain, id });
      setMutation({ status: "success", message: "Đã lưu trữ dữ liệu." });
      await refresh();
    } catch (error) {
      setMutation({ status: "error", message: error.message || "Không thể lưu trữ dữ liệu." });
      throw error;
    }
  }, [domain, refresh]);

  return {
    ...state,
    refresh,
    save,
    archive,
    writeEnabled: canWriteInventoryMasterData(),
    mutationStatus: mutation.status,
    mutationMessage: mutation.message
  };
}
