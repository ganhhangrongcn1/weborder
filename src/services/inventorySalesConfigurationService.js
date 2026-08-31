import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import { isInventoryRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";
import {
  normalizeInventoryChannelMappingInput,
  normalizeInventorySalesRecipeInput
} from "./inventorySalesRecipeCalculations.js";

const RECIPE_SELECT = `
  id,code,menu_entity_type,menu_entity_id,menu_entity_name,branch_uuid,version,
  yield_quantity,status,effective_from,effective_to,notes,metadata,
  shared_menu_entity_type,shared_menu_entity_id,shared_menu_entity_name,
  created_at,updated_at,deleted_at,
  components:inventory_sales_recipe_components(
    id,recipe_id,item_id,quantity,unit_id,conversion_to_base,base_quantity,waste_percent,
    display_order,notes,
    item:inventory_items!inventory_sales_recipe_components_item_id_fkey(id,code,name,item_type,base_unit_id,metadata,is_active),
    unit:inventory_units!inventory_sales_recipe_components_unit_id_fkey(id,code,name,symbol,unit_type,base_unit_id,conversion_factor,is_active)
  )
`;

const MAPPING_SELECT = `
  id,partner_source,branch_uuid,mapping_kind,external_item_id,external_item_name,
  external_option_group,external_option_name,ignore_inventory,status,notes,metadata,created_at,updated_at,
  targets:inventory_channel_mapping_targets(
    id,mapping_id,menu_entity_type,menu_entity_id,menu_entity_name,quantity,display_order
  )
`;

const SALES_EVENT_SELECT = `
  id,source_type,source_order_key,source_row_id,event_type,source_status,branch_uuid,warehouse_id,
  processing_status,issue_code,issue_message,document_id,reverses_event_id,attempts,available_at,
  occurred_at,processed_at,created_at,updated_at,
  lines:inventory_sales_order_event_lines(
    id,source_line_key,source_line_name,menu_entity_type,menu_entity_id,menu_entity_name,
    recipe_id,item_id,required_quantity,line_status,issue_code,issue_message,metadata
  )
`;

const MISSING_CODES = new Set(["42P01", "PGRST202", "PGRST204", "PGRST205"]);

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

async function getInventoryClient() {
  return getSupabaseAdminAuthClient()
    || getSupabaseRuntimeClient()
    || await initSupabaseRuntimeClient();
}

function getError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message);
  const normalized = message.toLowerCase();
  if (MISSING_CODES.has(code) || normalized.includes("does not exist") || normalized.includes("could not find")) {
    return { status: "setup", message: "Schema Định lượng món bán chưa được triển khai trên Supabase đang chạy." };
  }
  if (code === "42501" || normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return { status: "error", message: "Tài khoản chưa có quyền xem hoặc quản lý định lượng món bán." };
  }
  if (code === "23505") return { status: "error", message: "Món hoặc lựa chọn app này đã được cấu hình." };
  return { status: "error", message: message || "Không xử lý được cấu hình món bán." };
}

function normalizeReference(value) {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" ? { ...row } : {};
}

function normalizeRecipe(row = {}) {
  return {
    id: toText(row.id),
    code: toText(row.code),
    menuEntityType: toText(row.menu_entity_type || "product"),
    menuEntityId: toText(row.menu_entity_id),
    menuEntityName: toText(row.menu_entity_name),
    branchUuid: toText(row.branch_uuid),
    version: Number(row.version || 1),
    yieldQuantity: Number(row.yield_quantity || 1),
    status: toText(row.status || "draft"),
    effectiveFrom: toText(row.effective_from),
    effectiveTo: toText(row.effective_to),
    notes: toText(row.notes),
    sharedMenuEntityType: toText(row.shared_menu_entity_type),
    sharedMenuEntityId: toText(row.shared_menu_entity_id),
    sharedMenuEntityName: toText(row.shared_menu_entity_name),
    components: (Array.isArray(row.components) ? row.components : []).map((component) => ({
      id: toText(component.id),
      itemId: toText(component.item_id),
      quantity: Number(component.quantity || 0),
      unitId: toText(component.unit_id),
      conversionToBase: Number(component.conversion_to_base || 1),
      baseQuantity: Number(component.base_quantity || 0),
      wastePercent: Number(component.waste_percent || 0),
      displayOrder: Number(component.display_order || 0),
      notes: toText(component.notes),
      item: normalizeReference(component.item),
      unit: normalizeReference(component.unit)
    })).sort((left, right) => left.displayOrder - right.displayOrder),
    createdAt: toText(row.created_at),
    updatedAt: toText(row.updated_at),
    deletedAt: toText(row.deleted_at)
  };
}

