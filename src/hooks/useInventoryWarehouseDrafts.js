import { useCallback, useState } from "react";
import {
  createInventoryWarehouseDraft,
  listInventoryWarehouseDrafts,
  removeInventoryWarehouseDrafts,
  reconcileInventoryWarehouseDrafts
} from "../services/inventoryWarehouseDraftService.js";

export default function useInventoryWarehouseDrafts() {
  const [drafts, setDrafts] = useState(() => listInventoryWarehouseDrafts());

  const createDraft = useCallback(async (input) => {
    const created = createInventoryWarehouseDraft(input);
    setDrafts(listInventoryWarehouseDrafts());
    return created;
  }, []);

  const removeDrafts = useCallback((ids = []) => {
    const rows = removeInventoryWarehouseDrafts(ids);
    setDrafts(rows);
    return rows;
  }, []);

  const reconcilePublishedDrafts = useCallback((warehouses = []) => {
    const result = reconcileInventoryWarehouseDrafts(warehouses);
    setDrafts(result.drafts);
    return result;
  }, []);

  return { drafts, createDraft, removeDrafts, reconcilePublishedDrafts };
}
