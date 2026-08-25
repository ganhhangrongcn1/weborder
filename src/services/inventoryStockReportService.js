import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";
import { recordAdminRequest } from "./adminRequestAuditService.js";

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
    return { status: "setup", code: "inventory_report_missing", message: "Schema báo cáo tồn kho chưa sẵn sàng trên Supabase đang chạy." };
  }
  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) {
    return { status: "error", code: "inventory_report_denied", message: "Tài khoản chưa có quyền xem báo cáo kho." };
  }
  return { status: "error", code: "inventory_report_failed", message: toText(error.message) || "Không tải được báo cáo kho." };
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

export async function readInventoryStockReport() {
  const client = await getInventoryClient();
  if (!client) return { ok: false, status: "setup", rows: [], message: "Chưa kết nối được Supabase cho phân hệ Kho." };

  const result = await client
    .from("inventory_stock_balances")
    .select("warehouse_id,item_id,quantity,average_cost,updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(0, REPORT_LIMIT - 1);
  recordAdminRequest("read inventory stock report", "inventory_stock_balances");
  if (result.error) return { ok: false, ...normalizeReadError(result.error), rows: [] };

  return {
    ok: true,
    status: "ready",
    rows: (result.data || []).map(normalizeBalance),
    totalCount: Number(result.count || 0),
    limited: Number(result.count || 0) > REPORT_LIMIT
  };
}

export default { readInventoryStockReport };
