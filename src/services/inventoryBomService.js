import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import { isInventoryRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";
import { normalizeInventoryBomDraft } from "./inventoryBomCalculations.js";

const BOM_SELECT = `
  id,code,output_item_id,version,yield_quantity,yield_unit_id,
  yield_conversion_to_base,yield_base_quantity,production_scope,
  default_warehouse_id,effective_from,effective_to,status,notes,metadata,
  created_at,updated_at,deleted_at,
  outputItem:inventory_items!inventory_boms_output_item_id_fkey(id,code,name,item_type,base_unit_id,purchase_unit_id,purchase_to_base_ratio,metadata,is_active),
  yieldUnit:inventory_units!inventory_boms_yield_unit_id_fkey(id,code,name,symbol,unit_type,base_unit_id,conversion_factor,is_active),
  defaultWarehouse:inventory_warehouses!inventory_boms_default_warehouse_id_fkey(id,code,name,warehouse_type,branch_uuid,department_code,is_active),
  components:inventory_bom_components(
    id,bom_id,component_item_id,quantity,unit_id,conversion_to_base,
    base_quantity,waste_percent,display_order,notes,created_at,updated_at,
    componentItem:inventory_items!inventory_bom_components_component_item_id_fkey(id,code,name,item_type,base_unit_id,purchase_unit_id,purchase_to_base_ratio,metadata,is_active),
    unit:inventory_units!inventory_bom_components_unit_id_fkey(id,code,name,symbol,unit_type,base_unit_id,conversion_factor,is_active)
  )
`;

const MISSING_CODES = new Set(["42P01", "PGRST202", "PGRST204", "PGRST205"]);

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function normalizeReference(value) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? { ...row } : {};
}

async function getInventoryClient() {
  return getSupabaseAdminAuthClient()
    || getSupabaseRuntimeClient()
    || await initSupabaseRuntimeClient();
}

async function getActorId(client) {
  const { data } = await client.auth.getSession();
  return toText(data?.session?.user?.id);
}

export function normalizeInventoryBom(row = {}) {
  const components = (Array.isArray(row.components) ? row.components : [])
    .map((component) => ({
      id: toText(component.id),
      bomId: toText(component.bom_id),
      componentItemId: toText(component.component_item_id),
      quantity: Number(component.quantity || 0),
      unitId: toText(component.unit_id),
      conversionToBase: Number(component.conversion_to_base || 1),
      baseQuantity: Number(component.base_quantity || 0),
      wastePercent: Number(component.waste_percent || 0),
      displayOrder: Number(component.display_order || 0),
      notes: toText(component.notes),
      componentItem: normalizeReference(component.componentItem),
      unit: normalizeReference(component.unit)
    }))
    .sort((left, right) => left.displayOrder - right.displayOrder);

  return {
    id: toText(row.id),
    code: toText(row.code),
    outputItemId: toText(row.output_item_id),
    version: Number(row.version || 1),
    yieldQuantity: Number(row.yield_quantity || 0),
    yieldUnitId: toText(row.yield_unit_id),
    yieldConversionToBase: Number(row.yield_conversion_to_base || 1),
    yieldBaseQuantity: Number(row.yield_base_quantity || 0),
    productionScope: toText(row.production_scope || "central"),
    defaultWarehouseId: toText(row.default_warehouse_id),
    effectiveFrom: toText(row.effective_from),
    effectiveTo: toText(row.effective_to),
    status: toText(row.status || "draft"),
    notes: toText(row.notes),
    metadata: row.metadata && typeof row.metadata === "object" ? { ...row.metadata } : {},
    outputItem: normalizeReference(row.outputItem),
    yieldUnit: normalizeReference(row.yieldUnit),
    defaultWarehouse: normalizeReference(row.defaultWarehouse),
    components,
    createdAt: toText(row.created_at),
    updatedAt: toText(row.updated_at),
    deletedAt: toText(row.deleted_at)
  };
}

export function getInventoryBomError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message);
  const normalizedMessage = message.toLowerCase();

  if (MISSING_CODES.has(code) || normalizedMessage.includes("does not exist") || normalizedMessage.includes("could not find")) {
    return {
      status: "setup",
      code: "inventory_bom_schema_missing",
      message: "Schema công thức chế biến chưa được triển khai trên Supabase đang chạy. Màn hình vẫn ở chế độ an toàn."
    };
  }

  if (code === "42501" || normalizedMessage.includes("permission denied") || normalizedMessage.includes("row-level security")) {
    return {
      status: "error",
      code: "inventory_bom_access_denied",
      message: "Tài khoản chưa có quyền xem hoặc quản lý công thức chế biến."
    };
  }

  if (code === "23505") {
    return { status: "error", code, message: "BOM hoặc phiên bản này đã tồn tại." };
  }

  return {
    status: "error",
    code: code || "inventory_bom_failed",
    message: message || "Không xử lý được dữ liệu công thức chế biến."
  };
}

