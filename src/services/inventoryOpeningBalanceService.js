import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import { isInventoryRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";

const DOCUMENT_SELECT = "id,document_no,status,destination_warehouse_id,occurred_at,notes,total_amount,created_at,completed_at";
const LINE_SELECT = "id,document_id,item_id,unit_id,conversion_to_base,expected_quantity,actual_quantity,base_quantity,unit_price";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

async function getInventoryClient() {
  return getSupabaseAdminAuthClient()
    || getSupabaseRuntimeClient()
    || await initSupabaseRuntimeClient();
}

function normalizeError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message);
  const lowerMessage = message.toLowerCase();
  if (["42P01", "PGRST202", "PGRST205"].includes(code) || lowerMessage.includes("does not exist")) {
    return { status: "setup", code: "inventory_opening_balance_missing", message: "Chức năng tồn đầu kỳ chưa được triển khai trên Supabase." };
  }
  if (code === "42501" || lowerMessage.includes("permission denied") || lowerMessage.includes("row-level security")) {
    return { status: "error", code: "inventory_opening_balance_denied", message: "Tài khoản chưa có quyền xem hoặc ghi nhận tồn đầu kỳ." };
  }
  return { status: "error", code: "inventory_opening_balance_failed", message: message || "Không tải được dữ liệu tồn đầu kỳ." };
}

function normalizeLine(row = {}) {
  return {
    id: toText(row.id),
    documentId: toText(row.document_id),
    itemId: toText(row.item_id),
    unitId: toText(row.unit_id),
    conversionToBase: Number(row.conversion_to_base || 1),
    quantity: Number(row.actual_quantity ?? row.expected_quantity ?? 0),
    baseQuantity: Number(row.base_quantity || 0),
    unitPrice: Number(row.unit_price || 0)
  };
}

function normalizeDocument(row = {}, lines = []) {
  return {
    id: toText(row.id),
    documentNo: toText(row.document_no),
    status: toText(row.status),
    warehouseId: toText(row.destination_warehouse_id),
    occurredAt: toText(row.occurred_at),
    notes: toText(row.notes),
    totalAmount: Number(row.total_amount || 0),
    createdAt: toText(row.created_at),
    completedAt: toText(row.completed_at),
    lines
  };
}

export function canWriteInventoryOpeningBalances() {
  return isInventoryRuntimeWriteEnabled();
}

export async function readInventoryOpeningBalances() {
  const client = await getInventoryClient();
  if (!client) return { ok: false, status: "setup", rows: [], message: "Chưa kết nối được Supabase cho phân hệ Kho." };

  const documentResult = await client
    .from("inventory_documents")
    .select(DOCUMENT_SELECT)
    .eq("document_type", "opening_balance")
    .eq("status", "completed")
    .order("completed_at", { ascending: false });
  recordAdminRequest("read inventory opening balances", "inventory_documents");
  if (documentResult.error) return { ok: false, ...normalizeError(documentResult.error), rows: [] };

  const documents = Array.isArray(documentResult.data) ? documentResult.data : [];
  const documentIds = documents.map((row) => row.id).filter(Boolean);
  let lines = [];
  if (documentIds.length) {
    const lineResult = await client
      .from("inventory_document_lines")
      .select(LINE_SELECT)
      .in("document_id", documentIds)
      .order("created_at", { ascending: true });
    if (lineResult.error) return { ok: false, ...normalizeError(lineResult.error), rows: [] };
    lines = Array.isArray(lineResult.data) ? lineResult.data : [];
  }

  const linesByDocument = new Map();
  lines.forEach((row) => {
    const current = linesByDocument.get(row.document_id) || [];
    current.push(normalizeLine(row));
    linesByDocument.set(row.document_id, current);
  });

  return {
    ok: true,
    status: "ready",
    rows: documents.map((row) => normalizeDocument(row, linesByDocument.get(row.id) || [])),
    message: ""
  };
}

export function validateInventoryOpeningBalanceInput(input = {}) {
  const warehouseId = toText(input.warehouseId);
  const lines = (Array.isArray(input.lines) ? input.lines : []).map((line) => ({
    itemId: toText(line.itemId),
    unitId: toText(line.unitId),
    conversionToBase: Number(line.conversionToBase || 1),
    quantity: Number(line.quantity || 0),
    unitPrice: Number(line.unitPrice || 0)
  }));
  if (!warehouseId) throw new Error("Không xác định được kho cần nhập tồn đầu kỳ.");
  if (!lines.length || lines.some((line) => !line.itemId || !line.unitId || line.quantity <= 0 || line.conversionToBase <= 0 || line.unitPrice < 0)) {
    throw new Error("Cần ít nhất một nguyên vật liệu có số lượng lớn hơn 0 và giá vốn hợp lệ.");
  }
  if (new Set(lines.map((line) => line.itemId)).size !== lines.length) {
    throw new Error("Một nguyên vật liệu chỉ được xuất hiện một lần trong tồn đầu kỳ.");
  }
  const occurredAt = new Date(input.occurredAt || Date.now());
  if (Number.isNaN(occurredAt.getTime())) throw new Error("Ngày ghi nhận tồn đầu kỳ chưa hợp lệ.");
  return { warehouseId, lines, occurredAt: occurredAt.toISOString(), notes: toText(input.notes) };
}

export async function createInventoryOpeningBalance(input = {}) {
  if (!canWriteInventoryOpeningBalances()) throw new Error("Ghi dữ liệu Kho đang bị khóa an toàn.");
  const normalized = validateInventoryOpeningBalanceInput(input);
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");
  const idempotencyKey = `opening-balance-${normalized.warehouseId}-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
  const { data, error } = await client.rpc("inventory_create_opening_balance", {
    p_warehouse_id: normalized.warehouseId,
    p_occurred_at: normalized.occurredAt,
    p_notes: normalized.notes || null,
    p_lines: normalized.lines.map((line) => ({
      item_id: line.itemId,
      unit_id: line.unitId,
      conversion_to_base: line.conversionToBase,
      quantity: line.quantity,
      unit_price: line.unitPrice
    })),
    p_idempotency_key: idempotencyKey
  });
  recordAdminRequest("create inventory opening balance", "inventory_create_opening_balance");
  if (error) throw new Error(toText(error.message) || "Không thể ghi nhận tồn đầu kỳ.");
  return data;
}

export default {
  canWriteInventoryOpeningBalances,
  readInventoryOpeningBalances,
  createInventoryOpeningBalance,
  validateInventoryOpeningBalanceInput
};
