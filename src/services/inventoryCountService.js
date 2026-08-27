import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import { isInventoryRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";
import { getInventoryCountRecordedQuantity } from "./inventoryCountCalculations.js";

const DOCUMENT_SELECT = "id,document_no,status,source_warehouse_id,occurred_at,notes,created_at,submitted_at,approved_at,completed_at";
const LINE_SELECT = "id,document_id,item_id,unit_id,conversion_to_base,counted_quantity,variance_reason";
const SNAPSHOT_SELECT = "document_id,item_id,system_quantity,expected_quantity_at_count,expected_quantity_at_submit,captured_at,counted_at,submitted_at";
const COUNT_ACTION_STATUSES = ["draft", "counting", "submitted", "approved"];

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function createKey(prefix = "inventory-count") {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function createDocumentNo() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  return `KK-${date}-${time}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
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

function normalizeReadError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message).toLowerCase();
  if (["42P01", "PGRST202", "PGRST205"].includes(code) || message.includes("does not exist")) {
    return { status: "setup", code: "inventory_counts_missing", message: "Schema kiểm kê chưa sẵn sàng trên Supabase đang chạy." };
  }
  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return { status: "error", code: "inventory_counts_denied", message: "Tài khoản chưa có quyền xem kiểm kê kho." };
  }
  return { status: "error", code: "inventory_counts_failed", message: toText(error.message) || "Không tải được danh sách kiểm kê." };
}

function normalizeLine(row = {}, snapshotsByItem = new Map()) {
  const snapshot = snapshotsByItem.get(row.item_id) || {};
  return {
    id: toText(row.id),
    documentId: toText(row.document_id),
    itemId: toText(row.item_id),
    unitId: toText(row.unit_id),
    conversionToBase: Number(row.conversion_to_base || 1),
    countedQuantity: row.counted_quantity == null ? null : Number(row.counted_quantity),
    varianceReason: toText(row.variance_reason),
    systemQuantity: Number(snapshot.system_quantity || 0),
    expectedQuantityAtCount: snapshot.expected_quantity_at_count == null ? null : Number(snapshot.expected_quantity_at_count),
    expectedQuantityAtSubmit: snapshot.expected_quantity_at_submit == null ? null : Number(snapshot.expected_quantity_at_submit)
  };
}

function normalizeDocument(row = {}, lines = []) {
  return {
    id: toText(row.id),
    documentNo: toText(row.document_no),
    status: toText(row.status),
    warehouseId: toText(row.source_warehouse_id),
    occurredAt: toText(row.occurred_at),
    notes: toText(row.notes),
    createdAt: toText(row.created_at),
    submittedAt: toText(row.submitted_at),
    approvedAt: toText(row.approved_at),
    completedAt: toText(row.completed_at),
    lines
  };
}

async function callCountRpc(client, functionName, payload, fallbackMessage) {
  if (!isInventoryRuntimeWriteEnabled()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const { data, error } = await client.rpc(functionName, payload);
  recordAdminRequest(functionName.replace(/_/g, " "), functionName);
  if (error) throw new Error(toText(error.message) || fallbackMessage);
  return data;
}

export async function readInventoryCounts() {
  const client = await getInventoryClient();
  if (!client) return { ok: false, status: "setup", rows: [], message: "Chưa kết nối được Supabase cho phân hệ Kho." };
  const documentResult = await client
    .from("inventory_documents")
    .select(DOCUMENT_SELECT)
    .eq("document_type", "stock_count")
    .order("occurred_at", { ascending: false })
    .limit(200);
  recordAdminRequest("read inventory counts", "inventory_documents");
  if (documentResult.error) return { ok: false, ...normalizeReadError(documentResult.error), rows: [] };

  const documents = documentResult.data || [];
  const documentIds = documents.map((row) => row.id);
  let lineRows = [];
  let snapshotRows = [];
  if (documentIds.length) {
    const [lineResult, snapshotResult] = await Promise.all([
      client.from("inventory_document_lines").select(LINE_SELECT).in("document_id", documentIds),
      client.from("inventory_stock_count_snapshots").select(SNAPSHOT_SELECT).in("document_id", documentIds)
    ]);
    if (lineResult.error || snapshotResult.error) return { ok: false, ...normalizeReadError(lineResult.error || snapshotResult.error), rows: [] };
    lineRows = lineResult.data || [];
    snapshotRows = snapshotResult.data || [];
  }
  const snapshotsByDocument = new Map();
  snapshotRows.forEach((row) => {
    const current = snapshotsByDocument.get(row.document_id) || new Map();
    current.set(row.item_id, row);
    snapshotsByDocument.set(row.document_id, current);
  });
  const linesByDocument = new Map();
  lineRows.forEach((row) => {
    const current = linesByDocument.get(row.document_id) || [];
    current.push(normalizeLine(row, snapshotsByDocument.get(row.document_id) || new Map()));
    linesByDocument.set(row.document_id, current);
  });

  const actorId = await getActorId(client);
  let roles = [];
  if (actorId) {
    const accessResult = await client.from("inventory_user_access").select("role").eq("auth_user_id", actorId).eq("is_active", true);
    if (!accessResult.error) roles = (accessResult.data || []).map((row) => toText(row.role));
  }
  const canManage = roles.some((role) => ["owner", "admin", "central_manager", "branch_manager"].includes(role));
  return {
    ok: true,
    status: "ready",
    rows: documents.map((row) => normalizeDocument(row, linesByDocument.get(row.id) || [])),
    permissions: { canManage, canCount: roles.some((role) => ["owner", "admin", "central_manager", "branch_manager", "staff"].includes(role)) }
  };
}

export async function readInventoryActionableCount() {
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const { count, error } = await client
    .from("inventory_documents")
    .select("id", { count: "exact", head: true })
    .eq("document_type", "stock_count")
    .in("status", COUNT_ACTION_STATUSES);
  recordAdminRequest("count actionable inventory stock counts", "inventory_documents");
  if (error) throw new Error(normalizeReadError(error).message);
  return Math.max(0, Number(count || 0));
}

export async function createAndStartInventoryCount({ warehouseId = "", notes = "", lines = [] } = {}) {
  if (!isInventoryRuntimeWriteEnabled()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const normalizedWarehouseId = toText(warehouseId);
  const normalizedLines = lines.filter((line) => line.itemId && line.unitId && Number(line.conversionToBase || 0) > 0);
  if (!normalizedWarehouseId) throw new Error("Vui lòng chọn kho kiểm kê.");
  if (!normalizedLines.length) throw new Error("Kho chưa có nguyên vật liệu để kiểm kê.");
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const actorId = await getActorId(client);
  if (!actorId) throw new Error("Phiên đăng nhập đã hết hạn.");
  const { data, error } = await client.rpc("inventory_create_and_start_stock_count", {
    p_document_no: createDocumentNo(),
    p_idempotency_key: createKey("count-create"),
    p_warehouse_id: normalizedWarehouseId,
    p_occurred_at: new Date().toISOString(),
    p_notes: toText(notes) || null,
    p_lines: normalizedLines.map((line) => ({
      itemId: line.itemId,
      unitId: line.unitId,
      conversionToBase: Number(line.conversionToBase)
    }))
  });
  recordAdminRequest("create and start inventory count", "inventory_create_and_start_stock_count");
  if (error) throw new Error(toText(error.message) || "Không bắt đầu được đợt kiểm kê.");
  return toText(data);
}

export async function recordAndSubmitInventoryCount(documentId, lines = []) {
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const payload = lines.map((line) => ({ line_id: line.id, counted_quantity: getInventoryCountRecordedQuantity(line) }));
  await callCountRpc(client, "inventory_record_stock_count", {
    p_document_id: documentId,
    p_idempotency_key: createKey(`count-record-${documentId}`),
    p_lines: payload
  }, "Không lưu được số đếm kiểm kê.");
  return callCountRpc(client, "inventory_submit_stock_count", {
    p_document_id: documentId,
    p_idempotency_key: `count-submit-${documentId}`
  }, "Không gửi được kết quả kiểm kê.");
}

export async function approveAndCompleteInventoryCount(documentId, lines = []) {
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  await callCountRpc(client, "inventory_approve_stock_count", {
    p_document_id: documentId,
    p_idempotency_key: `count-approve-${documentId}`,
    p_lines: lines.map((line) => ({ line_id: line.id, variance_reason: toText(line.varianceReason) }))
  }, "Không duyệt được kết quả kiểm kê.");
  return callCountRpc(client, "inventory_complete_stock_count", {
    p_document_id: documentId,
    p_idempotency_key: `count-complete-${documentId}`
  }, "Đã duyệt nhưng chưa điều chỉnh được tồn. Hãy bấm Hoàn tất lại.");
}

export async function completeApprovedInventoryCount(documentId) {
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  return callCountRpc(client, "inventory_complete_stock_count", {
    p_document_id: documentId,
    p_idempotency_key: `count-complete-${documentId}`
  }, "Không hoàn tất được kiểm kê.");
}

export default {
  approveAndCompleteInventoryCount,
  completeApprovedInventoryCount,
  createAndStartInventoryCount,
  readInventoryActionableCount,
  readInventoryCounts,
  recordAndSubmitInventoryCount
};
