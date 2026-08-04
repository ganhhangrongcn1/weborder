import { useCallback, useEffect, useMemo, useState } from "react";
import { PREVIEW_DATA } from "../data/previewData.js";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import {
  createItem,
  createItemGroup,
  createPurchaseReceipt,
  createSupplier,
  createUnit,
  createWarehouse,
  getCurrentInventoryAccess,
  listItemGroups,
  listItemWarehouseNorms,
  listItems,
  listRecentDocuments,
  listStaffAccess,
  listStockBalances,
  listSuppliers,
  listUnits,
  listWarehouses,
  saveItemWarehouseNorm
} from "../services/inventoryRepository.js";

const EMPTY_DATA = {
  warehouses: [],
  balances: [],
  documents: [],
  items: [],
  suppliers: [],
  staff: [],
  units: [],
  groups: [],
  itemWarehouseNorms: []
};

export function useInventoryApp() {
  const previewMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  const [session, setSession] = useState(previewMode ? { user: { id: "preview-owner" } } : null);
  const [access, setAccess] = useState(previewMode ? [{ role: "owner", warehouse_id: null }] : []);
  const [data, setData] = useState(previewMode ? PREVIEW_DATA : EMPTY_DATA);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [loading, setLoading] = useState(previewMode ? false : isSupabaseConfigured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (previewMode || !supabase) return undefined;
    let active = true;

    supabase.auth.getSession().then(({ data: authData }) => {
      if (!active) return;
      setSession(authData.session || null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [previewMode]);

  const loadData = useCallback(async () => {
    if (previewMode) {
      setData(PREVIEW_DATA);
      return;
    }
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const currentAccess = await getCurrentInventoryAccess();
      setAccess(currentAccess.access);
      const allowedWarehouseIds = currentAccess.access.map((entry) => entry.warehouse_id).filter(Boolean);
      const isAdmin = currentAccess.access.some((entry) => entry.role === "owner" || entry.role === "admin");
      const canManagePurchasing = currentAccess.access.some((entry) =>
        ["owner", "admin", "central_manager"].includes(entry.role)
      );
      const initialWarehouseId = selectedWarehouseId || (isAdmin ? "" : allowedWarehouseIds[0] || "");

      const [warehouses, balances, documents, items, suppliers, staff, units, groups, itemWarehouseNorms] = await Promise.all([
        listWarehouses(),
        listStockBalances(initialWarehouseId),
        listRecentDocuments(initialWarehouseId),
        listItems(),
        canManagePurchasing ? listSuppliers() : Promise.resolve([]),
        isAdmin ? listStaffAccess() : Promise.resolve([]),
        listUnits(),
        listItemGroups(),
        listItemWarehouseNorms(initialWarehouseId)
      ]);

      setSelectedWarehouseId(initialWarehouseId);
      setData({ ...EMPTY_DATA, warehouses, balances, documents, items, suppliers, staff, units, groups, itemWarehouseNorms });
    } catch (loadError) {
      setError(loadError.message || "Không thể tải dữ liệu kho.");
    } finally {
      setLoading(false);
    }
  }, [previewMode, selectedWarehouseId, session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentRole = useMemo(() => {
    if (previewMode || access.some((entry) => entry.role === "owner")) return "owner";
    if (access.some((entry) => entry.role === "admin")) return "admin";
    return access[0]?.role || "staff";
  }, [access, previewMode]);

  const selectWarehouse = useCallback((warehouseId) => {
    setSelectedWarehouseId(warehouseId);
  }, []);

  const createCatalogEntry = useCallback(async (type, input) => {
    if (previewMode) {
      const collection = type === "warehouse" ? "warehouses" : type === "supplier" ? "suppliers" : type === "unit" ? "units" : type === "group" ? "groups" : "items";
      const previewRow = {
        id: `preview-${type}-${Date.now()}`,
        code: input.code?.trim().toUpperCase() || `${type === "item" ? "HH" : "NHH"}-${Date.now().toString(36).toUpperCase()}`,
        name: input.name.trim(),
        warehouse_type: input.warehouseType,
        item_type: input.itemType,
        contact_name: input.contactName,
        phone: input.phone,
        address: input.address,
        description: input.description,
        tracks_inventory: input.tracksInventory,
        inventory_units: data.units.find((unit) => unit.id === input.baseUnitId) || null,
        inventory_item_groups: data.groups.find((group) => group.id === input.groupId) || null,
        minimum_stock: Number(input.minimumStock || 0),
        is_active: true
      };
      setData((current) => ({ ...current, [collection]: [...current[collection], previewRow] }));
      return previewRow;
    }
    const createActions = { warehouse: createWarehouse, supplier: createSupplier, unit: createUnit, group: createItemGroup, item: createItem };
    const createAction = createActions[type];
    if (!createAction) throw new Error("Danh mục này chưa hỗ trợ tạo mới.");
    const result = await createAction(input);
    await loadData();
    return result;
  }, [data.groups, data.units, loadData, previewMode]);

  const updateInventoryNorm = useCallback(async (input) => {
    if (!Number.isFinite(Number(input.minimumStock)) || Number(input.minimumStock) < 0) {
      throw new Error("Định mức tối thiểu phải là số từ 0 trở lên.");
    }
    if (previewMode) {
      const nextNorm = { item_id: input.itemId, warehouse_id: input.warehouseId, minimum_stock: Number(input.minimumStock) };
      setData((current) => ({
        ...current,
        itemWarehouseNorms: [...current.itemWarehouseNorms.filter((entry) => entry.item_id !== input.itemId || entry.warehouse_id !== input.warehouseId), nextNorm]
      }));
      return nextNorm;
    }
    const saved = await saveItemWarehouseNorm(input);
    await loadData();
    return saved;
  }, [loadData, previewMode]);

  const createReceipt = useCallback(async (input) => {
    if (!input.warehouseId) throw new Error("Vui lòng chọn kho nhận hàng.");
    if (!input.supplierId) throw new Error("Vui lòng chọn nhà cung cấp.");
    const validLines = input.lines.filter((line) => line.itemId && Number(line.quantity) > 0);
    if (!validLines.length) throw new Error("Phiếu nhập cần ít nhất một hàng hóa có số lượng lớn hơn 0.");
    if (previewMode) {
      const now = new Date().toISOString();
      const document = {
        id: `preview-receipt-${Date.now()}`,
        document_no: `NK-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${String(data.documents.length + 1).padStart(3, "0")}`,
        document_type: "purchase_receipt",
        status: "completed",
        destination_warehouse_id: input.warehouseId,
        supplier_id: input.supplierId || null,
        reference_no: input.referenceNo?.trim() || null,
        notes: input.notes?.trim() || null,
        total_amount: validLines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice || 0), 0),
        created_at: now,
        occurred_at: now
      };
      setData((current) => {
        const balances = [...current.balances];
        validLines.forEach((line) => {
          const index = balances.findIndex((entry) => entry.warehouse_id === input.warehouseId && entry.item_id === line.itemId);
          if (index >= 0) balances[index] = { ...balances[index], quantity: Number(balances[index].quantity || 0) + Number(line.quantity), updated_at: now };
          else {
            const item = current.items.find((entry) => entry.id === line.itemId);
            balances.push({ warehouse_id: input.warehouseId, item_id: line.itemId, quantity: Number(line.quantity), updated_at: now, inventory_items: item });
          }
        });
        return { ...current, balances, documents: [document, ...current.documents] };
      });
      return document;
    }
    const result = await createPurchaseReceipt({ ...input, lines: validLines });
    await loadData();
    return result;
  }, [data.documents.length, loadData, previewMode]);

  return {
    configured: isSupabaseConfigured,
    previewMode,
    session,
    currentRole,
    access,
    data,
    selectedWarehouseId,
    loading,
    error,
    reload: loadData,
    createCatalogEntry,
    updateInventoryNorm,
    createReceipt,
    selectWarehouse,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => previewMode ? Promise.resolve() : supabase.auth.signOut()
  };
}
