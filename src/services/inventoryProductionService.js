import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import { isInventoryRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";

const PRODUCTION_SELECT = `
  id,order_no,bom_id,output_item_id,warehouse_id,output_unit_id,
  output_conversion_to_base,planned_output_quantity,actual_output_quantity,
  status,notes,estimated_total_cost,actual_total_cost,actual_unit_cost,
  output_lot_number,output_manufactured_on,output_expires_on,
  input_document_id,output_document_id,created_at,updated_at,started_at,completed_at,
  cancelled_at,cancellation_reason,
  bom:inventory_boms!inventory_production_orders_bom_id_fkey(id,code,version,production_scope,yield_quantity,yield_unit_id),
  outputItem:inventory_items!inventory_production_orders_output_item_id_fkey(id,code,name,item_type,base_unit_id,metadata,is_active),
  warehouse:inventory_warehouses!inventory_production_orders_warehouse_id_fkey(id,code,name,warehouse_type,branch_uuid,is_active),
  outputUnit:inventory_units!inventory_production_orders_output_unit_id_fkey(id,code,name,symbol,unit_type,base_unit_id,conversion_factor,is_active),
  lines:inventory_production_order_lines(
    id,production_order_id,item_id,unit_id,conversion_to_base,waste_percent,
    planned_quantity,planned_base_quantity,actual_quantity,actual_base_quantity,
    unit_cost,line_total_cost,display_order,
    item:inventory_items!inventory_production_order_lines_item_id_fkey(id,code,name,item_type,base_unit_id,metadata,is_active),
    unit:inventory_units!inventory_production_order_lines_unit_id_fkey(id,code,name,symbol,unit_type,base_unit_id,conversion_factor,is_active)
  )
`;

const MISSING_CODES = new Set(["42P01", "PGRST202", "PGRST204", "PGRST205"]);

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

export function getInventoryProductionScopeMeta(scope = "central") {
  const normalizedScope = toText(scope || "central");
  const isPreprocessing = ["branch", "department"].includes(normalizedScope);

  return {
    scope: normalizedScope,
    isPreprocessing,
    title: isPreprocessing ? "Lệnh sơ chế" : "Lệnh sản xuất",
    createLabel: isPreprocessing ? "Tạo lệnh sơ chế" : "Tạo lệnh sản xuất",
    processLabel: normalizedScope === "department"
      ? "Sơ chế tại kho bộ phận"
      : isPreprocessing
        ? "Sơ chế tại chi nhánh"
        : "Sản xuất/đóng gói tại Kho Tổng",
    warehouseLabel: isPreprocessing ? "Kho sơ chế" : "Kho sản xuất"
  };
}

function toLocalDateValue(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function getInventoryProductionExpiryConfig(item = {}, referenceDate = new Date()) {
  const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const trackExpiry = item.trackExpiry === true || metadata.track_expiry === true;
  const shelfLifeDays = Math.max(0, Math.trunc(Number(item.shelfLifeDays ?? metadata.shelf_life_days ?? 0)));
  const manufacturedOn = toLocalDateValue(referenceDate);
  const expiryDate = new Date(referenceDate);
  expiryDate.setDate(expiryDate.getDate() + shelfLifeDays);

  return {
    trackExpiry,
    shelfLifeDays,
    manufacturedOn,
    suggestedExpiresOn: trackExpiry && shelfLifeDays > 0 ? toLocalDateValue(expiryDate) : ""
  };
}

function one(value) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? { ...row } : {};
}

function createOperationKey(operation, orderId) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `production:${operation}:${orderId}:${suffix}`;
}

async function getInventoryClient() {
  return getSupabaseAdminAuthClient()
    || getSupabaseRuntimeClient()
    || await initSupabaseRuntimeClient();
}

async function getActorRoles(client) {
  const { data } = await client.auth.getSession();
  const actorId = toText(data?.session?.user?.id);
  if (!actorId) return [];
  const result = await client
    .from("inventory_user_access")
    .select("role,warehouse_id")
    .eq("auth_user_id", actorId)
    .eq("is_active", true);
  return result.error ? [] : (result.data || []).map((row) => toText(row.role));
}