export async function readInventoryBoms({ includeArchived = false } = {}) {
  const client = await getInventoryClient();
  if (!client) {
    return {
      ok: false,
      status: "setup",
      code: "supabase_not_ready",
      rows: [],
      message: "Chưa kết nối được Supabase cho phân hệ Kho."
    };
  }

  let query = client
    .from("inventory_boms")
    .select(BOM_SELECT)
    .order("updated_at", { ascending: false });
  if (!includeArchived) query = query.is("deleted_at", null);

  const { data, error } = await query.limit(500);
  recordAdminRequest("read inventory boms", "inventory_boms");
  if (error) return { ok: false, ...getInventoryBomError(error), rows: [] };

  const actorId = await getActorId(client);
  let roles = [];
  if (actorId) {
    const accessResult = await client
      .from("inventory_user_access")
      .select("role,warehouse_id")
      .eq("auth_user_id", actorId)
      .eq("is_active", true);
    if (!accessResult.error) roles = (accessResult.data || []).map((row) => toText(row.role));
  }
  const canManage = roles.some((role) => ["owner", "admin", "central_manager"].includes(role));

  return {
    ok: true,
    status: "ready",
    code: "",
    rows: (Array.isArray(data) ? data : []).map(normalizeInventoryBom),
    permissions: { canManage, canManageProduction: canManage },
    message: ""
  };
}

export function canWriteInventoryBoms() {
  return isInventoryRuntimeWriteEnabled();
}

export async function saveInventoryBomDraft({ input = {}, items = [], units = [], warehouses = [], boms = [] } = {}) {
  if (!canWriteInventoryBoms()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");

  const draft = normalizeInventoryBomDraft(input, { items, units, warehouses, boms });
  const { data, error } = await client.rpc("inventory_save_bom_draft", {
    p_bom_id: draft.id || null,
    p_output_item_id: draft.outputItemId,
    p_yield_quantity: draft.yieldQuantity,
    p_yield_unit_id: draft.yieldUnitId,
    p_production_scope: draft.productionScope,
    p_default_warehouse_id: draft.defaultWarehouseId || null,
    p_effective_from: draft.effectiveFrom,
    p_notes: draft.notes || null,
    p_components: draft.components.map((component) => ({
      componentItemId: component.componentItemId,
      quantity: component.quantity,
      unitId: component.unitId,
      wastePercent: component.wastePercent,
      displayOrder: component.displayOrder,
      notes: component.notes || null
    }))
  });
  recordAdminRequest(`${draft.id ? "update" : "create"} inventory bom`, "inventory_boms");
  if (error) throw new Error(getInventoryBomError(error).message);
  return toText(data);
}

export async function activateInventoryBom(id = "") {
  if (!canWriteInventoryBoms()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");

  const { data, error } = await client.rpc("inventory_activate_bom", { p_bom_id: toText(id) });
  recordAdminRequest("activate inventory bom", "inventory_boms");
  if (error) throw new Error(getInventoryBomError(error).message);
  return toText(data);
}

export async function deleteInventoryBomDraft(bom = {}) {
  if (!canWriteInventoryBoms()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  if (!bom?.id || bom.status !== "draft") {
    throw new Error("Chỉ bản nháp chưa áp dụng mới được xóa.");
  }
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");

  const { error } = await client.rpc("inventory_delete_bom_draft", { p_bom_id: toText(bom.id) });
  recordAdminRequest("delete inventory bom draft", "inventory_boms");
  if (error) throw new Error(getInventoryBomError(error).message);
  return true;
}

export async function archiveInventoryBom(bom = {}) {
  if (!canWriteInventoryBoms()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  if (!bom?.id || bom.status !== "inactive") {
    throw new Error("Chỉ công thức đã ngừng áp dụng mới được lưu trữ.");
  }
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const actorId = await getActorId(client);
  if (!actorId) throw new Error("Phiên đăng nhập Admin đã hết hạn.");

  const now = new Date().toISOString();
  const { error } = await client
    .from("inventory_boms")
    .update({ status: "inactive", deleted_at: now, deleted_by: actorId, updated_by: actorId })
    .eq("id", bom.id)
    .neq("status", "active");
  recordAdminRequest("archive inventory bom", "inventory_boms");
  if (error) throw new Error(getInventoryBomError(error).message);
  return true;
}

export default {
  activateInventoryBom,
  archiveInventoryBom,
  canWriteInventoryBoms,
  deleteInventoryBomDraft,
  readInventoryBoms,
  saveInventoryBomDraft
};
