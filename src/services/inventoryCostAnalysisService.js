import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import {
  buildInventoryProductionVarianceRows,
  buildInventorySalesCostRows,
  calculateInventoryCostAnalysisSummary
} from "./inventoryCostAnalysisCalculations.js";

const EVENT_LIMIT = 200;
const PRODUCTION_LIMIT = 300;
const MISSING_CODES = new Set(["42P01", "PGRST202", "PGRST204", "PGRST205"]);

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function canViewInventoryCostAnalysis({ profile = {}, inventoryRoles = [] } = {}) {
  const profileRole = toText(profile.role).toLowerCase();
  const profileStatus = toText(profile.status).toLowerCase();
  const profileBranchUuid = toText(profile.branchUuid || profile.branch_uuid);
  const roles = (inventoryRoles || []).map((role) => toText(role).toLowerCase()).filter(Boolean);
  const isGlobalAdmin = profileStatus === "active" && profileRole === "admin" && !profileBranchUuid;
  const isCentralInventoryManager = roles.some((role) => ["owner", "admin", "central_manager"].includes(role));
  return isGlobalAdmin || isCentralInventoryManager;
}

function addCalendarDays(value = "", days = 0) {
  const [year, month, day] = toText(value).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return "";
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function normalizeError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message);
  const normalized = message.toLowerCase();
  if (MISSING_CODES.has(code) || normalized.includes("does not exist") || normalized.includes("could not find")) {
    return { status: "setup", message: "Dữ liệu giá vốn chưa sẵn sàng trên Supabase đang chạy." };
  }
  if (code === "42501" || normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return { status: "error", message: "Tài khoản chưa có quyền xem giá vốn và đối chiếu kho." };
  }
  return { status: "error", message: message || "Không tải được báo cáo giá vốn." };
}

async function getInventoryClient() {
  return getSupabaseAdminAuthClient()
    || getSupabaseRuntimeClient()
    || await initSupabaseRuntimeClient();
}

export async function readInventoryCostAnalysisPermission({ allowLocalAdmin = false } = {}) {
  const client = await getInventoryClient();
  if (!client) {
    return {
      ok: allowLocalAdmin,
      canView: allowLocalAdmin,
      roles: allowLocalAdmin ? ["local_admin"] : [],
      message: allowLocalAdmin ? "" : "Chưa kết nối được Supabase để xác minh quyền giá vốn."
    };
  }

  const userResult = await client.auth.getUser();
  const actorId = toText(userResult.data?.user?.id);
  if (userResult.error || !actorId) {
    return {
      ok: allowLocalAdmin,
      canView: allowLocalAdmin,
      roles: allowLocalAdmin ? ["local_admin"] : [],
      message: allowLocalAdmin ? "" : "Không xác minh được tài khoản đang xem báo cáo giá vốn."
    };
  }

  const [profileResult, inventoryAccessResult] = await Promise.all([
    client
      .from("profiles")
      .select("role,status,branch_uuid")
      .eq("auth_user_id", actorId)
      .maybeSingle(),
    client
      .from("inventory_user_access")
      .select("role")
      .eq("auth_user_id", actorId)
      .eq("is_active", true)
  ]);
  const firstError = profileResult.error || inventoryAccessResult.error;
  if (firstError) {
    return { ok: false, canView: false, roles: [], ...normalizeError(firstError) };
  }

  const profileRole = toText(profileResult.data?.role).toLowerCase();
  const profileStatus = toText(profileResult.data?.status).toLowerCase();
  const profileBranchUuid = toText(profileResult.data?.branch_uuid);
  const inventoryRoles = (inventoryAccessResult.data || [])
    .map((row) => toText(row.role).toLowerCase())
    .filter(Boolean);
  const roles = [...new Set([profileRole, ...inventoryRoles].filter(Boolean))];
  const canView = canViewInventoryCostAnalysis({
    profile: { role: profileRole, status: profileStatus, branchUuid: profileBranchUuid },
    inventoryRoles
  });

  return {
    ok: true,
    canView,
    roles,
    message: canView ? "" : "Chỉ Admin toàn hệ thống hoặc Quản lý Kho Tổng được xem giá vốn và đối chiếu."
  };
}

function normalizeReference(value) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? { ...row } : {};
}

