import { supabase } from "../lib/supabaseClient.js";

function requireClient() {
  if (!supabase) throw new Error("Ứng dụng chưa được cấu hình kết nối Supabase.");
  return supabase;
}

async function queryOrThrow(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getCurrentInventoryAccess() {
  const client = requireClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return { user: null, access: [] };

  const access = await queryOrThrow(
    client
      .from("inventory_user_access")
      .select("id, role, warehouse_id, is_active, inventory_warehouses(id, code, name, warehouse_type, is_active)")
      .eq("auth_user_id", authData.user.id)
      .eq("is_active", true)
  );

  return { user: authData.user, access };
}

export async function listWarehouses() {
  return queryOrThrow(
    requireClient()
      .from("inventory_warehouses")
      .select("id, code, name, warehouse_type, address, is_active")
      .eq("is_active", true)
      .order("name")
  );
}

export async function listStockBalances(warehouseId) {
  let query = requireClient()
    .from("inventory_stock_balances")
    .select("warehouse_id, item_id, quantity, updated_at, inventory_items(id, code, name, item_type, tracks_inventory, minimum_stock, inventory_units(code, name))")
    .order("updated_at", { ascending: false });

  if (warehouseId) query = query.eq("warehouse_id", warehouseId);
  return queryOrThrow(query.limit(200));
}

export async function listRecentDocuments(warehouseId) {
  let query = requireClient()
    .from("inventory_documents")
    .select("id, document_no, document_type, status, source_warehouse_id, destination_warehouse_id, occurred_at, created_at")
    .order("created_at", { ascending: false });

  if (warehouseId) {
    query = query.or(`source_warehouse_id.eq.${warehouseId},destination_warehouse_id.eq.${warehouseId}`);
  }
  return queryOrThrow(query.limit(20));
}

export async function listItems() {
  return queryOrThrow(
    requireClient()
      .from("inventory_items")
      .select("id, code, name, item_type, is_active, tracks_inventory, minimum_stock, notes, inventory_units(id, code, name), inventory_item_groups(id, name)")
      .eq("is_active", true)
      .order("name")
      .limit(300)
  );
}

export async function listUnits() {
  return queryOrThrow(
    requireClient()
      .from("inventory_units")
      .select("id, code, name, description, unit_type, is_active")
      .order("name")
  );
}

export async function listItemGroups() {
  return queryOrThrow(
    requireClient()
      .from("inventory_item_groups")
      .select("id, code, name, description")
      .eq("is_active", true)
      .order("name")
  );
}

export async function listSuppliers() {
  return queryOrThrow(
    requireClient()
      .from("inventory_suppliers")
      .select("id, code, name, contact_name, phone, is_active")
      .eq("is_active", true)
      .order("name")
      .limit(200)
  );
}

export async function listStaffAccess() {
  return queryOrThrow(
    requireClient()
      .from("inventory_user_access")
      .select("id, auth_user_id, role, is_active, warehouse_id, inventory_warehouses(id, name)")
      .order("created_at", { ascending: false })
      .limit(200)
  );
}

async function insertOne(table, payload) {
  const { data, error } = await requireClient().from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export function createWarehouse(input) {
  return insertOne("inventory_warehouses", {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    warehouse_type: input.warehouseType,
    address: input.address.trim() || null,
    supply_warehouse_id: input.supplyWarehouseId || null,
    allows_direct_receipt: Boolean(input.allowsDirectReceipt)
  });
}

export function createSupplier(input) {
  return insertOne("inventory_suppliers", {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    contact_name: input.contactName.trim() || null,
    phone: input.phone.trim() || null,
    address: input.address.trim() || null,
    payment_notes: input.paymentNotes.trim() || null
  });
}

export async function createItem(input) {
  const item = await insertOne("inventory_items", {
    code: input.code?.trim().toUpperCase() || createGeneratedCode("HH"),
    name: input.name.trim(),
    item_type: input.itemType,
    group_id: input.groupId || null,
    base_unit_id: input.baseUnitId,
    purchase_unit_id: input.purchaseUnitId || input.baseUnitId,
    purchase_to_base_ratio: Number(input.purchaseToBaseRatio || 1),
    minimum_stock: Number(input.minimumStock || 0),
    tracks_inventory: Boolean(input.tracksInventory),
    notes: input.description?.trim() || null
  });

  if (input.tracksInventory && input.warehouseIds?.length) {
    const { error } = await requireClient().from("inventory_item_warehouses").insert(
      input.warehouseIds.map((warehouseId) => ({ item_id: item.id, warehouse_id: warehouseId }))
    );
    if (error) throw error;
  }

  return item;
}

export async function listItemWarehouseNorms(warehouseId) {
  let query = requireClient()
    .from("inventory_item_warehouses")
    .select("item_id, warehouse_id, minimum_stock")
    .order("warehouse_id");
  if (warehouseId) query = query.eq("warehouse_id", warehouseId);
  return queryOrThrow(query.limit(1000));
}

export async function saveItemWarehouseNorm({ itemId, warehouseId, minimumStock }) {
  const payload = {
    item_id: itemId,
    warehouse_id: warehouseId,
    minimum_stock: Number(minimumStock)
  };
  const { data, error } = await requireClient()
    .from("inventory_item_warehouses")
    .upsert(payload, { onConflict: "item_id,warehouse_id" })
    .select("item_id, warehouse_id, minimum_stock")
    .single();
  if (error) throw error;
  return data;
}

export async function createPurchaseReceipt(input) {
  const lines = input.lines.map((line) => ({
    item_id: line.itemId,
    unit_id: line.unitId,
    quantity: Number(line.quantity),
    unit_price: Number(line.unitPrice || 0)
  }));
  const { data, error } = await requireClient().rpc("create_inventory_purchase_receipt", {
    p_destination_warehouse_id: input.warehouseId,
    p_supplier_id: input.supplierId || null,
    p_reference_no: input.referenceNo?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_lines: lines
  });
  if (error) throw error;
  return data;
}

function createGeneratedCode(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function createUnit(input) {
  return insertOne("inventory_units", {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    unit_type: "other",
    decimal_places: 3
  });
}

export function createItemGroup(input) {
  return insertOne("inventory_item_groups", {
    code: input.code?.trim().toUpperCase() || createGeneratedCode("NHH"),
    name: input.name.trim(),
    description: input.description?.trim() || null
  });
}

