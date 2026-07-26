import { useCallback, useEffect, useMemo, useState } from "react";
import { PREVIEW_DATA } from "../data/previewData.js";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import {
  createItem,
  createSupplier,
  createWarehouse,
  getCurrentInventoryAccess,
  listItemGroups,
  listItems,
  listRecentDocuments,
  listStaffAccess,
  listStockBalances,
  listSuppliers,
  listUnits,
  listWarehouses
} from "../services/inventoryRepository.js";

const EMPTY_DATA = {
  warehouses: [],
  balances: [],
  documents: [],
  items: [],
  suppliers: [],
  staff: [],
  units: [],
  groups: []
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

      const [warehouses, balances, documents, items, suppliers, staff, units, groups] = await Promise.all([
        listWarehouses(),
        listStockBalances(initialWarehouseId),
        listRecentDocuments(initialWarehouseId),
        listItems(),
        canManagePurchasing ? listSuppliers() : Promise.resolve([]),
        isAdmin ? listStaffAccess() : Promise.resolve([]),
        listUnits(),
        listItemGroups()
      ]);

      setSelectedWarehouseId(initialWarehouseId);
      setData({ ...EMPTY_DATA, warehouses, balances, documents, items, suppliers, staff, units, groups });
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
      const collection = type === "warehouse" ? "warehouses" : type === "supplier" ? "suppliers" : "items";
      const previewRow = {
        id: `preview-${type}-${Date.now()}`,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        warehouse_type: input.warehouseType,
        item_type: input.itemType,
        contact_name: input.contactName,
        phone: input.phone,
        address: input.address,
        inventory_units: data.units.find((unit) => unit.id === input.baseUnitId) || null,
        inventory_item_groups: data.groups.find((group) => group.id === input.groupId) || null,
        minimum_stock: Number(input.minimumStock || 0),
        is_active: true
      };
      setData((current) => ({ ...current, [collection]: [...current[collection], previewRow] }));
      return previewRow;
    }
    const createAction = type === "warehouse" ? createWarehouse : type === "supplier" ? createSupplier : createItem;
    const result = await createAction(input);
    await loadData();
    return result;
  }, [data.groups, data.units, loadData, previewMode]);

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
    selectWarehouse,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => previewMode ? Promise.resolve() : supabase.auth.signOut()
  };
}
