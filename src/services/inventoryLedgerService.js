import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import {
  getInventoryDocumentDateTimeBounds,
  getInventoryDocumentPagination
} from "./inventoryDocumentFilters.js";
import { calculateInventoryLedgerSummary } from "./inventoryLedgerCalculations.js";

const MOVEMENT_SELECT = [
  "id", "movement_sequence", "warehouse_id", "item_id", "document_id",
  "direction", "movement_stage", "quantity", "unit_cost", "occurred_at", "created_at"
].join(",");
const SUMMARY_LIMIT = 5000;

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

async function getInventoryClient() {
  return getSupabaseAdminAuthClient()
    || getSupabaseRuntimeClient()
    || await initSupabaseRuntimeClient();
}

function normalizeReadError(error = {}) {
  const code = toText(error.code);
  const message = toText(error.message).toLowerCase();
  if (["42P01", "PGRST202", "PGRST205"].includes(code) || message.includes("does not exist")) {
    return { status: "setup", code: "inventory_ledger_missing", message: "Schema Sổ kho chưa sẵn sàng trên Supabase đang chạy." };
  }
  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return { status: "error", code: "inventory_ledger_denied", message: "Tài khoản chưa có quyền xem Sổ kho." };
  }
  return { status: "error", code: "inventory_ledger_failed", message: toText(error.message) || "Không tải được Sổ kho." };
}

function normalizeMovement(row = {}, documentsById = new Map()) {
  const document = documentsById.get(row.document_id) || {};
  return {
    id: toText(row.id),
    sequence: Number(row.movement_sequence || 0),
    warehouseId: toText(row.warehouse_id),
    itemId: toText(row.item_id),
    documentId: toText(row.document_id),
    documentNo: toText(document.document_no),
    documentType: toText(document.document_type),
    direction: toText(row.direction),
    stage: toText(row.movement_stage),
    quantity: Number(row.quantity || 0),
    unitCost: Number(row.unit_cost || 0),
    occurredAt: toText(row.occurred_at),
    createdAt: toText(row.created_at)
  };
}

function applyMovementFilters(query, { warehouseId, itemId, fromDateTime, toDateTime, futureOnly = false }) {
  let nextQuery = query;
  if (warehouseId) nextQuery = nextQuery.eq("warehouse_id", warehouseId);
  if (itemId) nextQuery = nextQuery.eq("item_id", itemId);
  if (futureOnly) {
    if (toDateTime) nextQuery = nextQuery.gt("occurred_at", toDateTime);
  } else {
    if (fromDateTime) nextQuery = nextQuery.gte("occurred_at", fromDateTime);
    if (toDateTime) nextQuery = nextQuery.lte("occurred_at", toDateTime);
  }
  return nextQuery;
}

async function readMovementSummary(client, filters, futureOnly = false) {
  let query = client
    .from("inventory_stock_movements")
    .select("direction,quantity", { count: "exact" });
  query = applyMovementFilters(query, { ...filters, futureOnly });
  const result = await query.range(0, SUMMARY_LIMIT - 1);
  recordAdminRequest(futureOnly ? "read inventory ledger future summary" : "read inventory ledger period summary", "inventory_stock_movements");
  return result;
}

export async function readInventoryLedger({
  fromDate = "",
  toDate = "",
  warehouseId = "",
  itemId = "",
  page = 1,
  pageSize = 50
} = {}) {
  const client = await getInventoryClient();
  if (!client) return { ok: false, status: "setup", rows: [], message: "Chưa kết nối được Supabase cho phân hệ Kho." };

  const dateBounds = getInventoryDocumentDateTimeBounds(fromDate, toDate);
  const pagination = getInventoryDocumentPagination(page, pageSize);
  const filters = {
    warehouseId: toText(warehouseId),
    itemId: toText(itemId),
    ...dateBounds
  };
  let movementQuery = client
    .from("inventory_stock_movements")
    .select(MOVEMENT_SELECT, { count: "exact" });
  movementQuery = applyMovementFilters(movementQuery, filters);
  const movementResult = await movementQuery
    .order("occurred_at", { ascending: false })
    .order("movement_sequence", { ascending: false })
    .range(pagination.from, pagination.to);
  recordAdminRequest("read inventory ledger", "inventory_stock_movements");
  if (movementResult.error) return { ok: false, ...normalizeReadError(movementResult.error), rows: [] };

  const movementRows = Array.isArray(movementResult.data) ? movementResult.data : [];
  const documentIds = [...new Set(movementRows.map((row) => row.document_id).filter(Boolean))];
  const documentsById = new Map();
  if (documentIds.length) {
    const documentResult = await client
      .from("inventory_documents")
      .select("id,document_no,document_type,status")
      .in("id", documentIds);
    recordAdminRequest("read inventory ledger documents", "inventory_documents");
    if (documentResult.error) return { ok: false, ...normalizeReadError(documentResult.error), rows: [] };
    (documentResult.data || []).forEach((row) => documentsById.set(row.id, row));
  }

  let summary = null;
  let summaryLimited = false;
  if (filters.itemId) {
    let balanceQuery = client
      .from("inventory_stock_balances")
      .select("quantity")
      .eq("item_id", filters.itemId);
    if (filters.warehouseId) balanceQuery = balanceQuery.eq("warehouse_id", filters.warehouseId);
    const [balanceResult, periodResult, futureResult] = await Promise.all([
      balanceQuery,
      readMovementSummary(client, filters, false),
      filters.toDateTime
        ? readMovementSummary(client, filters, true)
        : Promise.resolve({ data: [], count: 0, error: null })
    ]);
    recordAdminRequest("read inventory ledger balances", "inventory_stock_balances");
    const summaryError = balanceResult.error || periodResult.error || futureResult.error;
    if (summaryError) return { ok: false, ...normalizeReadError(summaryError), rows: [] };
    const currentBalance = (balanceResult.data || []).reduce((total, row) => total + Number(row.quantity || 0), 0);
    summaryLimited = Number(periodResult.count || 0) > SUMMARY_LIMIT || Number(futureResult.count || 0) > SUMMARY_LIMIT;
    summary = calculateInventoryLedgerSummary({
      currentBalance,
      periodMovements: periodResult.data || [],
      futureMovements: futureResult.data || []
    });
  }

  const totalCount = Number(movementResult.count || 0);
  return {
    ok: true,
    status: "ready",
    rows: movementRows.map((row) => normalizeMovement(row, documentsById)),
    totalCount,
    page: pagination.page,
    pageSize: pagination.pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / pagination.pageSize)),
    summary,
    summaryLimited
  };
}

export default { readInventoryLedger };