function normalizeMapping(row = {}) {
  return {
    id: toText(row.id),
    partnerSource: toText(row.partner_source),
    branchUuid: toText(row.branch_uuid),
    mappingKind: toText(row.mapping_kind || "item"),
    externalItemId: toText(row.external_item_id),
    externalItemName: toText(row.external_item_name),
    externalOptionGroup: toText(row.external_option_group),
    externalOptionName: toText(row.external_option_name),
    ignoreInventory: row.ignore_inventory === true,
    status: toText(row.status || "active"),
    notes: toText(row.notes),
    targets: (Array.isArray(row.targets) ? row.targets : []).map((target) => ({
      id: toText(target.id),
      menuEntityType: toText(target.menu_entity_type || "product"),
      menuEntityId: toText(target.menu_entity_id),
      menuEntityName: toText(target.menu_entity_name),
      quantity: Number(target.quantity || 1),
      displayOrder: Number(target.display_order || 0)
    })).sort((left, right) => left.displayOrder - right.displayOrder),
    createdAt: toText(row.created_at),
    updatedAt: toText(row.updated_at)
  };
}

function normalizeCandidate(row = {}) {
  return {
    candidateKind: toText(row.candidate_kind || "item"),
    partnerSource: toText(row.partner_source),
    branchUuid: toText(row.branch_uuid),
    externalItemId: toText(row.external_item_id),
    externalItemName: toText(row.external_item_name),
    externalOptionGroup: toText(row.external_option_group),
    externalOptionName: toText(row.external_option_name),
    occurrences: Number(row.occurrences || 0),
    lastSeen: toText(row.last_seen)
  };
}

function normalizeSalesEvent(row = {}) {
  return {
    id: toText(row.id),
    sourceType: toText(row.source_type),
    sourceOrderKey: toText(row.source_order_key),
    sourceRowId: toText(row.source_row_id),
    eventType: toText(row.event_type),
    sourceStatus: toText(row.source_status),
    branchUuid: toText(row.branch_uuid),
    warehouseId: toText(row.warehouse_id),
    processingStatus: toText(row.processing_status || "pending"),
    issueCode: toText(row.issue_code),
    issueMessage: toText(row.issue_message),
    documentId: toText(row.document_id),
    reversesEventId: toText(row.reverses_event_id),
    attempts: Number(row.attempts || 0),
    availableAt: toText(row.available_at),
    occurredAt: toText(row.occurred_at),
    processedAt: toText(row.processed_at),
    createdAt: toText(row.created_at),
    updatedAt: toText(row.updated_at),
    lines: (Array.isArray(row.lines) ? row.lines : []).map((line) => ({
      id: toText(line.id),
      sourceLineKey: toText(line.source_line_key),
      sourceLineName: toText(line.source_line_name),
      menuEntityType: toText(line.menu_entity_type),
      menuEntityId: toText(line.menu_entity_id),
      menuEntityName: toText(line.menu_entity_name),
      recipeId: toText(line.recipe_id),
      itemId: toText(line.item_id),
      requiredQuantity: Number(line.required_quantity || 0),
      lineStatus: toText(line.line_status),
      issueCode: toText(line.issue_code),
      issueMessage: toText(line.issue_message),
      metadata: line.metadata && typeof line.metadata === "object" ? line.metadata : {}
    }))
  };
}

function aggregateAverageCosts(rows = []) {
  const totals = new Map();
  rows.forEach((row) => {
    const itemId = toText(row.item_id);
    if (!itemId) return;
    const quantity = Math.max(0, Number(row.quantity || 0));
    const averageCost = Math.max(0, Number(row.average_cost || 0));
    const current = totals.get(itemId) || { value: 0, quantity: 0, fallback: 0 };
    current.value += quantity * averageCost;
    current.quantity += quantity;
    current.fallback = averageCost || current.fallback;
    totals.set(itemId, current);
  });
  return Object.fromEntries([...totals.entries()].map(([itemId, value]) => [
    itemId,
    value.quantity > 0 ? value.value / value.quantity : value.fallback
  ]));
}