export function normalizeInventoryProductionOrder(row = {}) {
  const bom = one(row.bom);
  return {
    id: toText(row.id),
    orderNo: toText(row.order_no),
    bomId: toText(row.bom_id),
    outputItemId: toText(row.output_item_id),
    warehouseId: toText(row.warehouse_id),
    outputUnitId: toText(row.output_unit_id),
    outputConversionToBase: Number(row.output_conversion_to_base || 1),
    plannedOutputQuantity: Number(row.planned_output_quantity || 0),
    actualOutputQuantity: row.actual_output_quantity == null ? null : Number(row.actual_output_quantity),
    status: toText(row.status || "draft"),
    notes: toText(row.notes),
    estimatedTotalCost: Number(row.estimated_total_cost || 0),
    actualTotalCost: row.actual_total_cost == null ? null : Number(row.actual_total_cost),
    actualUnitCost: row.actual_unit_cost == null ? null : Number(row.actual_unit_cost),
    outputLotNumber: toText(row.output_lot_number),
    outputManufacturedOn: toText(row.output_manufactured_on),
    outputExpiresOn: toText(row.output_expires_on),
    inputDocumentId: toText(row.input_document_id),
    outputDocumentId: toText(row.output_document_id),
    createdAt: toText(row.created_at),
    updatedAt: toText(row.updated_at),
    startedAt: toText(row.started_at),
    completedAt: toText(row.completed_at),
    cancelledAt: toText(row.cancelled_at),
    cancellationReason: toText(row.cancellation_reason),
    productionScope: toText(bom.production_scope || "central"),
    bom,
    outputItem: one(row.outputItem),
    warehouse: one(row.warehouse),
    outputUnit: one(row.outputUnit),
    lines: (Array.isArray(row.lines) ? row.lines : []).map((line) => ({
      id: toText(line.id),
      itemId: toText(line.item_id),
      unitId: toText(line.unit_id),
      conversionToBase: Number(line.conversion_to_base || 1),
      wastePercent: Number(line.waste_percent || 0),
      plannedQuantity: Number(line.planned_quantity || 0),
      plannedBaseQuantity: Number(line.planned_base_quantity || 0),
      actualQuantity: line.actual_quantity == null ? null : Number(line.actual_quantity),
      actualBaseQuantity: line.actual_base_quantity == null ? null : Number(line.actual_base_quantity),
      unitCost: line.unit_cost == null ? null : Number(line.unit_cost),
      lineTotalCost: line.line_total_cost == null ? null : Number(line.line_total_cost),
      displayOrder: Number(line.display_order || 0),
      item: one(line.item),
      unit: one(line.unit)
    })).sort((left, right) => left.displayOrder - right.displayOrder)
  };
}

function normalizeProductionError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message);
  const lower = message.toLowerCase();
  if (MISSING_CODES.has(code) || lower.includes("does not exist") || lower.includes("could not find")) {
    return { status: "setup", message: "Schema Lệnh sản xuất chưa được triển khai trên Supabase đang chạy." };
  }
  if (code === "42501" || lower.includes("permission denied") || lower.includes("row-level security")) {
    return { status: "error", message: "Tài khoản chưa có quyền xem hoặc xử lý lệnh sản xuất." };
  }
  return { status: "error", message: message || "Không xử lý được lệnh sản xuất." };
}

export function canWriteInventoryProduction() {
  return isInventoryRuntimeWriteEnabled();
}