function normalizeEvent(row = {}) {
  return {
    id: toText(row.id),
    sourceType: toText(row.source_type),
    sourceOrderKey: toText(row.source_order_key),
    branchUuid: toText(row.branch_uuid),
    warehouseId: toText(row.warehouse_id),
    documentId: toText(row.document_id),
    occurredAt: toText(row.occurred_at),
    processedAt: toText(row.processed_at),
    lines: (row.lines || []).map((line) => ({
      id: toText(line.id),
      sourceLineKey: toText(line.source_line_key),
      sourceLineName: toText(line.source_line_name),
      menuEntityName: toText(line.menu_entity_name),
      recipeId: toText(line.recipe_id),
      itemId: toText(line.item_id),
      requiredQuantity: toNumber(line.required_quantity),
      lineStatus: toText(line.line_status)
    }))
  };
}

function normalizeMovement(row = {}) {
  return {
    id: toText(row.id),
    documentId: toText(row.document_id),
    documentLineId: toText(row.document_line_id),
    warehouseId: toText(row.warehouse_id),
    itemId: toText(row.item_id),
    direction: toText(row.direction),
    quantity: toNumber(row.quantity),
    unitCost: toNumber(row.unit_cost),
    occurredAt: toText(row.occurred_at)
  };
}

function normalizeRecipe(row = {}) {
  return {
    id: toText(row.id),
    code: toText(row.code),
    version: toNumber(row.version || 1),
    menuEntityName: toText(row.menu_entity_name)
  };
}

function normalizeProductionOrder(row = {}) {
  return {
    id: toText(row.id),
    orderNo: toText(row.order_no),
    bomId: toText(row.bom_id),
    outputItemId: toText(row.output_item_id),
    warehouseId: toText(row.warehouse_id),
    status: toText(row.status),
    plannedOutputQuantity: toNumber(row.planned_output_quantity),
    actualOutputQuantity: toNumber(row.actual_output_quantity),
    estimatedTotalCost: toNumber(row.estimated_total_cost),
    actualTotalCost: toNumber(row.actual_total_cost),
    actualUnitCost: toNumber(row.actual_unit_cost),
    outputLotNumber: toText(row.output_lot_number),
    completedAt: toText(row.completed_at),
    bom: normalizeReference(row.bom),
    lines: (row.lines || []).map((line) => ({
      id: toText(line.id),
      itemId: toText(line.item_id),
      plannedBaseQuantity: toNumber(line.planned_base_quantity),
      actualBaseQuantity: toNumber(line.actual_base_quantity),
      unitCost: toNumber(line.unit_cost),
      lineTotalCost: toNumber(line.line_total_cost)
    }))
  };
}

function applyDateRange(query, field, dateFrom, dateTo) {
  let next = query;
  if (toText(dateFrom)) next = next.gte(field, `${toText(dateFrom)}T00:00:00+07:00`);
  const nextDate = addCalendarDays(dateTo, 1);
  if (nextDate) next = next.lt(field, `${nextDate}T00:00:00+07:00`);
  return next;
}