function addCalendarDays(value = "", days = 0) {
  const [year, month, day] = toText(value).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return "";
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export async function readInventorySalesOrderEvents({ dateFrom = "", dateTo = "", limit = 200 } = {}) {
  const client = await getInventoryClient();
  if (!client) {
    return {
      ok: false,
      status: "setup",
      rows: [],
      hasMore: false,
      message: "Chưa kết nối được Supabase cho phân hệ Kho."
    };
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 200, 50), 300);
  let query = client
    .from("inventory_sales_order_events")
    .select(SALES_EVENT_SELECT)
    .order("created_at", { ascending: false })
    .limit(safeLimit + 1);

  if (toText(dateFrom)) query = query.gte("occurred_at", `${toText(dateFrom)}T00:00:00+07:00`);
  if (toText(dateTo)) {
    const nextDate = addCalendarDays(dateTo, 1);
    if (nextDate) query = query.lt("occurred_at", `${nextDate}T00:00:00+07:00`);
  }

  const result = await query;
  recordAdminRequest("read inventory sales order events", "inventory_sales_order_events");
  if (result.error) return { ok: false, ...getError(result.error), rows: [], hasMore: false };

  const sourceRows = result.data || [];
  return {
    ok: true,
    status: "ready",
    rows: sourceRows.slice(0, safeLimit).map(normalizeSalesEvent),
    hasMore: sourceRows.length > safeLimit,
    message: ""
  };
}

export async function readInventorySalesConfiguration() {
  const client = await getInventoryClient();
  if (!client) return { ok: false, status: "setup", recipes: [], mappings: [], candidates: [], averageCosts: {}, message: "Chưa kết nối được Supabase cho phân hệ Kho." };

  const [recipeResult, mappingResult, candidateResult, balanceResult] = await Promise.all([
    client.from("inventory_sales_recipes").select(RECIPE_SELECT).is("deleted_at", null).order("updated_at", { ascending: false }).limit(500),
    client.from("inventory_channel_mappings").select(MAPPING_SELECT).order("updated_at", { ascending: false }).limit(1000),
    client.rpc("inventory_read_channel_mapping_candidates", { p_limit: 1000 }),
    client.from("inventory_stock_balances").select("item_id,quantity,average_cost").limit(5000)
  ]);
  recordAdminRequest("read inventory sales configuration", "inventory_sales_recipes");
  const error = recipeResult.error || mappingResult.error;
  if (error) return { ok: false, ...getError(error), recipes: [], mappings: [], candidates: [], averageCosts: {} };

  const { data: sessionData } = await client.auth.getSession();
  const actorId = toText(sessionData?.session?.user?.id);
  let roles = [];
  if (actorId) {
    const roleResult = await client.from("inventory_user_access").select("role").eq("auth_user_id", actorId).eq("is_active", true);
    if (!roleResult.error) roles = (roleResult.data || []).map((row) => toText(row.role));
  }
  return {
    ok: true,
    status: "ready",
    recipes: (recipeResult.data || []).map(normalizeRecipe),
    mappings: (mappingResult.data || []).map(normalizeMapping),
    candidates: candidateResult.error ? [] : (candidateResult.data || []).map(normalizeCandidate),
    candidateMessage: candidateResult.error
      ? "Danh sách món app đang tải chậm. Định lượng món bán vẫn sử dụng bình thường."
      : "",
    averageCosts: aggregateAverageCosts(balanceResult.error ? [] : balanceResult.data || []),
    permissions: { canManage: roles.some((role) => ["owner", "admin", "central_manager"].includes(role)) },
    message: ""
  };
}

