import { useCallback, useEffect, useRef, useState } from "react";
import { canWriteSalesDeductionSettings, readSalesDeductionSettings, saveSalesDeductionSetting } from "../services/inventorySalesDeductionService.js";

export default function useInventorySalesDeductionSettings() {
  const [state, setState] = useState({ rows: [], canManage: false, status: "loading", message: "" });
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setState((value) => ({ ...value, status: "loading", message: "" }));
    try {
      const result = await readSalesDeductionSettings();
      if (request === generation.current) setState({ ...result, status: "ready", message: "" });
      return result;
    } catch (error) {
      if (request === generation.current) setState((value) => ({ ...value, status: "error", message: error.message }));
      return null;
    }
  }, []);
  useEffect(() => { refresh(); return () => { generation.current += 1; }; }, [refresh]);
  const save = async (row, enabled) => {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    try {
      await saveSalesDeductionSetting(row, enabled);
      const result = await refresh();
      if (!result || result.rows.find((item) => item.branchUuid === row.branchUuid)?.enabled !== enabled) {
        throw new Error("Đã gửi cài đặt nhưng chưa xác nhận được khi tải lại. Anh tải lại trước khi thao tác tiếp.");
      }
      return true;
    } catch (error) {
      setState((value) => ({ ...value, status: "error", message: error.message }));
      return false;
    } finally { busy.current = false; setSaving(false); }
  };
  return { ...state, refresh, save, saving, writeEnabled: canWriteSalesDeductionSettings() };
}
