import { useCallback, useEffect, useState } from "react";
import { readInventoryPendingInboundQuantities } from "../services/inventoryDocumentService.js";

const INITIAL_STATE = { status: "idle", rows: [], message: "" };

export default function useInventoryPendingInbound({ enabled = false, warehouseId = "", refreshKey = "" } = {}) {
  const [state, setState] = useState(INITIAL_STATE);
  const loadForWarehouse = useCallback(async (targetWarehouseId) => {
    const result = await readInventoryPendingInboundQuantities(targetWarehouseId);
    if (!result.ok) throw new Error(result.message || "Không tải được lượng hàng đang chờ nhận.");
    return result.rows || [];
  }, []);

  useEffect(() => {
    let active = true;
    if (!enabled || !warehouseId) {
      setState(INITIAL_STATE);
      return () => { active = false; };
    }
    setState((current) => ({ ...current, status: "loading", message: "" }));
    readInventoryPendingInboundQuantities(warehouseId).then((result) => {
      if (!active) return;
      setState({ status: result.ok ? "ready" : "error", rows: result.rows || [], message: result.message || "" });
    });
    return () => { active = false; };
  }, [enabled, warehouseId, refreshKey]);

  return { ...state, warehouseId, loadForWarehouse };
}