export async function retryInventorySalesOrderEvent(id = "") {
  if (!canWriteInventorySalesConfiguration()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { error } = await client.rpc("inventory_retry_sales_order_event", { p_event_id: toText(id) });
  recordAdminRequest("retry inventory sales order event", "inventory_sales_order_events");
  if (error) throw new Error(getError(error).message);
  return true;
}

export function canWriteInventorySalesConfiguration() {
  return isInventoryRuntimeWriteEnabled();
}

export async function saveInventorySalesRecipe({ input = {}, menuEntities = [], items = [], units = [] } = {}) {
  if (!canWriteInventorySalesConfiguration()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const draft = normalizeInventorySalesRecipeInput(input, { menuEntities, items, units });
  const { data, error } = await client.rpc("inventory_save_sales_recipe_draft_v2", {
    p_recipe_id: draft.id || null,
    p_menu_entity_type: draft.menuEntityType,
    p_menu_entity_id: draft.menuEntityId,
    p_menu_entity_name: draft.menuEntityName,
    p_branch_uuid: draft.branchUuid || null,
    p_yield_quantity: draft.yieldQuantity,
    p_effective_from: draft.effectiveFrom,
    p_notes: draft.notes || null,
    p_shared_menu_entity_type: draft.sharedMenuEntityType || null,
    p_shared_menu_entity_id: draft.sharedMenuEntityId || null,
    p_shared_menu_entity_name: draft.sharedMenuEntityName || null,
    p_components: draft.components
  });
  recordAdminRequest(`${draft.id ? "update" : "create"} inventory sales recipe`, "inventory_sales_recipes");
  if (error) throw new Error(getError(error).message);
  return toText(data);
}

export async function activateInventorySalesRecipe(id = "") {
  if (!canWriteInventorySalesConfiguration()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { error } = await client.rpc("inventory_activate_sales_recipe", { p_recipe_id: toText(id) });
  recordAdminRequest("activate inventory sales recipe", "inventory_sales_recipes");
  if (error) throw new Error(getError(error).message);
  return true;
}

export async function deactivateInventorySalesRecipe(id = "") {
  if (!canWriteInventorySalesConfiguration()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { error } = await client.rpc("inventory_deactivate_sales_recipe", { p_recipe_id: toText(id) });
  recordAdminRequest("deactivate inventory sales recipe", "inventory_sales_recipes");
  if (error) throw new Error(getError(error).message);
  return true;
}

export async function deleteInventorySalesRecipe(id = "") {
  if (!canWriteInventorySalesConfiguration()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { error } = await client.rpc("inventory_delete_sales_recipe_draft", { p_recipe_id: toText(id) });
  recordAdminRequest("delete inventory sales recipe", "inventory_sales_recipes");
  if (error) throw new Error(getError(error).message);
  return true;
}

export async function saveInventoryChannelMapping({ input = {}, menuEntities = [] } = {}) {
  if (!canWriteInventorySalesConfiguration()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  const mapping = normalizeInventoryChannelMappingInput(input, { menuEntities });
  const { data, error } = await client.rpc("inventory_save_channel_mapping_v2", {
    p_mapping_id: mapping.id || null,
    p_partner_source: mapping.partnerSource,
    p_branch_uuid: mapping.branchUuid,
    p_mapping_kind: mapping.mappingKind,
    p_external_item_id: mapping.externalItemId,
    p_external_item_name: mapping.externalItemName,
    p_external_option_group: mapping.externalOptionGroup,
    p_external_option_name: mapping.externalOptionName,
    p_ignore_inventory: mapping.ignoreInventory,
    p_status: mapping.status,
    p_notes: mapping.notes || null,
    p_targets: mapping.targets
  });
  recordAdminRequest(`${mapping.id ? "update" : "create"} inventory channel mapping`, "inventory_channel_mappings");
  if (error) throw new Error(getError(error).message);
  return toText(data);
}

export async function deleteInventoryChannelMapping(id = "") {
  if (!canWriteInventorySalesConfiguration()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { error } = await client.rpc("inventory_delete_channel_mapping", { p_mapping_id: toText(id) });
  recordAdminRequest("delete inventory channel mapping", "inventory_channel_mappings");
  if (error) throw new Error(getError(error).message);
  return true;
}

export default {
  activateInventorySalesRecipe,
  canWriteInventorySalesConfiguration,
  deactivateInventorySalesRecipe,
  deleteInventoryChannelMapping,
  deleteInventorySalesRecipe,
  readInventorySalesConfiguration,
  readInventorySalesOrderEvents,
  retryInventorySalesOrderEvent,
  saveInventoryChannelMapping,
  saveInventorySalesRecipe
};
