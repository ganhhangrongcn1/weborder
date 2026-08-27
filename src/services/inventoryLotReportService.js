import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";
import { countInventoryLotAttention } from "./inventoryLotReportCalculations.js";

const REPORT_LIMIT = 5000;

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
    return { status: "setup", code: "inventory_lots_missing", message: "Schema lô và hạn sử dụng chưa sẵn sàng trên Supabase đang chạy." };
  }
  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return { status: "error", code: "inventory_lots_denied", message: "Tài khoản chưa có quyền xem lô hàng trong kho này." };
  }
  return { status: "error", code: "inventory_lots_failed", message: toText(error.message) || "Không tải được danh sách lô và hạn sử dụng." };
}

function normalizeLot(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: toText(row.id),
    warehouseId: toText(row.warehouse_id),
    itemId: toText(row.item_id),
    sourceDocumentId: toText(row.source_document_id),
    sourceDocumentLineId: toText(row.source_document_line_id),
    sourceDocumentNo: toText(metadata.document_no),
    lotNumber: toText(row.lot_number),
    manufacturedOn: toText(row.manufactured_on),
    expiresOn: toText(row.expires_on),
    receivedQuantity: Number(row.received_quantity || 0),
    remainingQuantity: Number(row.remaining_quantity || 0),
    unitCost: Number(row.unit_cost || 0),
    status: toText(row.status) || "active",
    createdAt: toText(row.created_at),
    updatedAt: toText(row.updated_at)
  };
}

export async function readInventoryLotReport({ warehouseIds = [] } = {}) {
  const allowedWarehouseIds = [...new Set(warehouseIds.map(toText).filter(Boolean))];
  if (!allowedWarehouseIds.length) {
    return { ok: true, status: "ready", rows: [], totalCount: 0, limited: false };
  }

  const client = await getInventoryClient();
  if (!client) return { ok: false, status: "setup", rows: [], message: "Chưa kết nối được Supabase cho phân hệ Kho." };

  const result = await client
    .from("inventory_stock_lots")
    .select("id,warehouse_id,item_id,source_document_id,source_document_line_id,lot_number,manufactured_on,expires_on,received_quantity,remaining_quantity,unit_cost,status,metadata,created_at,updated_at", { count: "exact" })
    .in("warehouse_id", allowedWarehouseIds)
    .gt("remaining_quantity", 0)
    .order("expires_on", { ascending: true })
    .range(0, REPORT_LIMIT - 1);
  recordAdminRequest("read inventory lot report", "inventory_stock_lots");
  if (result.error) return { ok: false, ...normalizeReadError(result.error), rows: [] };

  return {
    ok: true,
    status: "ready",
    rows: (result.data || []).map(normalizeLot),
    totalCount: Number(result.count || 0),
    limited: Number(result.count || 0) > REPORT_LIMIT
  };
}

export async function readInventoryLotAttentionCount({ warehouseId = "" } = {}) {
  const client = await getInventoryClient();
  if (!client) throw new Error("Chưa kết nối được Supabase cho phân hệ Kho.");

  let lotQuery = client
    .from("inventory_stock_lots")
    .select("id,warehouse_id,item_id,expires_on,remaining_quantity,status")
    .gt("remaining_quantity", 0)
    .not("expires_on", "is", null);
  if (warehouseId) lotQuery = lotQuery.eq("warehouse_id", warehouseId);

  const [lotResult, itemResult] = await Promise.all([
    lotQuery.range(0, REPORT_LIMIT - 1),
    client.from("inventory_items").select("id,metadata").range(0, REPORT_LIMIT - 1)
  ]);
  recordAdminRequest("count inventory lot attention", "inventory_stock_lots,inventory_items");
  const firstError = lotResult.error || itemResult.error;
  if (firstError) throw new Error(normalizeReadError(firstError).message);

  const items = (itemResult.data || []).map((item) => ({
    id: toText(item.id),
    expiryWarningDays: Math.max(0, Math.trunc(Number(item.metadata?.expiry_warning_days || 0)))
  }));
  const rows = (lotResult.data || []).map(normalizeLot);
  return countInventoryLotAttention(rows, new Map(items.map((item) => [item.id, item])));
}

export default { readInventoryLotAttentionCount, readInventoryLotReport };
