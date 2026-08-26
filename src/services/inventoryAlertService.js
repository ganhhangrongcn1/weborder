import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";

const SOURCE_LIMIT = 5000;
const DOCUMENT_LIMIT = 2000;
const DOCUMENT_TYPES = [
  "purchase_receipt", "stock_issue", "transfer", "waste",
  "internal_requisition", "stock_adjustment", "stock_count"
];
const CANDIDATE_STATUSES = ["submitted", "approved", "in_transit", "received", "received_with_variance"];

export const EMPTY_INVENTORY_ALERT_SOURCES = {
  balances: [],
  lots: [],
  documents: []
};

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
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(code) || message.includes("does not exist")) {
    return { status: "setup", code: "inventory_alerts_missing", message: "Nguồn Cảnh báo kho chưa sẵn sàng trên Supabase đang chạy." };
  }
  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return { status: "error", code: "inventory_alerts_denied", message: "Tài khoản chưa có quyền xem cảnh báo của kho này." };
  }
  return { status: "error", code: "inventory_alerts_failed", message: toText(error.message) || "Không tải được Cảnh báo kho." };
}

function normalizeBalance(row = {}) {
  return {
    warehouseId: toText(row.warehouse_id),
    itemId: toText(row.item_id),
    quantity: Number(row.quantity || 0),
    averageCost: Number(row.average_cost || 0),
    updatedAt: toText(row.updated_at)
  };
}

function normalizeLot(row = {}) {
  return {
    id: toText(row.id),
    warehouseId: toText(row.warehouse_id),
    itemId: toText(row.item_id),
    sourceDocumentId: toText(row.source_document_id),
    lotNumber: toText(row.lot_number),
    expiresOn: toText(row.expires_on),
    remainingQuantity: Number(row.remaining_quantity || 0),
    status: toText(row.status),
    updatedAt: toText(row.updated_at)
  };
}

function normalizeDocument(row = {}) {
  return {
    id: toText(row.id),
    documentNo: toText(row.document_no),
    documentType: toText(row.document_type),
    status: toText(row.status),
    sourceWarehouseId: toText(row.source_warehouse_id),
    destinationWarehouseId: toText(row.destination_warehouse_id),
    sourceDocumentId: toText(row.source_document_id),
    occurredAt: toText(row.occurred_at)
  };
}

function getWarehouseOrFilter(warehouseIds = []) {
  const ids = warehouseIds.map(toText).filter(Boolean);
  if (ids.length === 1) {
    return `source_warehouse_id.eq.${ids[0]},destination_warehouse_id.eq.${ids[0]}`;
  }
  const values = `(${ids.join(",")})`;
  return `source_warehouse_id.in.${values},destination_warehouse_id.in.${values}`;
}

function isActionableDocument(document, linkedRequisitionIds) {
  if (document.status === "submitted") return DOCUMENT_TYPES.includes(document.documentType);
  if (document.documentType === "transfer") {
    return ["approved", "in_transit", "received", "received_with_variance"].includes(document.status);
  }
  return document.documentType === "internal_requisition"
    && document.status === "approved"
    && !linkedRequisitionIds.has(document.id);
}

export async function readInventoryAlertSources({ warehouseIds = [] } = {}) {
  const allowedWarehouseIds = [...new Set(warehouseIds.map(toText).filter(Boolean))];
  if (!allowedWarehouseIds.length) {
    return { ok: true, status: "ready", sources: EMPTY_INVENTORY_ALERT_SOURCES, limited: false };
  }

  const client = await getInventoryClient();
  if (!client) return { ok: false, status: "setup", sources: EMPTY_INVENTORY_ALERT_SOURCES, message: "Chưa kết nối được Supabase cho phân hệ Kho." };

  const [balanceResult, lotResult, documentResult] = await Promise.all([
    client
      .from("inventory_stock_balances")
      .select("warehouse_id,item_id,quantity,average_cost,updated_at", { count: "exact" })
      .in("warehouse_id", allowedWarehouseIds)
      .range(0, SOURCE_LIMIT - 1),
    client
      .from("inventory_stock_lots")
      .select("id,warehouse_id,item_id,source_document_id,lot_number,expires_on,remaining_quantity,status,updated_at", { count: "exact" })
      .in("warehouse_id", allowedWarehouseIds)
      .eq("status", "active")
      .gt("remaining_quantity", 0)
      .not("expires_on", "is", null)
      .range(0, SOURCE_LIMIT - 1),
    client
      .from("inventory_documents")
      .select("id,document_no,document_type,status,source_warehouse_id,destination_warehouse_id,source_document_id,occurred_at", { count: "exact" })
      .in("document_type", DOCUMENT_TYPES)
      .in("status", CANDIDATE_STATUSES)
      .or(getWarehouseOrFilter(allowedWarehouseIds))
      .order("occurred_at", { ascending: false })
      .range(0, DOCUMENT_LIMIT - 1)
  ]);
  recordAdminRequest("read inventory alerts balances", "inventory_stock_balances");
  recordAdminRequest("read inventory alerts lots", "inventory_stock_lots");
  recordAdminRequest("read inventory alerts documents", "inventory_documents");

  const firstError = balanceResult.error || lotResult.error || documentResult.error;
  if (firstError) return { ok: false, ...normalizeReadError(firstError), sources: EMPTY_INVENTORY_ALERT_SOURCES };

  const documents = (documentResult.data || []).map(normalizeDocument);
  const approvedRequisitionIds = documents
    .filter((row) => row.documentType === "internal_requisition" && row.status === "approved")
    .map((row) => row.id);
  let linkedRequisitionIds = new Set();
  if (approvedRequisitionIds.length) {
    const linkedResult = await client
      .from("inventory_documents")
      .select("source_document_id")
      .eq("document_type", "transfer")
      .in("source_document_id", approvedRequisitionIds);
    recordAdminRequest("read inventory alert linked transfers", "inventory_documents");
    if (linkedResult.error) return { ok: false, ...normalizeReadError(linkedResult.error), sources: EMPTY_INVENTORY_ALERT_SOURCES };
    linkedRequisitionIds = new Set((linkedResult.data || []).map((row) => toText(row.source_document_id)).filter(Boolean));
  }

  return {
    ok: true,
    status: "ready",
    sources: {
      balances: (balanceResult.data || []).map(normalizeBalance),
      lots: (lotResult.data || []).map(normalizeLot),
      documents: documents.filter((row) => isActionableDocument(row, linkedRequisitionIds))
    },
    limited: Number(balanceResult.count || 0) > SOURCE_LIMIT
      || Number(lotResult.count || 0) > SOURCE_LIMIT
      || Number(documentResult.count || 0) > DOCUMENT_LIMIT
  };
}

export default { readInventoryAlertSources };