export async function readInventoryProductionOrders() {
  const client = await getInventoryClient();
  if (!client) return { status: "setup", rows: [], permissions: { canManage: false }, message: "Chưa kết nối được Supabase cho phân hệ Kho." };
  const { data, error } = await client
    .from("inventory_production_orders")
    .select(PRODUCTION_SELECT)
    .order("created_at", { ascending: false })
    .limit(300);
  recordAdminRequest("read inventory production orders", "inventory_production_orders");
  if (error) return { ...normalizeProductionError(error), rows: [], permissions: { canManage: false } };
  const roles = await getActorRoles(client);
  return {
    status: "ready",
    rows: (data || []).map(normalizeInventoryProductionOrder),
    permissions: { canManage: roles.some((role) => ["owner", "admin", "central_manager", "branch_manager"].includes(role)) },
    message: ""
  };
}

async function callProductionRpc(name, payload, auditLabel) {
  if (!canWriteInventoryProduction()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { data, error } = await client.rpc(name, payload);
  recordAdminRequest(auditLabel, "inventory_production_orders");
  if (error) throw new Error(normalizeProductionError(error).message);
  return data;
}

export function saveInventoryProductionDraft(input = {}) {
  const bomId = toText(input.bomId);
  const warehouseId = toText(input.warehouseId);
  const plannedOutputQuantity = Number(input.plannedOutputQuantity);
  if (!bomId) throw new Error("Vui lòng chọn công thức chế biến.");
  if (!warehouseId) throw new Error("Vui lòng chọn kho thực hiện.");
  if (!Number.isFinite(plannedOutputQuantity) || plannedOutputQuantity <= 0) throw new Error("Số lượng cần làm phải lớn hơn 0.");
  return callProductionRpc("inventory_save_production_order_draft", {
    p_order_id: toText(input.id) || null,
    p_bom_id: bomId,
    p_warehouse_id: warehouseId,
    p_planned_output_quantity: plannedOutputQuantity,
    p_notes: toText(input.notes) || null
  }, `${input.id ? "update" : "create"} production order draft`);
}

export function startInventoryProductionOrder(orderId) {
  return callProductionRpc("inventory_start_production_order", {
    p_order_id: orderId,
    p_idempotency_key: createOperationKey("start", orderId)
  }, "start production order");
}

export function completeInventoryProductionOrder(order, input = {}) {
  const actualOutputQuantity = Number(input.actualOutputQuantity);
  if (!Number.isFinite(actualOutputQuantity) || actualOutputQuantity <= 0) throw new Error("Số lượng thành phẩm thực nhận phải lớn hơn 0.");
  const expiryConfig = getInventoryProductionExpiryConfig(order.outputItem);
  const outputExpiresOn = toText(input.outputExpiresOn);
  if (expiryConfig.trackExpiry && !outputExpiresOn) throw new Error("Vui lòng nhập hạn sử dụng của bán thành phẩm đầu ra.");
  if (expiryConfig.trackExpiry && outputExpiresOn < expiryConfig.manufacturedOn) throw new Error("Hạn sử dụng đầu ra không được trước ngày hoàn thành.");
  return callProductionRpc("inventory_complete_production_order_with_lot", {
    p_order_id: order.id,
    p_actual_output_quantity: actualOutputQuantity,
    p_actual_inputs: (input.lines || []).map((line) => ({ lineId: line.id, actualQuantity: Number(line.actualQuantity) })),
    p_output_expires_on: expiryConfig.trackExpiry ? outputExpiresOn : null,
    p_idempotency_key: createOperationKey("complete", order.id)
  }, "complete production order");
}

export function cancelInventoryProductionOrder(orderId, reason) {
  return callProductionRpc("inventory_cancel_production_order", {
    p_order_id: orderId,
    p_reason: toText(reason),
    p_idempotency_key: createOperationKey("cancel", orderId)
  }, "cancel production order");
}

export function deleteInventoryProductionDraft(orderId) {
  return callProductionRpc("inventory_delete_production_order_draft", { p_order_id: orderId }, "delete production order draft");
}

export default {
  cancelInventoryProductionOrder,
  completeInventoryProductionOrder,
  deleteInventoryProductionDraft,
  readInventoryProductionOrders,
  saveInventoryProductionDraft,
  startInventoryProductionOrder
};