export async function readInventoryCostAnalysis({
  dateFrom = "",
  dateTo = "",
  warehouseIds = [],
  allowLocalAdmin = false
} = {}) {
  const client = await getInventoryClient();
  if (!client) return { ok: false, status: "setup", salesRows: [], productionRows: [], message: "Chưa kết nối được Supabase cho phân hệ Kho." };
  const permission = await readInventoryCostAnalysisPermission({ allowLocalAdmin });
  if (!permission.canView) {
    return {
      ok: permission.ok,
      status: "denied",
      permissions: { canView: false, roles: permission.roles || [] },
      salesRows: [],
      productionRows: [],
      summary: calculateInventoryCostAnalysisSummary(),
      hasMore: false,
      message: permission.message || "Tài khoản chưa có quyền xem giá vốn và đối chiếu."
    };
  }
  const scopedWarehouseIds = [...new Set((warehouseIds || []).map(toText).filter(Boolean))];
  if (!scopedWarehouseIds.length) {
    return { ok: true, status: "ready", permissions: { canView: true, roles: permission.roles || [] }, salesRows: [], productionRows: [], summary: calculateInventoryCostAnalysisSummary(), hasMore: false, message: "" };
  }

  let eventQuery = client
    .from("inventory_sales_order_events")
    .select(`
      id,source_type,source_order_key,branch_uuid,warehouse_id,document_id,occurred_at,processed_at,
      lines:inventory_sales_order_event_lines(
        id,source_line_key,source_line_name,menu_entity_name,recipe_id,item_id,required_quantity,line_status
      )
    `)
    .eq("event_type", "sale")
    .eq("processing_status", "completed")
    .in("warehouse_id", scopedWarehouseIds)
    .order("occurred_at", { ascending: false })
    .limit(EVENT_LIMIT + 1);
  eventQuery = applyDateRange(eventQuery, "occurred_at", dateFrom, dateTo);

  let productionQuery = client
    .from("inventory_production_orders")
    .select(`
      id,order_no,bom_id,output_item_id,warehouse_id,status,planned_output_quantity,actual_output_quantity,
      estimated_total_cost,actual_total_cost,actual_unit_cost,output_lot_number,completed_at,
      bom:inventory_boms!inventory_production_orders_bom_id_fkey(id,code,version),
      lines:inventory_production_order_lines(id,item_id,planned_base_quantity,actual_base_quantity,unit_cost,line_total_cost)
    `)
    .eq("status", "completed")
    .in("warehouse_id", scopedWarehouseIds)
    .order("completed_at", { ascending: false })
    .limit(PRODUCTION_LIMIT + 1);
  productionQuery = applyDateRange(productionQuery, "completed_at", dateFrom, dateTo);

  const [eventResult, productionResult] = await Promise.all([eventQuery, productionQuery]);
  recordAdminRequest("read inventory cost analysis", "inventory_sales_order_events");
  const firstError = eventResult.error || productionResult.error;
  if (firstError) return { ok: false, ...normalizeError(firstError), salesRows: [], productionRows: [] };

  const events = (eventResult.data || []).slice(0, EVENT_LIMIT).map(normalizeEvent);
  const productionOrders = (productionResult.data || []).slice(0, PRODUCTION_LIMIT).map(normalizeProductionOrder);
  const documentIds = [...new Set(events.map((event) => event.documentId).filter(Boolean))];
  const recipeIds = [...new Set(events.flatMap((event) => event.lines.map((line) => line.recipeId)).filter(Boolean))];
  const outputItemIds = [...new Set(events.flatMap((event) => event.lines.map((line) => line.itemId)).filter(Boolean))];
  const latestOccurredAt = events[0]?.occurredAt || `${toText(dateTo || dateFrom)}T23:59:59+07:00`;

  const movementPromise = documentIds.length
    ? client.from("inventory_stock_movements").select("id,document_id,document_line_id,warehouse_id,item_id,direction,quantity,unit_cost,occurred_at").in("document_id", documentIds).eq("direction", "out").limit(5000)
    : Promise.resolve({ data: [], error: null });
  const recipePromise = recipeIds.length
    ? client.from("inventory_sales_recipes").select("id,code,version,menu_entity_name").in("id", recipeIds).limit(500)
    : Promise.resolve({ data: [], error: null });
  let originPromise = Promise.resolve({ data: [], error: null });
  if (outputItemIds.length) {
    originPromise = client
      .from("inventory_production_orders")
      .select("id,order_no,bom_id,output_item_id,warehouse_id,status,planned_output_quantity,actual_output_quantity,estimated_total_cost,actual_total_cost,actual_unit_cost,output_lot_number,completed_at,bom:inventory_boms!inventory_production_orders_bom_id_fkey(id,code,version),lines:inventory_production_order_lines(id,item_id,planned_base_quantity,actual_base_quantity,unit_cost,line_total_cost)")
      .eq("status", "completed")
      .in("output_item_id", outputItemIds)
      .lte("completed_at", latestOccurredAt || new Date().toISOString())
      .order("completed_at", { ascending: false })
      .limit(300);
  }

  const [movementResult, recipeResult, originResult] = await Promise.all([movementPromise, recipePromise, originPromise]);
  const detailError = movementResult.error || recipeResult.error || originResult.error;
  if (detailError) return { ok: false, ...normalizeError(detailError), salesRows: [], productionRows: [] };

  const salesRows = buildInventorySalesCostRows({
    events,
    movements: (movementResult.data || []).map(normalizeMovement),
    recipes: (recipeResult.data || []).map(normalizeRecipe),
    productionOrders: (originResult.data || []).map(normalizeProductionOrder)
  });
  const productionRows = buildInventoryProductionVarianceRows(productionOrders);

  return {
    ok: true,
    status: "ready",
    salesRows,
    productionRows,
    permissions: { canView: true, roles: permission.roles || [] },
    summary: calculateInventoryCostAnalysisSummary({ salesRows, productionRows }),
    hasMore: (eventResult.data || []).length > EVENT_LIMIT || (productionResult.data || []).length > PRODUCTION_LIMIT,
    message: ""
  };
}

export default { readInventoryCostAnalysis, readInventoryCostAnalysisPermission };
