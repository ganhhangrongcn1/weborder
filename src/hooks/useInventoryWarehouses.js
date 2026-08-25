import { useCallback, useEffect, useState } from "react";
import {
  archiveInventoryWarehouse,
  canWriteInventoryWarehouses,
  publishInventoryWarehouseDrafts,
  saveInventoryWarehouse,
  readInventoryWarehouses
} from "../services/inventoryWarehouseService.js";

const INITIAL_STATE = {
  status: "idle",
  code: "",
  message: "",
  warehouses: [],
  loadedAt: ""
};

export default function useInventoryWarehouses({ enabled = false, branchUuid = "" } = {}) {
  const [state, setState] = useState(INITIAL_STATE);
  const [mutation, setMutation] = useState({ status: "idle", message: "" });

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setState((current) => ({ ...current, status: "loading", message: "" }));
    const result = await readInventoryWarehouses({ branchUuid });
    setState({
      status: result.status || (result.ok ? "ready" : "error"),
      code: result.code || "",
      message: result.message || "",
      warehouses: result.warehouses || [],
      loadedAt: result.ok ? new Date().toISOString() : ""
    });
  }, [branchUuid, enabled]);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState(INITIAL_STATE);
      return () => {
        active = false;
      };
    }

    setState((current) => ({ ...current, status: "loading", message: "" }));
    readInventoryWarehouses({ branchUuid }).then((result) => {
      if (!active) return;
      setState({
        status: result.status || (result.ok ? "ready" : "error"),
        code: result.code || "",
        message: result.message || "",
        warehouses: result.warehouses || [],
        loadedAt: result.ok ? new Date().toISOString() : ""
      });
    });

    return () => {
      active = false;
    };
  }, [branchUuid, enabled]);

  const save = useCallback(async ({ id = "", input = {} } = {}) => {
    setMutation({ status: "saving", message: "" });
    try {
      const warehouse = await saveInventoryWarehouse({ id, input });
      setMutation({ status: "success", message: id ? "Kho đã được cập nhật." : "Kho mới đã được tạo trên Supabase." });
      await refresh();
      return warehouse;
    } catch (error) {
      setMutation({ status: "error", message: error.message || "Không thể tạo kho." });
      throw error;
    }
  }, [refresh]);

  const archive = useCallback(async (id) => {
    setMutation({ status: "saving", message: "" });
    try {
      await archiveInventoryWarehouse(id);
      setMutation({ status: "success", message: "Kho đã được lưu trữ." });
      await refresh();
    } catch (error) {
      setMutation({ status: "error", message: error.message || "Không thể lưu trữ kho." });
      throw error;
    }
  }, [refresh]);

  const publishDrafts = useCallback(async (drafts = []) => {
    setMutation({ status: "saving", message: "" });
    try {
      const result = await publishInventoryWarehouseDrafts({
        drafts,
        existingWarehouses: state.warehouses
      });
      setMutation({
        status: "success",
        message: `Đã đưa ${result.publishedDraftIds.length} bản nháp lên Supabase.`
      });
      await refresh();
      return result;
    } catch (error) {
      setMutation({ status: "error", message: error.message || "Không thể chuyển bản nháp lên Supabase." });
      throw error;
    }
  }, [refresh, state.warehouses]);

  return {
    ...state,
    refresh,
    save,
    publishDrafts,
    archive,
    writeEnabled: canWriteInventoryWarehouses(),
    mutationStatus: mutation.status,
    mutationMessage: mutation.message
  };
}
